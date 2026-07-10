// services/backgroundTrackingService.ts
//
// Primary background tracking layer powered by react-native-background-actions.
// This keeps the JS thread ALIVE in the background, which is what keeps the
// socket connected and emitting location updates. It runs a continuous loop
// that polls the current position and sends it to the backend.
//
// It runs IN PARALLEL with the native Kotlin foreground service (LocationService.kt)
// which acts as a pure-native HTTP backup. If the JS task is killed by an OEM
// (Xiaomi/Redmi/Samsung), the native service keeps posting HTTP every 5s.

import BackgroundService from "react-native-background-actions";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { sendRiderLocationUpdate } from "./riderLocationUpdate";
import { trackingLegService } from "./trackingLegService";
import { locationService } from "./locationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG_USER_KEY = "bg_user";

// How often to poll location inside the background task
const POLL_INTERVAL_MS = 8000;

type CachedRider = {
  id: string;
  name?: string;
  phone?: string;
};

class BackgroundTrackingService {
  private isRunning = false;

  /**
   * Start the background tracking task.
   * Shows a persistent notification (Google Maps style) and keeps the JS
   * thread alive so the socket keeps emitting.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Background tracking task already running");
      return;
    }

    // Make sure foreground permission is granted (required by background-actions)
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Foreground location permission not granted for background-actions");
    }

    // Android 13+ requires POST_NOTIFICATIONS permission for the notification
    if (Platform.OS === "android") {
      try {
        const notifPerm = await Location.requestForegroundPermissionsAsync();
        if (notifPerm.status !== "granted") {
          console.warn("⚠️ Notification permission not granted — background notification may not show");
        }
      } catch {
        // non-critical
      }
    }

    const options = {
      taskName: "Shiptos Live Tracking",
      taskTitle: "📍 Live Tracking Active",
      taskDesc: "Your real-time location is being shared with the admin panel.",
      taskIcon: {
        name: "ic_launcher",
        type: "mipmap",
      },
      color: "#10b981",
      // Android 14+ (targetSdk 34) requires a foreground service type.
      // "location" matches our use case and the declared permission
      // FOREGROUND_SERVICE_LOCATION.
      linkingURI: "shiptosrider://",
      parameters: {
        delay: POLL_INTERVAL_MS,
      },
    };

    try {
      await BackgroundService.start(this.backgroundTask, options);
      this.isRunning = true;
      console.log("✅ Background tracking task started (JS thread kept alive, socket stays connected)");
    } catch (e) {
      console.error("❌ Failed to start background tracking task:", e);
      throw e;
    }
  }

  /**
   * Stop the background tracking task.
   */
  async stop(): Promise<void> {
    if (!this.isRunning && !BackgroundService.isRunning()) {
      console.log("⚠️ Background tracking task not running");
      return;
    }

    try {
      await BackgroundService.stop();
      this.isRunning = false;
      console.log("🛑 Background tracking task stopped");
    } catch (e) {
      console.error("❌ Failed to stop background tracking task:", e);
      this.isRunning = false;
    }
  }

  isActive(): boolean {
    return this.isRunning || BackgroundService.isRunning();
  }

  /**
   * The async function that runs as the background task.
   * react-native-background-actions keeps the JS thread alive while this
   * function is running. We loop here, polling location and sending updates.
   *
   * The loop MUST check BackgroundService.isRunning() to know when to stop.
   */
  private backgroundTask = async (taskData?: any) => {
    const delay = taskData?.delay ?? POLL_INTERVAL_MS;
    console.log(`[BG_ACTIONS_TASK] started, polling every ${delay}ms`);

    // Wait a moment for the task to fully establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    while (BackgroundService.isRunning()) {
      try {
        await this.pollAndSendLocation();
      } catch (e) {
        console.warn("[BG_ACTIONS_TASK] poll iteration failed:", e);
      }

      // Sleep for the poll interval (non-blocking sleep)
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.log("[BG_ACTIONS_TASK] loop exited");
  };

  /**
   * Get current position and send it to the backend.
   * Uses getCurrentPositionAsync (more reliable in background than watchPositionAsync).
   */
  private async pollAndSendLocation(): Promise<void> {
    // Read the cached rider (set by locationService.setCachedUser)
    let user: CachedRider | null = null;
    try {
      const raw = await AsyncStorage.getItem(BG_USER_KEY);
      if (raw) user = JSON.parse(raw);
    } catch (e) {
      console.warn("[BG_ACTIONS_TASK] failed to read bg_user:", e);
    }

    if (!user?.id) {
      console.log("[BG_ACTIONS_TASK] no cached rider, skipping");
      return;
    }

    let location: Location.LocationObject | null = null;
    try {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: false,
      });
    } catch (e) {
      console.warn("[BG_ACTIONS_TASK] getCurrentPositionAsync failed:", e);
      return;
    }

    if (!location) return;

    // Record distance for active tracking leg (if any)
    let taskTracking = null;
    try {
      const result = await trackingLegService.recordLocation(location);
      const leg = result.leg;
      if (leg) {
        taskTracking = {
          trackingLegId: leg.id,
          taskId: leg.taskId,
          taskType: leg.type,
          totalDistanceKm: leg.totalDistanceKm,
          distanceFromPreviousKm: result.distanceFromPreviousKm,
          destination: leg.destination,
        };
      }
    } catch (e) {
      console.warn("[BG_ACTIONS_TASK] trackingLegService.recordLocation failed:", e);
    }

    const payload = await locationService.formatLocationForBackend(
      location,
      user.id,
      user.name || "Unknown Rider",
      user.phone || "N/A",
      "active",
    );

    try {
      const result = await sendRiderLocationUpdate({
        riderId: user.id,
        lat: payload.location.lat,
        lng: payload.location.lng,
        speed: payload.speed,
        bearing: payload.bearing,
        batteryLevel: payload.batteryLevel,
        status: "active",
        taskTracking,
      });

      if (result.sentViaSocket) {
        console.log(`[BG_ACTIONS_TASK] sent via SOCKET lat=${payload.location.lat.toFixed(5)} lng=${payload.location.lng.toFixed(5)}`);
      } else if (result.sentViaHttp) {
        console.log(`[BG_ACTIONS_TASK] sent via HTTP lat=${payload.location.lat.toFixed(5)} lng=${payload.location.lng.toFixed(5)}`);
      } else {
        console.warn("[BG_ACTIONS_TASK] location update NOT sent");
      }
    } catch (e) {
      console.error("[BG_ACTIONS_TASK] sendRiderLocationUpdate failed:", e);
    }

    try {
      await locationService.recordLastSentTime();
    } catch {
      // non-critical
    }
  };
}

export const backgroundTrackingService = new BackgroundTrackingService();
