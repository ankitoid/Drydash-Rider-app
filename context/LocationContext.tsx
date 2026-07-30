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
import * as IntentLauncher from "expo-intent-launcher";
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
  Linking,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  /** Whether device GPS / location services are disabled during active trip */
  isLocationDisabled: boolean;
  /** Request device to enable GPS location provider */
  enableLocationServices: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

// How often the watchdog checks if the background task & GPS services are alive (ms)
const WATCHDOG_INTERVAL = 2500; // 2.5 seconds

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
  const [isLocationDisabled, setIsLocationDisabled] = useState(false);

  const alertEmittedRef = useRef(false);

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

  /* ---------- GPS SERVICE CHECK & ADMIN ALERT ---------- */

  const checkGpsServices = async (): Promise<boolean> => {
    if (!trackingRef.current) {
      setIsLocationDisabled(false);
      alertEmittedRef.current = false;
      return true;
    }

    try {
      const enabled = await Location.hasServicesEnabledAsync();
      const { status } = await Location.getForegroundPermissionsAsync();
      const isGpsOff = !enabled || status !== "granted";

      if (isGpsOff) {
        setIsLocationDisabled(true);

        // Emit admin alert once per location turn-off event
        if (!alertEmittedRef.current && user?._id) {
          alertEmittedRef.current = true;
          console.warn("🚨 Admin Alert: Rider turned off GPS during active trip!");
          if (socket.connected) {
            socket.emit("riderLocationDisabled", {
              riderId: user._id,
              riderName: user.name || "Rider",
              phone: user.phone || "",
              reason: !enabled
                ? "GPS Provider Turned Off on Device"
                : "Location Permission Revoked",
              timestamp: Date.now(),
            });
            socket.emit("riderStatusUpdate", {
              riderId: user._id,
              status: "location_disabled",
            });
          }
        }
        return false;
      } else {
        setIsLocationDisabled(false);
        alertEmittedRef.current = false;
        return true;
      }
    } catch (err) {
      console.warn("[LocationContext] checkGpsServices failed:", err);
      return true;
    }
  };

  const enableLocationServices = async (): Promise<void> => {
    try {
      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          try {
            await IntentLauncher.startActivityAsync(
              "android.settings.LOCATION_SOURCE_SETTINGS" as any
            );
          } catch {
            await Linking.openSettings();
          }
        }
      } else {
        await Linking.openSettings();
      }
    } catch (e) {
      await Linking.openSettings();
    } finally {
      setTimeout(() => {
        checkGpsServices();
      }, 1000);
    }
  };

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
        checkGpsServices();
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

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;

    const checkAndResume = async () => {
      try {
        const wasTracking = await locationService.wasTrackingBeforeKill();
        if (cancelled || !wasTracking) return;

        console.log("🔄 Auto-resume: tracking was active before kill, restarting...");

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
        startSocketKeepalive();
        startWatchdog();
        checkGpsServices();
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

  const startWatchdog = () => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }

    watchdogRef.current = setInterval(async () => {
      if (!trackingRef.current) return;

      try {
        // Check if GPS is turned off on device
        await checkGpsServices();

        // Check native Android foreground service
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

        // Expo fallback path
        const stillRunning =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

        if (!stillRunning) {
          console.log("🚨 Watchdog: Expo task stopped unexpectedly, restarting...");
          Alert.alert(
            "⚠️ Tracking Interrupted",
            "Location tracking was stopped. Restarting automatically to ensure continuous delivery tracking.",
            [{ text: "OK" }],
          );

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
      startSocketKeepalive();
      startWatchdog();
      checkGpsServices();

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
      stopWatchdog();
      stopSocketKeepalive();

      await locationService.stopTracking();
      stopForegroundWatcher();

      trackingRef.current = false;
      setIsTracking(false);
      setIsLocationDisabled(false);
      alertEmittedRef.current = false;

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

  /* ---------- APP STATE: FOREGROUND RECOVERY & GPS CHECK ---------- */

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      console.log("📱 App state:", nextState);

      const wasBackground = appState.current.match(/inactive|background/);
      const goingBackground = nextState.match(/inactive|background/);
      const returningToForeground = nextState === "active" && wasBackground;

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

      if (returningToForeground) {
        try {
          await hideMiniWindow();
          setIsPiPActive(false);
          setIsOverlayActive(false);
        } catch (e) {
          console.warn("[LocationContext] hideMiniWindow failed:", e);
        }

        if (trackingRef.current) {
          await checkGpsServices();
          try {
            if (locationService.isUsingNativeService()) {
              const nativeRunning = await locationService.isNativeServiceRunning();
              if (!nativeRunning) {
                console.log("⚠️ Native service was killed, restarting...");
                await locationService.startTracking();
                console.log("✅ Native service restarted on foreground return");
              }
            } else {
              const stillRunning =
                await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

              if (!stillRunning) {
                console.log("⚠️ Background task was killed, restarting...");
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
    isLocationDisabled,
    enableLocationServices,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}

      {/* MANDATORY ALERT MODAL WHEN GPS IS TURNED OFF DURING ACTIVE TRIP */}
      <Modal
        visible={isTracking && isLocationDisabled}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconBadge}>
              <Ionicons name="warning" size={36} color="#DC2626" />
            </View>

            <Text style={styles.alertTitle}>
              GPS LOCATION SERVICES REQUIRED
            </Text>

            <Text style={styles.alertDescription}>
              Your device location (GPS) has been turned off during an active delivery trip. 
              Live GPS tracking is mandatory to complete orders and track route progress.
            </Text>

            <View style={styles.adminWarningBox}>
              <Ionicons name="shield-half-sharp" size={20} color="#DC2626" />
              <Text style={styles.adminWarningText}>
                🚨 Admin Notified: Turning off GPS location during an active trip is logged and reported to the administrator dashboard.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.enableGpsButton}
              onPress={enableLocationServices}
              activeOpacity={0.88}
            >
              <Ionicons name="location" size={20} color="#FFFFFF" />
              <Text style={styles.enableGpsButtonText}>Turn On Location Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  alertIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  alertDescription: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  adminWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  adminWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B",
    lineHeight: 16,
  },
  enableGpsButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  enableGpsButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
