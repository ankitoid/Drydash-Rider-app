import * as Location from "expo-location";
import * as Battery from "expo-battery";
import { LOCATION_TASK_NAME } from "./backgroundLocationTask";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONFIG_KEY = "bg_config_v1";
const STATUS_KEY = "bg_status";
const BG_USER_KEY = "bg_user";

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
            name: user.name || "Unknown Rider",
            phone: user.phone || "N/A",
            bgToken: (user as any).bgToken || null,
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

  async requestPermissions(): Promise<boolean> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) return;

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

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );

    if (hasStarted) {
      console.log("⚠️ Background tracking already running (system reports started)");
      this.isTracking = true;
      return;
    }

    console.log("📍 Starting BACKGROUND tracking with", {
      accuracy: "High",
      timeInterval: this.timeInterval,
      distanceInterval: this.distanceInterval,
    });

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: this.distanceInterval,
      timeInterval: this.timeInterval,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "DryDash is tracking your location",
        notificationBody: "Live delivery tracking is active",
        notificationColor: "#10b981",
      },
      pausesUpdatesAutomatically: false,
    });

    this.isTracking = true;
    console.log("✅ Background tracking started");
  }

  async stopTracking(): Promise<void> {
    console.log("🛑 Stopping BACKGROUND tracking...");

    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );

      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      console.warn("LocationService.stopTracking error", e);
    }

    this.isTracking = false;
    console.log("✅ Background tracking stopped");
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  async updateConfig(cfg: { updateInterval?: number; distanceFilter?: number }) {
    try {
      const currentRaw = await AsyncStorage.getItem(CONFIG_KEY);
      const current = currentRaw ? JSON.parse(currentRaw) : {};
      const merged = { ...current, ...cfg };
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(merged));

      if (cfg.updateInterval != null) this.timeInterval = cfg.updateInterval;
      if (cfg.distanceFilter != null) this.distanceInterval = cfg.distanceFilter;

      console.log("LocationService.updateConfig applied", merged);
    } catch (e) {
      console.warn("LocationService.updateConfig failed", e);
    }
  }

  async getTrackingStatus() {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      const raw = await AsyncStorage.getItem(STATUS_KEY);
      const status = raw ? JSON.parse(raw) : {};
      return {
        isTracking: !!started,
        lastSentTime: status.lastSentTime || null,
      };
    } catch (e) {
      console.warn("LocationService.getTrackingStatus failed", e);
      return { isTracking: false, lastSentTime: null };
    }
  }

  async recordLastSentTime(ts?: string) {
    try {
      const t = ts || new Date().toISOString();
      await AsyncStorage.setItem(STATUS_KEY, JSON.stringify({ lastSentTime: t }));
    } catch (e) {
      console.warn("LocationService.recordLastSentTime failed", e);
    }
  }

  private async getBatteryLevel(): Promise<number> {
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (typeof level === "number" && !Number.isNaN(level)) {
        return Math.round(level * 100);
      }
      return 100;
    } catch (e) {
      console.warn("LocationService.getBatteryLevel: failed to read", e);
      return 100;
    }
  }

  async formatLocationForBackend(
    location: Location.LocationObject,
    riderId: string,
    riderName: string,
    riderPhone: string,
    status: string = "active"
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
      bearing: location.coords.heading || 0,
      batteryLevel:battery,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();