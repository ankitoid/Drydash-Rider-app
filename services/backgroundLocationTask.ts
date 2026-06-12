// services/backgroundLocationTask.ts
import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import { trackingLegService } from "@/services/trackingLegService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

const API_BASE = "https://api.shiptos.com";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }

  if (!data?.locations?.length) return;

  const location = data.locations[0];

  let user: any = null;
  try {
    const raw = await AsyncStorage.getItem("bg_user");
    if (raw) user = JSON.parse(raw);
  } catch (e) {
    console.warn("BG task: failed to read bg_user from AsyncStorage", e);
  }

  if (!user?.id) {
    console.log("BG task: no user in AsyncStorage, skipping");
    return;
  }

  const payload = await locationService.formatLocationForBackend(
    location,
    user.id,
    user.name || "Unknown Rider",
    user.phone || "N/A",
    "active",
  );

  const trackingResult = await trackingLegService.recordLocation(location);
  const activeLeg = trackingResult.leg;
  const taskTracking = activeLeg
    ? {
        trackingLegId: activeLeg.id,
        taskId: activeLeg.taskId,
        taskType: activeLeg.type,
        totalDistanceKm: activeLeg.totalDistanceKm,
        distanceFromPreviousKm: trackingResult.distanceFromPreviousKm,
        destination: activeLeg.destination,
      }
    : null;

  console.log("BG sending location:", payload.location, taskTracking);

  let sentViaSocket = false;
  try {
    if (socket.connected) {
      socket.emit("riderLocationUpdate", {
        ...payload,
        taskTracking,
      });
      sentViaSocket = true;
      console.log("BG: sent via socket");
    }
  } catch (e) {
    console.warn("BG: socket.emit failed", e);
  }

  if (!sentViaSocket) {
    try {
      console.log("BG: socket dead, using HTTP fallback...");
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
          taskTracking,
        }),
      });

      if (res.ok) {
        console.log("BG: sent via HTTP fallback");
      } else {
        console.warn("BG: HTTP fallback returned", res.status);
      }
    } catch (httpErr) {
      console.error("BG: HTTP fallback failed", httpErr);
    }

    try {
      if (!socket.connected) {
        socket.connect();
        socket.once("connect", () => {
          socket.emit("joinRider", { riderId: user.id });
        });
      }
    } catch {
      // Socket reconnect is best-effort in the background task.
    }
  }

  try {
    await locationService.recordLastSentTime();
  } catch {
    // non-critical
  }
});
