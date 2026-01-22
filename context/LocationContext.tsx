// context/LocationContext.tsx
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
  const { user, isAuthenticated } = useAuth();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const trackingRef = useRef(false);

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] =
    useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendLocationUpdate = async (
    location: Location.LocationObject
  ): Promise<void> => {
    if (!socket.connected || !user?._id) return;

    try {
      const payload = locationService.formatLocationForBackend(
        location,
        user._id,
        user.name,
        user.phone,
        'active'
      );

      socket.emit('riderLocationUpdate', payload);
      setLastLocation(location);
    } catch (err) {
      console.error(err);
      setError('Failed to send location update');
    }
  };
  const startTracking = async (): Promise<void> => {
    if (trackingRef.current) return;

    try {
      await locationService.startTracking(
        async (location: Location.LocationObject) => {
          await sendLocationUpdate(location);
        }
      );

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      await sendLocationUpdate(currentLocation);

      trackingRef.current = true;
      setIsTracking(true);
      setError(null);
    } catch (err) {
      console.error(err);
      trackingRef.current = false;
      setIsTracking(false);
      setError('Location tracking failed');
    }
  };

  const stopTracking = async (): Promise<void> => {
    if (!trackingRef.current) return;

    try {
      await locationService.stopTracking();

      trackingRef.current = false;
      setIsTracking(false);

      if (socket.connected && user?._id) {
        socket.emit('riderStatusUpdate', {
          riderId: user._id,
          status: 'offline',
          lastUpdate: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to stop tracking');
    }
  };

  const toggleTracking = async (): Promise<void> => {
    if (trackingRef.current) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  useEffect(() => {
    const handleAppStateChange = async (
      nextState: AppStateStatus
    ) => {
      if (
        nextState === 'active' &&
        isAuthenticated &&
        !trackingRef.current
      ) {
        await startTracking();
      }

      if (
        nextState.match(/inactive|background/) &&
        trackingRef.current
      ) {
        await stopTracking();
      }

      appState.current = nextState;
    };

    const sub = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => sub.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    const timer = setTimeout(startTracking, 1500);

    return () => {
      clearTimeout(timer);
      stopTracking();
    };
  }, [isAuthenticated, user?._id]);

  useEffect(() => {
    return () => {
      stopTracking();
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
    throw new Error(
      'useLocation must be used inside LocationProvider'
    );
  }
  return ctx;
};