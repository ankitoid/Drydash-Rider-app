import * as Location from "expo-location";
import * as Battery from "expo-battery";
import * as Notifications from "expo-notifications";
import { API_BASE_URL } from "@/constants/apiConfig";
import { LOCATION_TASK_NAME } from "./backgroundLocationTask";
import { backgroundTrackingService } from "./backgroundTrackingService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const TRACKING_CHANNEL_ID = "location-tracking";

const CONFIG_KEY = "bg_config_v1";
const STATUS_KEY = "bg_status";
const BG_USER_KEY = "bg_user";
const WAS_TRACKING_KEY = "was_tracking";

export type PermissionState = "denied" | "foreground" | "background";

export class LocationService {
  private static instance: LocationService;
  private isTracking = false;
  private usingNativeService = false;
  private cachedUser: any = null;

  private distanceInterval = 50;
  private timeInterval = 120000;

  private constructor() { }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async setCachedUser(user: any) {
    this.cachedUser = user;
    try {
      if (user) {
        await AsyncStorage.setItem(
          BG_USER_KEY,
          JSON.stringify({
            id: user._id,
            name: user.name ?? "Unknown Rider",
            phone: user.phone ?? "N/A",
            bgToken: user.bgToken ?? null,
          })
        );
      } else {
        await AsyncStorage.removeItem(BG_USER_KEY);
      }
    } catch (e) {
      console.warn("LocationService.setCachedUser: failed to persist bg_user", e);
    }
  }

  getCachedUser() {
    return this.cachedUser;
  }

  async checkPermissions(): Promise<PermissionState> {
    let fg = await Location.getForegroundPermissionsAsync();

    if (fg.status !== "granted") {
      fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") return "denied";
    }

    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === "granted") return "background";

    return "foreground";
  }

  /**
   * Call ONLY from a user action (button / alert)
   * Ensures foreground permission is granted before requesting background
   */
  async requestBackgroundPermission(): Promise<boolean> {
    // Ensure foreground is granted first
    let fg = await Location.getForegroundPermissionsAsync();

    if (fg.status !== "granted") {
      fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        console.warn("Foreground permission not granted, cannot request background");
        return false;
      }
    }

    // Now safe to request background
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }

  /* ---------------- TRACKING ---------------- */

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log("⚠️ Tracking already active");
      return;
    }

    const permissionState = await this.checkPermissions();
    if (permissionState !== "background") {
      throw new Error(`Background location not granted (current state: ${permissionState})`);
    }

    try {
      const rawCfg = await AsyncStorage.getItem(CONFIG_KEY);
      if (rawCfg) {
        const cfg = JSON.parse(rawCfg);
        if (cfg.updateInterval != null) this.timeInterval = cfg.updateInterval;
        if (cfg.distanceFilter != null) this.distanceInterval = cfg.distanceFilter;
      }
    } catch (e) {
      console.warn("LocationService.startTracking: failed to read config", e);
    }

    if (Platform.OS === "android") {
      try {
        const cachedUser = this.cachedUser ?? JSON.parse((await AsyncStorage.getItem(BG_USER_KEY)) || "null");
        const riderId = cachedUser?.id;

        if (!riderId) {
          throw new Error("Missing cached rider id for native tracking");
        }

        const nativeModule = NativeModules.RiderTrackingModule;
        if (!nativeModule?.startTrip) {
          throw new Error("Native rider tracking module not available");
        }

        await nativeModule.startTrip(riderId, API_BASE_URL);
        this.isTracking = true;
        this.usingNativeService = true;
        await this.setWasTracking(true);
        console.log("✅ Native Android tracking started (foreground service active)");

        // ── Ensure any stale Expo background task is killed ──
        try {
          const isExpoRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (isExpoRunning) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log("🧹 Stopped stale Expo background task");
          }
        } catch (e) {
          // ignore
        }

        // ── Also start the background-actions layer (keeps JS thread + socket alive) ──
        // This runs IN PARALLEL with the native service. The native service posts
        // HTTP every 5s as a pure-native backup, while this layer keeps the socket
        // connected and emits riderLocationUpdate. If the JS task gets killed by an
        // aggressive OEM, the native service keeps the admin panel updated.
        try {
          await backgroundTrackingService.start();
          console.log("✅ Background-actions layer started (socket kept alive in background)");
        } catch (bgErr) {
          console.warn("⚠️ Background-actions layer failed to start (native service still active):", bgErr);
        }
        return;
      } catch (nativeErr) {
        console.warn("Native Android tracking start failed, falling back to Expo tracking:", nativeErr);
        this.usingNativeService = false;
      }
    }

    const alreadyRunning =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (alreadyRunning) {
      console.log("⚠️ Background task already running");
      this.isTracking = true;
      this.usingNativeService = false;
      await this.setWasTracking(true);
      return;
    }

    // ── Create a dedicated notification channel for tracking ──
    // MAX importance + PUBLIC visibility = always visible on lock screen + non-dismissable
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(TRACKING_CHANNEL_ID, {
        name: "Location Tracking",
        description: "Persistent notification while task distance tracking is active",
        importance: Notifications.AndroidImportance.MAX,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        sound: null,               // No sound — this is a silent persistent notification
        enableVibrate: false,      // No vibration
        showBadge: false,          // No badge count
      });
      console.log("✅ Tracking notification channel created (MAX importance, PUBLIC lock screen)");
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: this.timeInterval,
      distanceInterval: this.distanceInterval,
      pausesUpdatesAutomatically: false,
      // ── Doze mode resilience ──
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      // ── iOS: Blue bar like Google Maps ──
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      mayShowUserSettingsDialog: true,
      // ── Android: Persistent foreground service notification ──
      foregroundService: {
        notificationTitle: "🟢 Shiptos tracking active",
        notificationBody: "Live delivery location is being shared",
        notificationColor: "#10b981",
        killServiceOnDestroy: false,
      },
    });

    this.isTracking = true;
    this.usingNativeService = false;
    await this.setWasTracking(true);
    console.log("✅ Background tracking started (foreground service active)");
  }

  async stopTracking(): Promise<void> {
    // ── Stop the background-actions layer first (so the JS loop exits cleanly) ──
    try {
      await backgroundTrackingService.stop();
    } catch (e) {
      console.warn("Background-actions stop failed:", e);
    }

    try {
      if (Platform.OS === "android") {
        const nativeModule = NativeModules.RiderTrackingModule;
        if (nativeModule?.stopTrip) {
          await nativeModule.stopTrip();
          console.log("✅ Native Android tracking stopped");
        }
      }

      // Also clear tracking extras on stop
      try {
        const nativeModule = NativeModules.RiderTrackingModule;
        if (nativeModule?.updateTrackingExtras) {
          await nativeModule.updateTrackingExtras("");
        }
      } catch {
        // non-critical
      }

      const running =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (running) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("✅ Background tracking stopped");
      }
    } catch (e) {
      console.warn("stopTracking failed", e);
    }

    this.isTracking = false;
    this.usingNativeService = false;
    await this.setWasTracking(false);
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Whether the native Android foreground service is the active tracking mechanism.
   * Used by the watchdog to skip the Expo task check.
   */
  isUsingNativeService(): boolean {
    return this.usingNativeService;
  }

  /**
   * Check if the native foreground service is currently running.
   * Calls the native module's isServiceRunning method.
   */
  async isNativeServiceRunning(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    try {
      const nativeModule = NativeModules.RiderTrackingModule;
      if (!nativeModule?.isServiceRunning) return false;
      return await nativeModule.isServiceRunning();
    } catch {
      return false;
    }
  }

  /**
   * Update the taskTracking extras sent by the native HTTP POST.
   * Call this when a navigation leg starts or ends.
   * @param extras - JSON string of the taskTracking object, or null to clear
   */
  async updateNativeTrackingExtras(extras: string | null): Promise<void> {
    if (Platform.OS !== "android") return;
    try {
      const nativeModule = NativeModules.RiderTrackingModule;
      if (!nativeModule?.updateTrackingExtras) {
        console.warn("Native updateTrackingExtras not available");
        return;
      }
      await nativeModule.updateTrackingExtras(extras ?? "");
      console.log("✅ Native tracking extras updated");
    } catch (e) {
      console.warn("Failed to update native tracking extras:", e);
    }
  }

  /* ----------- AUTO-RESUME SUPPORT ----------- */

  /** Persist whether tracking was active (survives process kill) */
  private async setWasTracking(value: boolean): Promise<void> {
    try {
      if (value) {
        await AsyncStorage.setItem(WAS_TRACKING_KEY, "true");
      } else {
        await AsyncStorage.removeItem(WAS_TRACKING_KEY);
      }
    } catch (e) {
      console.warn("setWasTracking failed", e);
    }
  }

  /** Check if tracking was running before the OS killed the process */
  async wasTrackingBeforeKill(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(WAS_TRACKING_KEY);
      return val === "true";
    } catch {
      return false;
    }
  }

  /* ---------------- CONFIG ---------------- */

  async updateConfig(cfg: {
    updateInterval?: number;
    distanceFilter?: number;
  }) {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    const current = raw ? JSON.parse(raw) : {};
    const merged = { ...current, ...cfg };

    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(merged));

    if (cfg.updateInterval != null) this.timeInterval = cfg.updateInterval;
    if (cfg.distanceFilter != null) this.distanceInterval = cfg.distanceFilter;
  }

  async getTrackingStatus() {
    const started =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    const status = raw ? JSON.parse(raw) : {};
    return {
      isTracking: started,
      lastSentTime: status.lastSentTime ?? null,
    };
  }

  async recordLastSentTime(ts?: string) {
    await AsyncStorage.setItem(
      STATUS_KEY,
      JSON.stringify({ lastSentTime: ts ?? new Date().toISOString() })
    );
  }

  /* ---------------- UTILS ---------------- */

  private async getBatteryLevel(): Promise<number> {
    try {
      const level = await Battery.getBatteryLevelAsync();
      return typeof level === "number" ? Math.round(level * 100) : 100;
    } catch {
      return 100;
    }
  }

  async formatLocationForBackend(
    location: Location.LocationObject,
    riderId: string,
    riderName: string,
    riderPhone: string,
    status = "active"
  ) {
    const battery = await this.getBatteryLevel();

    return {
      riderId,
      name: riderName,
      phone: riderPhone,
      location: {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      },
      speed: location.coords.speed ? location.coords.speed * 3.6 : 0,
      bearing: location.coords.heading ?? 0,
      batteryLevel: battery,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();
