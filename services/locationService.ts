import * as Location from "expo-location";
import * as Battery from "expo-battery";
import * as Notifications from "expo-notifications";
import { LOCATION_TASK_NAME } from "./backgroundLocationTask";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TRACKING_CHANNEL_ID = "location-tracking";

const CONFIG_KEY = "bg_config_v1";
const STATUS_KEY = "bg_status";
const BG_USER_KEY = "bg_user";
const WAS_TRACKING_KEY = "was_tracking";

export type PermissionState = "denied" | "foreground" | "background";

export class LocationService {
  private static instance: LocationService;
  private isTracking = false;
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

    const alreadyRunning =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (alreadyRunning) {
      console.log("⚠️ Background task already running");
      this.isTracking = true;
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
    await this.setWasTracking(true);
    console.log("✅ Background tracking started (foreground service active)");
  }

  async stopTracking(): Promise<void> {
    try {
      const running =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (running) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("✅ Background tracking stopped");
      } else {
        console.log("⚠️ Background tracking was not running");
      }
    } catch (e) {
      console.warn("stopTracking failed", e);
    }

    this.isTracking = false;
    await this.setWasTracking(false);
  }

  isTrackingActive(): boolean {
    return this.isTracking;
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