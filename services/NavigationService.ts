// services/NavigationService.ts
//
// Orchestrates the FULL "Start Location Sharing" flow.
//
// When the rider taps "Start Location Sharing", this service runs:
//   Step 1  → Check / request foreground location permission
//   Step 2  → Check / request notification permission (Android 13+)
//   Step 3  → Check / request background location permission
//   Step 4  → Check overlay permission (non-blocking — we prompt but don't block)
//   Step 5  → Start native foreground service (GPS + self-heal alarms)
//   Step 6  → GPS updates begin inside the service (automatic)
//   Step 7  → Foreground notification shown by the service (automatic)
//   Step 8  → Location upload starts inside the service (HTTP every 5s)
//   Step 9  → Observe AppState → background triggers PiP / floating overlay
//
// Steps 6–8 happen automatically inside LocationService.kt once startTrip()
// is called — they are listed here for documentation clarity.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/apiConfig';
import { promptBatteryOptimization } from './batteryOptimization';
import {
  checkNotificationPermission,
  requestNotificationPermission,
  ensureTrackingChannel,
} from './NotificationManager';
import {
  isOverlayPermissionGranted,
  requestOverlayPermission,
} from './OverlayManager';
import { locationService } from './locationService';

const { RiderTrackingModule } = NativeModules;
const BG_USER_KEY = 'bg_user';
const BATTERY_OPT_PROMPTED_KEY = 'battery_opt_prompted';

export type StartFlowResult =
  | { success: true }
  | { success: false; step: string; reason: string };

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestration function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full 9-step "Start Location Sharing" flow.
 *
 * @param user  The authenticated rider object (must have _id field).
 * @returns     { success: true } on success, or { success: false, step, reason }
 *              if the flow was aborted at a particular step.
 */
export async function startLocationSharingFlow(
  user: { _id: string; name?: string; phone?: string }
): Promise<StartFlowResult> {
  if (!user?._id) {
    return { success: false, step: 'auth', reason: 'User not logged in' };
  }

  // ── Step 1: Foreground location permission ────────────────────────────────
  let fgPerm = await Location.getForegroundPermissionsAsync();
  if (fgPerm.status !== 'granted') {
    fgPerm = await Location.requestForegroundPermissionsAsync();
    if (fgPerm.status !== 'granted') {
      Alert.alert(
        '📍 Location Permission Required',
        'Shiptos needs location access to track your deliveries. Please grant location permission.',
        [{ text: 'OK' }]
      );
      return {
        success: false,
        step: 'foreground_location',
        reason: 'Foreground location permission denied',
      };
    }
  }

  // ── Step 2: Notification permission (Android 13+ / API 33) ───────────────
  const notifGranted = await checkNotificationPermission();
  if (!notifGranted) {
    const requested = await requestNotificationPermission();
    if (!requested) {
      // Non-blocking — tracking can still work without notifications on some flows,
      // but the foreground service REQUIRES it on Android 13+. Warn and abort.
      return {
        success: false,
        step: 'notification',
        reason: 'Notification permission denied — required for foreground service on Android 13+',
      };
    }
  }

  // ── Step 3: Background location permission ────────────────────────────────
  let bgPerm = await Location.getBackgroundPermissionsAsync();
  if (bgPerm.status !== 'granted') {
    // Must request foreground first, then background
    const bgGranted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        '📍 Background Location Needed',
        "For continuous delivery tracking while your phone is locked or while you're using other apps, please select \"Allow all the time\" in the next screen.",
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Continue',
            onPress: async () => {
              const result = await Location.requestBackgroundPermissionsAsync();
              resolve(result.status === 'granted');
            },
          },
        ],
        { cancelable: false }
      );
    });

    if (!bgGranted) {
      return {
        success: false,
        step: 'background_location',
        reason: 'Background location permission denied',
      };
    }
  }

  // ── Step 4: Overlay permission (non-blocking — we prompt but continue) ────
  if (Platform.OS === 'android') {
    const overlayGranted = await isOverlayPermissionGranted();
    if (!overlayGranted) {
      // Fire-and-forget: we ask but don't block the flow.
      // If granted later, overlay will work; if not, only PiP will be attempted.
      requestOverlayPermission().catch(() => {});
    }
  }

  // ── Step 4b: Battery optimisation (non-blocking) ──────────────────────────
  if (Platform.OS === 'android') {
    try {
      const batteryPrompted = await AsyncStorage.getItem(BATTERY_OPT_PROMPTED_KEY);
      if (!batteryPrompted) {
        promptBatteryOptimization().catch(() => {});
        await AsyncStorage.setItem(BATTERY_OPT_PROMPTED_KEY, 'true');
      }
    } catch {
      // non-critical
    }
  }

  // ── Step 5: Cache user data for background task ───────────────────────────
  try {
    await locationService.setCachedUser(user);
    await AsyncStorage.setItem(
      BG_USER_KEY,
      JSON.stringify({
        id: user._id,
        name: user.name ?? 'Unknown Rider',
        phone: user.phone ?? 'N/A',
      })
    );
  } catch (e) {
    console.warn('[NavigationService] Failed to cache user:', e);
  }

  // ── Step 5b: Ensure notification channel exists ───────────────────────────
  await ensureTrackingChannel();

  // ── Steps 5–8: Start native foreground service ────────────────────────────
  // The native service handles: GPS (step 6), notification (step 7),
  // and HTTP upload every 5s (step 8) automatically.
  try {
    await locationService.startTracking();
  } catch (e: any) {
    console.error('[NavigationService] startTracking failed:', e);
    return {
      success: false,
      step: 'foreground_service',
      reason: e?.message ?? 'Failed to start foreground service',
    };
  }

  // Step 9 (AppState observation) is set up in LocationContext — it watches
  // AppState and calls OverlayManager.showMiniWindow() on background.

  console.log('[NavigationService] ✅ All steps completed — tracking active');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gracefully stop location sharing.
 * Stops the foreground service, clears caches, and stops PiP/overlay.
 */
export async function stopLocationSharingFlow(): Promise<void> {
  try {
    await locationService.stopTracking();
  } catch (e) {
    console.warn('[NavigationService] stopTracking failed:', e);
  }
}
