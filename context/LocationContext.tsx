import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from './useAuth';
import { locationService } from '@/services/locationService';
import { socket } from '@/services/socket';

interface LocationContextType {
  isTracking: boolean;
  lastLocation: Location.LocationObject | null;
  toggleTracking: () => Promise<void>;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const trackingRef = useRef(false);

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendLocationUpdate = async (
    location: Location.LocationObject
  ): Promise<void> => {
    console.log('📍 Checking socket and user for location update...');
    console.log('Socket connected:', socket.connected);
    console.log('User ID:', user?._id);
    
    if (!socket.connected || !user?._id) {
      console.log('⚠️ Not sending update - socket or user missing');
      return;
    }

    try {
      const payload = locationService.formatLocationForBackend(
        location,
        user._id,
        user.name || 'Unknown Rider',
        user.phone || 'N/A',
        'active'
      );

      console.log('📍 Sending location update to server:', payload);
      socket.emit('riderLocationUpdate', payload);
      setLastLocation(location);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to send location update:', err);
      setError('Failed to send location update');
    }
  };

  const startTracking = async (): Promise<void> => {
    console.log('🚀 Starting location tracking...');
    if (trackingRef.current) {
      console.log('⚠️ Already tracking');
      return;
    }

    try {
      // Request permissions first
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission) {
        setError('Location permission not granted');
        return;
      }

      await locationService.startTracking(
        async (location: Location.LocationObject) => {
          console.log('📍 Got location update');
          await sendLocationUpdate(location);
        }
      );

      trackingRef.current = true;
      setIsTracking(true);
      setError(null);
      console.log('✅ Location tracking started');
    } catch (err) {
      console.error('❌ Failed to start tracking:', err);
      trackingRef.current = false;
      setIsTracking(false);
      setError('Location tracking failed: ' + (err as Error).message);
    }
  };

  const stopTracking = async (): Promise<void> => {
    console.log('🛑 Stopping location tracking...');
    if (!trackingRef.current) return;

    try {
      await locationService.stopTracking();
      
      trackingRef.current = false;
      setIsTracking(false);
      
      // Send offline status
      if (socket.connected && user?._id) {
        socket.emit('riderStatusUpdate', {
          riderId: user._id,
          status: 'offline',
          lastUpdate: new Date().toISOString(),
        });
      }
      
      console.log('✅ Location tracking stopped');
    } catch (err) {
      console.error('❌ Failed to stop tracking:', err);
      setError('Failed to stop tracking');
    }
  };

  const toggleTracking = async (): Promise<void> => {
    console.log('🔄 Toggling tracking...');
    if (trackingRef.current) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      console.log('📱 App state changed:', nextState);
      
      if (nextState === 'active' && trackingRef.current) {
        // App came to foreground, restart tracking if it was active
        console.log('📱 App came to foreground, checking tracking...');
        if (trackingRef.current) {
          await startTracking();
        }
      } else if (nextState.match(/inactive|background/) && trackingRef.current) {
        // App going to background, stop tracking
        console.log('📱 App going to background, stopping tracking...');
        await stopTracking();
      }
      
      appState.current = nextState;
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      if (trackingRef.current) {
        stopTracking();
      }
    };
  }, []);

  const value: LocationContextType = {
    isTracking,
    lastLocation,
    toggleTracking,
    error,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used inside LocationProvider');
  }
  return ctx;
};