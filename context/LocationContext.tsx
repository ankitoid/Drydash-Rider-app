// context/LocationContext.tsx
import { locationService } from '@/services/locationService';
import { socket } from '@/services/socket';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './useAuth';

interface LocationContextType {
  isTracking: boolean;
  lastLocation?: any;
  toggleTracking: any;
  error?: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const appState = useRef(AppState.currentState);
  const isTracking = useRef(false);
  const lastLocationRef = useRef<any>(null);
  const errorRef = useRef<string | null>(null);

  // Send location update to backend via socket
  const sendLocationUpdate = async (location: any) => {
    if (!socket.connected || !user?._id) {
      console.log('Socket not connected or user not available');
      errorRef.current = 'Socket not connected';
      return;
    }

    try {
      const locationData = locationService.formatLocationForBackend(
        location,
        user._id,
        user.name,
        user.phone,
        'active'
      );

      socket.emit('riderLocationUpdate', locationData);
      lastLocationRef.current = locationData;
      errorRef.current = null;
      console.log('📍 Location update sent to backend:', {
        rider: user.name,
        lat: locationData.location.lat.toFixed(6),
        lng: locationData.location.lng.toFixed(6),
        backend: 'https://rider-app-testing.onrender.com'
      });
    } catch (err) {
      console.error('Error sending location update:', err);
      errorRef.current = err instanceof Error ? err.message : 'Failed to send location';
    }
  };

  // Initialize location tracking
  const startTracking = async () => {
    if (isTracking.current) {
      console.log('Location tracking already started');
      return;
    }
    
    try {
      errorRef.current = null;
      await locationService.startTracking(async (location) => {
        await sendLocationUpdate(location);
      });

      isTracking.current = true;

      // Send initial location
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        await sendLocationUpdate(currentLocation);
      } catch (locError) {
        console.error('Error getting initial location:', locError);
      }

    } catch (err: any) {
      console.error('Failed to start location tracking:', err);
      errorRef.current = err.message || 'Failed to start tracking';
      isTracking.current = false;
    }
  };

  // Stop location tracking
  const stopTracking = async () => {
    if (!isTracking.current) return;
    
    try {
      await locationService.stopTracking();
      isTracking.current = false;
      
      // Notify backend that rider is offline
      if (socket.connected && user?._id) {
        socket.emit('riderStatusUpdate', {
          riderId: user._id,
          status: 'offline',
          lastUpdate: new Date().toISOString(),
        });
      }
      errorRef.current = null;
    } catch (err: any) {
      console.error('Error stopping tracking:', err);
      errorRef.current = err.message || 'Failed to stop tracking';
    }
  };

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && !isTracking.current) {
        // App came to foreground, restart tracking if needed
        await startTracking();
      } else if (nextAppState.match(/inactive|background/) && isTracking.current) {
        // App went to background, stop tracking
        await stopTracking();
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated]);

  // Start tracking when rider is authenticated
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      console.log('🔑 Rider authenticated, starting location tracking:', user.name);
      // Small delay to ensure socket is connected
      const timer = setTimeout(() => {
        startTracking();
      }, 2000);

      return () => {
        clearTimeout(timer);
        if (isTracking.current) {
          stopTracking();
        }
      };
    }
  }, [isAuthenticated, user?._id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTracking.current) {
        stopTracking();
      }
    };
  }, []);

  const value: LocationContextType = {
    isTracking: isTracking.current,
    lastLocation: lastLocationRef.current,
    error: errorRef.current,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};