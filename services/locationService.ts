import * as Location from 'expo-location';

export class LocationService {
  private static instance: LocationService;
  private watchId: Location.LocationSubscription | null = null;
  private lastSentTimestamp = 0;
  private readonly UPDATE_INTERVAL = 60000; // 60 seconds
  private readonly DISTANCE_INTERVAL = 10;
  private isTracking = false;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      console.log('🔍 Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('✅ Permission status:', status);
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error requesting location permissions:', error);
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
      console.log('⚠️ Location tracking already started');
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

      console.log('📍 Starting location watcher...');
      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: this.DISTANCE_INTERVAL,
          timeInterval: 1000,
        },
        (location) => {
          const now = Date.now();
          if (now - this.lastSentTimestamp >= this.UPDATE_INTERVAL) {
            console.log('📍 Sending location update (60s interval)');
            onLocationUpdate(location);
            this.lastSentTimestamp = now;
          }
        }
      );

      this.isTracking = true;
      console.log('✅ Location tracking started (60s interval)');
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    console.log('🛑 Stopping location watcher...');
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }

    this.isTracking = false;
    this.lastSentTimestamp = 0;
    console.log('✅ Location tracking stopped');
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
      batteryLevel: 100, // You can get this from expo-battery if needed
      status,
      timestamp: new Date().toISOString(),
    };
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }
}

export const locationService = LocationService.getInstance();