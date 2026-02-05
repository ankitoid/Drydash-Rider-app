import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { LOCATION_TASK_NAME } from "./backgroundLocationTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONFIG_KEY = "bg_config_v1";
const STATUS_KEY = "bg_status";
const BG_USER_KEY = "bg_user";

export type PermissionState = "denied" | "foreground" | "background";

export class LocationService {
  private static instance: LocationService;
  private isTracking = false;
  private cachedUser: any = null;

  private distanceInterval = 10;
  private timeInterval = 30000;

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
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return "denied";

    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === "granted") return "background";

    return "foreground";
  }

  /**
   * Call ONLY from a user action (button / alert)
   */
  async requestBackgroundPermission(): Promise<boolean> {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }

  /* ---------------- TRACKING ---------------- */

  async startTracking(): Promise<void> {
    if (this.isTracking) return;

    const permissionState = await this.checkPermissions();
    if (permissionState !== "background") {
      throw new Error("Background location not granted");
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
      this.isTracking = true;
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: this.timeInterval,
      distanceInterval: this.distanceInterval,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "DryDash tracking active",
        notificationBody: "Live delivery location is running",
        notificationColor: "#10b981",
      },
    });

    this.isTracking = true;
    console.log("✅ Background tracking started");
  }

  async stopTracking(): Promise<void> {
    try {
      const running =
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (running) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      console.warn("stopTracking failed", e);
    }

    this.isTracking = false;
    console.log("✅ Background tracking stopped");
  }

  isTrackingActive(): boolean {
    return this.isTracking;
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
      speed: location.coords.speed
        ? location.coords.speed * 3.6
        : 0,
      bearing: location.coords.heading ?? 0,
      batteryLevel: battery,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();