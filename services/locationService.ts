// services/locationService.ts
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export class LocationService {
  private static instance: LocationService;
  private watchId: Location.LocationSubscription | null = null;
  private lastSentTimestamp = 0;
  private readonly UPDATE_INTERVAL = 60000; // 60 seconds
  private readonly DISTANCE_INTERVAL = 10; // 10 meters
  private isTracking = false;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  async startTracking(
    onLocationUpdate: (location: Location.LocationObject) => void
  ): Promise<void> {
    if (this.isTracking) {
      console.log('Location tracking already started');
      return;
    }

    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Location permission not granted');
        }
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: this.DISTANCE_INTERVAL,
          timeInterval: this.UPDATE_INTERVAL,
        },
        (location) => {
          const now = Date.now();
          // Ensure we send at most once per minute
          if (now - this.lastSentTimestamp >= this.UPDATE_INTERVAL) {
            onLocationUpdate(location);
            this.lastSentTimestamp = now;
          }
        }
      );

      this.isTracking = true;
      console.log('📍 Location tracking started (60s interval)');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }

    this.isTracking = false;
    console.log('📍 Location tracking stopped');
  }

  formatLocationForBackend(
    location: Location.LocationObject,
    riderId: string,
    riderName: string,
    riderPhone: string,
    status: string = 'active'
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
      accuracy: location.coords.accuracy,
      status,
      timestamp: new Date().toISOString(),
    };
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }
}

export const locationService = LocationService.getInstance();