import { locationService } from "@/services/locationService";
import { LOCATION_TASK_NAME } from "@/services/backgroundLocationTask";
import { promptBatteryOptimization } from "@/services/batteryOptimization";
import { socket } from "@/services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
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

// How often the watchdog checks if the background task is alive (ms)
const WATCHDOG_INTERVAL = 15000; // 15 seconds

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const trackingRef = useRef(false);
  const lockRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] =
    useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---------- FOREGROUND WATCHER (UI only) ---------- */

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

  /* ---------- AUTO-RESUME ON APP REOPEN ---------- */
  //
  // If the OS killed the app while tracking was active, and the user
  // reopens the app, automatically restart background tracking.

  useEffect(() => {
    if (!user?._id) return;

    const checkAndResume = async () => {
      try {
        const wasTracking = await locationService.wasTrackingBeforeKill();
        if (!wasTracking) return;

        console.log("🔄 Auto-resume: tracking was active before kill, restarting...");

        // Ensure user data is in AsyncStorage for the background task
        await locationService.setCachedUser(user);

        const alreadyRunning =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

        if (!alreadyRunning) {
          await locationService.startTracking();
        }

        if (socket.connected) {
          socket.emit("riderStatusUpdate", {
            riderId: user._id,
            status: "active",
          });
        }

        trackingRef.current = true;
        setIsTracking(true);
        startWatchdog(); // Start the watchdog after auto-resume
        console.log("✅ Auto-resume: tracking restored");
      } catch (err) {
        console.error("❌ Auto-resume failed:", err);
      }
    };

    checkAndResume();
  }, [user?._id]);

  /* ---------- WATCHDOG ---------- */
  //
  // Periodically checks if the background task is still running.
  // If someone dismisses the notification or OS kills the service,
  // the watchdog detects it, shows an alert, and restarts tracking.

  const startWatchdog = () => {
    // Clear any existing watchdog
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }

    watchdogRef.current = setInterval(async () => {
      if (!trackingRef.current) return; // Not supposed to be tracking

      try {
        const stillRunning =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

        if (!stillRunning) {
          console.log("🚨 Watchdog: tracking stopped unexpectedly, restarting...");

          // Show alert to user
          Alert.alert(
            "⚠️ Tracking Interrupted",
            "Location tracking was stopped. Restarting automatically to ensure continuous delivery tracking. Please do not dismiss the tracking notification.",
            [{ text: "OK" }],
          );

          // Auto-restart
          try {
            await locationService.startTracking();
            console.log("✅ Watchdog: tracking restarted successfully");
          } catch (restartErr) {
            console.error("❌ Watchdog: failed to restart tracking", restartErr);
          }
        }
      } catch (err) {
        console.error("❌ Watchdog check failed:", err);
      }
    }, WATCHDOG_INTERVAL);
  };

  const stopWatchdog = () => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  // Cleanup watchdog on unmount
  useEffect(() => {
    return () => stopWatchdog();
  }, []);

  /* ---------- START TRACKING ---------- */

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

      // Prompt user to disable battery optimization (like Google Maps does)
      // This is the #1 reason background tracking gets killed on Android
      const batteryPrompted = await AsyncStorage.getItem("battery_opt_prompted");
      if (Platform.OS === "android" && !batteryPrompted) {
        await promptBatteryOptimization();
        await AsyncStorage.setItem("battery_opt_prompted", "true");
      }

      await locationService.setCachedUser(user);

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

      // Start the watchdog to guard against notification dismissal
      startWatchdog();

      console.log("✅ Live tracking enabled (foreground service + watchdog active)");
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

  /* ---------- STOP TRACKING ---------- */

  const stopTracking = async (): Promise<void> => {
    if (lockRef.current) {
      console.log("⚠️ Stop tracking already in progress");
      return;
    }
    lockRef.current = true;

    try {
      // Stop watchdog first
      stopWatchdog();

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

  /* ---------- TOGGLE ---------- */

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

  /* ---------- APP STATE: FOREGROUND RECOVERY ---------- */
  //
  // When the user brings the app back to the foreground, check if
  // the background task is still alive. If the OS killed it, restart.

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      console.log("📱 App state:", nextState);

      if (
        nextState === "active" &&
        appState.current.match(/inactive|background/) &&
        trackingRef.current
      ) {
        // App returning to foreground while tracking should be active
        try {
          const stillRunning =
            await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

          if (!stillRunning) {
            console.log(
              "⚠️ Background task was killed, restarting...",
            );

            Alert.alert(
              "⚠️ Tracking Restarted",
              "Location tracking was interrupted while in the background. It has been automatically restarted.",
              [{ text: "OK" }],
            );

            await locationService.startTracking();
            console.log("✅ Background task restarted on foreground return");
          }
        } catch (err) {
          console.error("❌ Foreground recovery failed:", err);
        }
      }

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
