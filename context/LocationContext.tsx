import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { useAuth } from "./useAuth";

interface LocationContextType {
  isTracking: boolean;
  lastLocation: Location.LocationObject | null;
  toggleTracking: () => Promise<void>;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const trackingRef = useRef(false);
  const lockRef = useRef(false);

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] =
    useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- START ---------------- */

  useEffect(() => {
    const watchLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
        },
        (location) => {
          setLastLocation(location);
        },
      );
    };

    watchLocation();
  }, []);

  const startTracking = async (): Promise<void> => {
    if (lockRef.current) {
      console.log("⚠️ Start tracking already in progress");
      return;
    }
    lockRef.current = true;

    try {
      if (!user?._id) {
        setError("User not logged in");
        return;
      }

      const permissionState = await locationService.checkPermissions();

      if (permissionState === "denied") {
        Alert.alert(
          "Location Permission Required",
          "Shiptos needs location access to track deliveries. Please grant permission.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Grant Permission",
              onPress: async () => {
                // Retry after user acknowledges
                const retry = await locationService.checkPermissions();
                if (retry !== "denied") {
                  // Release lock and try again
                  lockRef.current = false;
                  await startTracking();
                } else {
                  setError("Location permission denied");
                }
              },
            },
          ],
        );
        return;
      }

      if (permissionState === "foreground") {
        Alert.alert(
          "Background Location Needed",
          "For continuous delivery tracking, please allow location access 'All the time' in the next screen.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: async () => {
                const granted =
                  await locationService.requestBackgroundPermission();
                if (granted) {
                  // Release lock and recursively call startTracking now that we have permission
                  lockRef.current = false;
                  await startTracking();
                } else {
                  setError("Background location permission denied");
                  Alert.alert(
                    "Permission Denied",
                    "Background location is required for delivery tracking. You can enable it later in Settings.",
                  );
                }
              },
            },
          ],
        );
        return;
      }

      // background granted ✅
      console.log(
        "✅ Background location permission granted, starting tracking...",
      );

      await locationService.setCachedUser(user);

      await AsyncStorage.setItem(
        "bg_user",
        JSON.stringify({
          id: user._id,
          name: user.name || "Unknown Rider",
          phone: user.phone || "N/A",
          bgToken: (user as any).bgToken || null,
        }),
      );

      await locationService.startTracking();

      if (socket.connected) {
        socket.emit("riderStatusUpdate", {
          riderId: user._id,
          status: "active",
        });
      }

      trackingRef.current = true;
      setIsTracking(true);
      setError(null);

      console.log("✅ Live tracking enabled");
    } catch (err) {
      console.error("❌ startTracking failed:", err);
      setError(err instanceof Error ? err.message : "Failed to start tracking");
      Alert.alert(
        "Tracking Error",
        "Failed to start location tracking. Please try again.",
      );
    } finally {
      lockRef.current = false;
    }
  };

  const stopTracking = async (): Promise<void> => {
    if (lockRef.current) {
      console.log("⚠️ Stop tracking already in progress");
      return;
    }
    lockRef.current = true;

    try {
      await locationService.stopTracking();

      trackingRef.current = false;
      setIsTracking(false);

      if (socket.connected && user?._id) {
        socket.emit("riderStatusUpdate", {
          riderId: user._id,
          status: "offline",
        });
      }

      console.log("🛑 Live tracking stopped");
    } catch (err) {
      console.error("❌ stopTracking failed:", err);
      setError(err instanceof Error ? err.message : "Failed to stop tracking");
    } finally {
      lockRef.current = false;
    }
  };

  /* ---------------- TOGGLE ---------------- */

  const toggleTracking = async (): Promise<void> => {
    console.log("🔄 Toggling tracking...");
    if (lockRef.current) {
      console.log("⚠️ Operation already in progress");
      return;
    }

    if (trackingRef.current) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  /* ---------------- APP STATE ---------------- */

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      console.log("📱 App state:", nextState);
      appState.current = nextState;
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
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
    throw new Error("useLocation must be used inside LocationProvider");
  }
  return ctx;
};
