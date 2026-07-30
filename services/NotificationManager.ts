// services/NotificationManager.ts
//
// Centralises notification permission management.
// Wraps both the native Android bridge (for precise API-level control)
// and the Expo Notifications API (as a fallback / cross-platform path).

import * as Notifications from 'expo-notifications';
import { Alert, Linking, NativeModules, Platform } from 'react-native';

const { RiderTrackingModule } = NativeModules;
const TRACKING_CHANNEL_ID = 'location-tracking';

// ─────────────────────────────────────────────────────────────────────────────
// Permission checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether POST_NOTIFICATIONS permission is currently granted.
 * Uses the native bridge on Android (more accurate) and falls back to
 * Expo Notifications on other platforms.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && RiderTrackingModule?.checkNotificationPermission) {
    try {
      return await RiderTrackingModule.checkNotificationPermission();
    } catch {
      // fall through to Expo path
    }
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Request POST_NOTIFICATIONS permission.
 * On Android 13+ (API 33) this shows a system dialog.
 * On older Android / iOS it uses expo-notifications.
 *
 * Returns true if permission is granted after the request.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  // First check if already granted
  if (await checkNotificationPermission()) return true;

  // Try requesting via Expo (works on all platforms and Android < 13)
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') return true;

  // If still denied on Android, guide user to settings
  if (Platform.OS === 'android') {
    return new Promise((resolve) => {
      Alert.alert(
        '🔔 Notifications Required',
        'Tracking notifications must be enabled so you can see when location sharing is active. Please enable them in Settings.',
        [
          { text: 'Skip', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                if (RiderTrackingModule?.openNotificationSettings) {
                  await RiderTrackingModule.openNotificationSettings();
                } else {
                  await Linking.openSettings();
                }
              } catch {
                await Linking.openSettings();
              }
              // Can't know if user granted — resolve false, they can retry
              resolve(false);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create / update the high-priority tracking notification channel.
 * Must be called before starting the foreground service so the native
 * service can attach its notification to this channel.
 */
export async function ensureTrackingChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(TRACKING_CHANNEL_ID, {
      name: 'Location Tracking',
      description: 'Persistent notification while live delivery tracking is active',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: null,         // Silent — persistent status, not an alert
      enableVibrate: false,
      showBadge: false,
    });
  } catch (e) {
    console.warn('[NotificationManager] Failed to create tracking channel:', e);
  }
}

/**
 * Show a one-time system notification (e.g. "Tracking started").
 * Fires immediately (trigger: null).
 */
export async function showTrackingNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: null,
    });
  } catch (e) {
    console.warn('[NotificationManager] showTrackingNotification failed:', e);
  }
}
