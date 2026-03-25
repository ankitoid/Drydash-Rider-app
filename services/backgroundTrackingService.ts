// services/backgroundTrackingService.ts
//
// Uses react-native-background-actions to create a TRULY persistent foreground
// service — exactly like Google Maps. The notification cannot be dismissed,
// the service cannot be killed by Android, and it runs JS code in a loop.

import BackgroundService from "react-native-background-actions";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { socket } from "@/services/socket";

const API_BASE = "https://api.drydash.in";
const BG_USER_KEY = "bg_user";
const WAS_TRACKING_KEY = "was_tracking";

/**
 * The actual background task that runs in a loop inside the foreground service.
 * This function never returns as long as tracking is active.
 */
const trackingTask = async (taskDataArguments: any) => {
    const { delay } = taskDataArguments;

    // This loop runs indefinitely inside the foreground service
    await new Promise<void>(async (resolve) => {
        while (BackgroundService.isRunning()) {
            try {
                // 1. Get user from AsyncStorage
                let user: any = null;
                try {
                    const raw = await AsyncStorage.getItem(BG_USER_KEY);
                    if (raw) user = JSON.parse(raw);
                } catch (e) {
                    console.warn("⚠️ BG Service: failed to read user", e);
                }

                if (!user?.id) {
                    console.log("⚠️ BG Service: no user, waiting...");
                    await sleep(delay);
                    continue;
                }

                // 2. Get current location
                let location: Location.LocationObject;
                try {
                    location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.BestForNavigation,
                    });
                } catch (locErr) {
                    console.warn("⚠️ BG Service: location fetch failed", locErr);
                    await sleep(delay);
                    continue;
                }

                const payload = {
                    riderId: user.id,
                    name: user.name || "Unknown Rider",
                    phone: user.phone || "N/A",
                    location: {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                    },
                    speed: location.coords.speed ? location.coords.speed * 3.6 : 0,
                    bearing: location.coords.heading ?? 0,
                    batteryLevel: 100,
                    status: "active",
                    timestamp: new Date().toISOString(),
                };

                // 3. Try socket first
                let sentViaSocket = false;
                try {
                    if (socket.connected) {
                        socket.emit("riderLocationUpdate", payload);
                        sentViaSocket = true;
                        console.log("✅ BG Service: sent via socket", payload.location);
                    }
                } catch (e) {
                    console.warn("⚠️ BG Service: socket.emit failed", e);
                }

                // 4. Fall back to HTTP if socket dead
                if (!sentViaSocket) {
                    try {
                        const res = await fetch(`${API_BASE}/api/v1/location/update`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                riderId: user.id,
                                lat: payload.location.lat,
                                lng: payload.location.lng,
                                speed: payload.speed,
                                bearing: payload.bearing,
                                batteryLevel: payload.batteryLevel,
                                status: "active",
                            }),
                        });

                        if (res.ok) {
                            console.log("✅ BG Service: sent via HTTP", payload.location);
                        } else {
                            console.warn("⚠️ BG Service: HTTP returned", res.status);
                        }
                    } catch (httpErr) {
                        console.error("❌ BG Service: HTTP failed", httpErr);
                    }

                    // Try reconnecting socket for next iteration
                    try {
                        if (!socket.connected) {
                            socket.connect();
                            socket.emit("joinRider", { riderId: user.id });
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                // Update the notification with live info
                try {
                    await BackgroundService.updateNotification({
                        taskDesc: `📍 Sharing location (${new Date().toLocaleTimeString()})`,
                    });
                } catch (e) {
                    // non-critical
                }
            } catch (err) {
                console.error("❌ BG Service: loop error", err);
            }

            // Wait before next update
            await sleep(delay);
        }
    });
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Notification + service configuration.
 * This is what makes it behave like Google Maps.
 */
const options = {
    taskName: "ShiptosTracking",
    taskTitle: "🟢 Shiptos tracking active",
    taskDesc: "Live delivery location is being shared",
    taskIcon: {
        name: "ic_launcher",
        type: "mipmap",
    },
    color: "#10b981",
    linkingURI: "drydashrider://",
    parameters: {
        delay: 10000, // 10 seconds between updates
    },
    // Android-specific settings
    foregroundServiceType: "location",
    notificationChannelId: "location-tracking",
};

/**
 * Start the persistent background tracking service.
 * Creates a non-dismissable foreground notification (like Google Maps).
 */
export async function startBackgroundTracking(): Promise<void> {
    if (BackgroundService.isRunning()) {
        console.log("⚠️ Background tracking service already running");
        return;
    }

    try {
        await BackgroundService.start(trackingTask, options);
        await AsyncStorage.setItem(WAS_TRACKING_KEY, "true");
        console.log("✅ Background tracking service started (persistent foreground service)");
    } catch (err) {
        console.error("❌ Failed to start background tracking service:", err);
        throw err;
    }
}

/**
 * Stop the persistent background tracking service.
 */
export async function stopBackgroundTracking(): Promise<void> {
    try {
        await BackgroundService.stop();
        await AsyncStorage.removeItem(WAS_TRACKING_KEY);
        console.log("✅ Background tracking service stopped");
    } catch (err) {
        console.error("❌ Failed to stop background tracking service:", err);
    }
}

/**
 * Check if the background tracking service is currently running.
 */
export function isBackgroundTrackingRunning(): boolean {
    return BackgroundService.isRunning();
}

/**
 * Check if tracking was active before the app was killed.
 */
export async function wasTrackingActive(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(WAS_TRACKING_KEY);
        return val === "true";
    } catch {
        return false;
    }
}
