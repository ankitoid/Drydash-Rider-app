// services/backgroundLocationTask.ts
import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

const API_BASE = "https://api.drydash.in";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("❌ Background location task error:", error);
    return;
  }

  if (!data?.locations?.length) return;

  const location = data.locations[0];

  // ── 1. Get rider from AsyncStorage (survives process kill) ──
  let user: any = null;
  try {
    const raw = await AsyncStorage.getItem("bg_user");
    if (raw) user = JSON.parse(raw);
  } catch (e) {
    console.warn("⚠️ BG task: failed to read bg_user from AsyncStorage", e);
  }

  if (!user?.id) {
    console.log("⚠️ BG task: no user in AsyncStorage, skipping");
    return;
  }

  const payload = await locationService.formatLocationForBackend(
    location,
    user.id,
    user.name || "Unknown Rider",
    user.phone || "N/A",
    "active",
  );

  console.log("📡 BG sending location:", payload.location);

  // ── 2. Try socket first (fast path) ──
  let sentViaSocket = false;
  try {
    if (socket.connected) {
      socket.emit("riderLocationUpdate", payload);
      sentViaSocket = true;
      console.log("✅ BG: sent via socket");
    }
  } catch (e) {
    console.warn("⚠️ BG: socket.emit failed", e);
  }

  // ── 3. Fall back to HTTP POST if socket is dead ──
  if (!sentViaSocket) {
    try {
      console.log("📡 BG: socket dead, using HTTP fallback...");
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
        console.log("✅ BG: sent via HTTP fallback");
      } else {
        console.warn("⚠️ BG: HTTP fallback returned", res.status);
      }
    } catch (httpErr) {
      console.error("❌ BG: HTTP fallback failed", httpErr);
    }

    // Try reconnecting socket for next time
    try {
      if (!socket.connected) {
        socket.connect();
        socket.emit("joinRider", { riderId: user.id });
      }
    } catch (e) {
      // ignore reconnect errors
    }
  }

  // Record timestamp for debugging
  try {
    await locationService.recordLastSentTime();
  } catch (e) {
    // non-critical
  }
});
