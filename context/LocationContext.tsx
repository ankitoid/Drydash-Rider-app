import { locationService } from "@/services/locationService";
import { LOCATION_TASK_NAME } from "@/services/backgroundLocationTask";
import { sendRiderLocationUpdate } from "@/services/riderLocationUpdate";
import { socket, startSocketKeepalive, stopSocketKeepalive } from "@/services/socket";
import {
  startLocationSharingFlow,
  stopLocationSharingFlow,
} from "@/services/NavigationService";
import { showMiniWindow, hideMiniWindow, getActiveMiniWindow } from "@/services/OverlayManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  InteractionManager,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import { useAuth } from "./useAuth";

interface LocationContextType {
  isTracking: boolean;
  lastLocation: Location.LocationObject | null;
  toggleTracking: () => Promise<void>;
  error: string | null;
  /** Whether a PiP window is currently active */
  isPiPActive: boolean;
  /** Whether a floating overlay is currently active */
  isOverlayActive: boolean;
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
  const nativeTrackingEmitter = useMemo(() => {
    const { RiderTrackingModule } = NativeModules;
    return RiderTrackingModule
      ? new NativeEventEmitter(RiderTrackingModule)
      : null;
  }, []);

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] =
    useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isOverlayActive, setIsOverlayActive] = useState(false);

  useEffect(() => {
    const sub = nativeTrackingEmitter?.addListener(
      "onLocationUpdate",
      async (loc) => {
        const lat = Number(loc?.latitude);
        const lng = Number(loc?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !user?._id) {
          return;
        }

        setLastLocation({
          coords: {
            latitude: lat,
            longitude: lng,
            altitude: null,
            accuracy: loc?.accuracy ?? null,
            altitudeAccuracy: null,
            heading: loc?.bearing ?? 0,
            speed: loc?.speed ?? 0,
          },
          timestamp: loc?.timestamp ?? Date.now(),
        });

        if (Platform.OS !== "android") {
          try {
            await sendRiderLocationUpdate({
              riderId: user._id,
              lat,
              lng,
              speed: loc?.speed ?? 0,
              bearing: loc?.bearing ?? 0,
              batteryLevel: loc?.batteryLevel ?? 100,
              status: "active",
            });
          } catch (err) {
            console.warn("Native location forwarding failed:", err);
          }
        }
        console.log("Native location received:", loc);
      });
    return () => sub?.remove();
  }, [nativeTrackingEmitter, user?._id]);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const trackingRef = useRef(false);
  const lockRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foregroundSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);

  /* ---------- FOREGROUND LOCATION ---------- */

  const stopForegroundWatcher = () => {
    foregroundSubscriptionRef.current?.remove();
    foregroundSubscriptionRef.current = null;
  };

  const startForegroundWatcher = async () => {
    if (foregroundSubscriptionRef.current) return;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return;

    foregroundSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
        timeInterval: 15000,
      },
      (location) => {
        setLastLocation(location);
      },
    );
  };

  useEffect(() => {
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getLastKnownPositionAsync();
      if (!cancelled && location) {
        setLastLocation(location);
      }
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  /* ---------- AUTO-RESUME ON APP REOPEN ---------- */
  //
  // If the OS killed the app while tracking was active, and the user
  // reopens the app, automatically restart background tracking.

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;

    const checkAndResume = async () => {
      try {
        const wasTracking = await locationService.wasTrackingBeforeKill();
        if (cancelled || !wasTracking) return;

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
        await startForegroundWatcher();
        startSocketKeepalive(); // keep socket alive in background
        startWatchdog(); // Start the watchdog after auto-resume
        console.log("✅ Auto-resume: tracking restored");
      } catch (err) {
        console.error("❌ Auto-resume failed:", err);
      }
    };

    const task = InteractionManager.runAfterInteractions(checkAndResume);

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [user?._id]);

  /* ---------- WATCHDOG ---------- */
  //
  // Periodically checks if tracking is still running.
  // On Android with the native foreground service, we check the native
  // service state (NOT the Expo task, which isn't used in that mode).
  // On other platforms / Expo fallback, we check the Expo background task.

  const startWatchdog = () => {
    // Clear any existing watchdog
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }

    watchdogRef.current = setInterval(async () => {
      if (!trackingRef.current) return; // Not supposed to be tracking

      try {
        // ── Native Android path: check the foreground service directly ──
        if (locationService.isUsingNativeService()) {
          const nativeRunning = await locationService.isNativeServiceRunning();
          if (!nativeRunning) {
            console.log("🚨 Watchdog: native service stopped, restarting...");
            try {
              await locationService.startTracking();
              console.log("✅ Watchdog: native tracking restarted");
            } catch (restartErr) {
              console.error("❌ Watchdog: failed to restart native tracking", restartErr);
            }
          }
          return;
        }

        // ── Expo fallback path: check the background task ──
        const stillRunning =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

        if (!stillRunning) {
          console.log("🚨 Watchdog: Expo task stopped unexpectedly, restarting...");

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
    return () => {
      stopWatchdog();
      stopForegroundWatcher();
      stopSocketKeepalive();
    };
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

      // ── Run the full 9-step permission + service orchestration ──
      const result = await startLocationSharingFlow({
        _id: user._id,
        name: user.name,
        phone: user.phone,
      });

      if (!result.success) {
        console.warn(`[LocationContext] startLocationSharingFlow stopped at step "${result.step}": ${result.reason}`);
        setError(result.reason);
        return;
      }

      // Emit socket status update
      if (socket.connected) {
        socket.emit("riderStatusUpdate", {
          riderId: user._id,
          status: "active",
        });
      }

      trackingRef.current = true;
      setIsTracking(true);
      setError(null);
      await startForegroundWatcher();

      // Start the socket keepalive so the connection stays alive in the background
      startSocketKeepalive();

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

      // Stop the socket keepalive
      stopSocketKeepalive();

      await locationService.stopTracking();
      stopForegroundWatcher();

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

  /* ---------- APP STATE: FOREGROUND RECOVERY + MINI-WINDOW ---------- */
  //
  // When the app goes to background: show PiP or floating overlay.
  // When the app returns to foreground: dismiss the mini-window and check
  // if tracking is still alive. If the OS killed it, restart.

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      console.log("📱 App state:", nextState);

      const wasBackground = appState.current.match(/inactive|background/);
      const goingBackground = nextState.match(/inactive|background/);
      const returningToForeground = nextState === "active" && wasBackground;

      // ── Going to background: show mini-window ────────────────────────────
      if (goingBackground && nextState !== "inactive" && trackingRef.current) {
        try {
          await showMiniWindow();
          const active = getActiveMiniWindow();
          setIsPiPActive(active === "pip");
          setIsOverlayActive(active === "overlay");
        } catch (e) {
          console.warn("[LocationContext] showMiniWindow failed:", e);
        }
      }

      // ── Returning to foreground ───────────────────────────────────────────
      if (returningToForeground) {
        // Dismiss mini-window
        try {
          await hideMiniWindow();
          setIsPiPActive(false);
          setIsOverlayActive(false);
        } catch (e) {
          console.warn("[LocationContext] hideMiniWindow failed:", e);
        }

        // Check if tracking is still alive
        if (trackingRef.current) {
          try {
            // ── Native Android path: check the foreground service directly ──
            if (locationService.isUsingNativeService()) {
              const nativeRunning = await locationService.isNativeServiceRunning();
              if (!nativeRunning) {
                console.log("⚠️ Native service was killed, restarting...");
                await locationService.startTracking();
                console.log("✅ Native service restarted on foreground return");
              }
            } else {
              // ── Expo fallback path: check the background task ──
              const stillRunning =
                await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

              if (!stillRunning) {
                console.log("⚠️ Background task was killed, restarting...");

                Alert.alert(
                  "⚠️ Tracking Restarted",
                  "Location tracking was interrupted while in the background. It has been automatically restarted.",
                  [{ text: "OK" }],
                );

                await locationService.startTracking();
                console.log("✅ Background task restarted on foreground return");
              }
            }
          } catch (err) {
            console.error("❌ Foreground recovery failed:", err);
          }
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
    isPiPActive,
    isOverlayActive,
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
