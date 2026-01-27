import * as Location from "expo-location";
import { LOCATION_TASK_NAME } from "./backgroundLocationTask";

export class LocationService {
  private static instance: LocationService;
  private isTracking = false;
  private cachedUser: any = null;

  private readonly DISTANCE_INTERVAL = 10;
  private readonly TIME_INTERVAL = 5000;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  setCachedUser(user: any) {
    this.cachedUser = user;
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

    const hasStarted =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (hasStarted) {
      console.log("⚠️ Background tracking already running");
      this.isTracking = true;
      return;
    }

    console.log("📍 Starting BACKGROUND tracking...");

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      distanceInterval: this.DISTANCE_INTERVAL,
      timeInterval: this.TIME_INTERVAL,
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

    const hasStarted =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    this.isTracking = false;
    console.log("✅ Background tracking stopped");
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  formatLocationForBackend(
    location: Location.LocationObject,
    riderId: string,
    riderName: string,
    riderPhone: string,
    status: string = "active",
  ) {
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
      batteryLevel: 100,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();
