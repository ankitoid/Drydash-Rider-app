import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
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

  const sendLocationUpdate = async (
    location: Location.LocationObject,
  ): Promise<void> => {
    console.log("📍 Checking socket and user for location update...");
    console.log("Socket connected:", socket.connected);
    console.log("User ID:", user?._id);

    if (!socket.connected || !user?._id) {
      console.log("⚠️ Not sending update - socket or user missing");
      return;
    }

    try {
      const payload = await locationService.formatLocationForBackend(
        location,
        user._id,
        user.name || "Unknown Rider",
        user.phone || "N/A",
        "active",
      );

      console.log("📍 Sending location update to server:", payload);
      socket.emit("riderLocationUpdate", payload);
      setLastLocation(location);
      setError(null);

      try {
        await AsyncStorage.setItem(
          "bg_status",
          JSON.stringify({ lastSentTime: new Date().toISOString() })
        );
      } catch (e) {
        console.warn("Failed to persist bg_status", e);
      }

    } catch (err) {
      console.error("❌ Failed to send location update:", err);
      setError("Failed to send location update");
    }
  };

  const startTracking = async (): Promise<void> => {
    if (lockRef.current) return;
    lockRef.current = true;

    try {
      if (!user?._id) {
        setError("User not logged in");
        return;
      }

      const granted = await locationService.requestPermissions();
      if (!granted) {
        setError("Location permission not granted");
        return;
      }

      locationService.setCachedUser(user);
      await AsyncStorage.setItem(
        "bg_user",
        JSON.stringify({
          id: user._id,
          name: user.name || "Unknown Rider",
          phone: user.phone || "N/A",
          bgToken: (user as any).bgToken || null,
        })
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

      console.log("✅ Live tracking enabled (background-safe)");
    } catch (err) {
      console.error("❌ startTracking failed:", err);
      setError("Failed to start tracking");
    } finally {
      lockRef.current = false;
    }
  };

  const stopTracking = async (): Promise<void> => {
    if (lockRef.current) return;
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

      console.log("🛑 Live tracking stopped by user");
    } catch (err) {
      console.error("❌ stopTracking failed:", err);
      setError("Failed to stop tracking");
    } finally {
      lockRef.current = false;
    }
  };

  const toggleTracking = async (): Promise<void> => {
    console.log("🔄 Toggling tracking...");
    if (lockRef.current) {
      console.log("⏳ toggle blocked by lock");
      return;
    }
    if (trackingRef.current) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      console.log("📱 App state changed:", nextState);

      if (nextState === "active") {
        console.log(
          "📱 App came to foreground — observing only (no auto-start).",
        );
      } else {
        console.log(
          "📱 App going to",
          nextState,
          "- leaving tracking running as started by user.",
        );
      }

      appState.current = nextState;
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      sub.remove();
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
    throw new Error("useLocation must be used inside LocationProvider");
  }
  return ctx;
};
