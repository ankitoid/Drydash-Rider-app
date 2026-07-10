// services/backgroundLocationTask.ts
import { locationService } from "@/services/locationService";
import { sendRiderLocationUpdate } from "@/services/riderLocationUpdate";
import { trackingLegService } from "@/services/trackingLegService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

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

  console.log("BG sending location:", payload.location, taskTracking, "time===>>> ", (new Date().toISOString()));

  try {
    const result = await sendRiderLocationUpdate({
      riderId: user.id,
      lat: payload.location.lat,
      lng: payload.location.lng,
      speed: payload.speed,
      bearing: payload.bearing,
      batteryLevel: payload.batteryLevel,
      status: "active",
      taskTracking,
    });
    console.log(
      result.sentViaSocket
        ? "BG: sent via socket"
        : "BG: sent via HTTP fallback",
    );
  } catch (e) {
    console.error("BG: location update failed", e);
  }

  try {
    await locationService.recordLastSentTime();
  } catch {
    // non-critical
  }
});
