import { API_V1_BASE_URL } from "@/constants/apiConfig";
import { socket } from "@/services/socket";
import { AppState } from "react-native";

export type RiderLocationUpdatePayload = {
  riderId: string;
  lat: number;
  lng: number;
  speed?: number;
  bearing?: number;
  batteryLevel?: number;
  status?: string;
  taskTracking?: unknown;
};

export const sendRiderLocationUpdate = async ({
  riderId,
  lat,
  lng,
  speed = 0,
  bearing = 0,
  batteryLevel = 100,
  status = "active",
  taskTracking = null,
}: RiderLocationUpdatePayload) => {
  const emittedAt = new Date().toISOString();
  const payload = {
    riderId,
    location: { lat, lng },
    lat,
    lng,
    speed,
    bearing,
    batteryLevel,
    status,
    taskTracking,
  };

  // ── When app is in background, socket is unreliable (JS thread suspended).
  // Always use HTTP POST directly — the native foreground service already does this
  // for Android, but the Expo fallback task still goes through this path. ──
  const appState = AppState.currentState;
  if (appState !== "active") {
    try {
      await postLocationHTTP(payload, riderId);
      return { sentViaSocket: false, sentViaHttp: true };
    } catch (e) {
      console.warn("[RIDER_LOCATION_BG_HTTP_FAIL] background HTTP POST failed:", e);
      return { sentViaSocket: false, sentViaHttp: false };
    }
  }

  // ── Foreground: prefer socket for lower latency, fallback to HTTP ──
  console.log(
    `[RIDER_LOCATION_EMIT] ${emittedAt} rider=${riderId} lat=${lat} lng=${lng} speed=${speed} bearing=${bearing} socketConnected=${socket.connected}`,
  );

  if (socket.connected) {
    socket.emit("riderLocationUpdate", payload);
    console.log(
      `[RIDER_LOCATION_SOCKET] ${emittedAt} rider=${riderId} emitted riderLocationUpdate`,
    );
    return { sentViaSocket: true, sentViaHttp: false };
  }

  console.log(
    `[RIDER_LOCATION_HTTP] ${emittedAt} rider=${riderId} posting fallback to ${API_V1_BASE_URL}/location/update`,
  );

  try {
    await postLocationHTTP(payload, riderId);
    return { sentViaSocket: false, sentViaHttp: true };
  } catch (e) {
    console.error("[RIDER_LOCATION_HTTP_FAIL] foreground HTTP fallback failed:", e);
    // Try reconnecting socket for next update
    try {
      socket.connect();
      socket.once("connect", () => {
        socket.emit("joinRider", { riderId });
      });
    } catch {
      // best-effort
    }
    return { sentViaSocket: false, sentViaHttp: false };
  }
};

/** Send location via HTTP POST to the backend (with one retry for transient errors) */
async function postLocationHTTP(payload: Record<string, unknown>, riderId: string, isRetry = false) {
  const res = await fetch(`${API_V1_BASE_URL}/location/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Retry once for transient server errors (502/503/504)
    if (!isRetry && [502, 503, 504].includes(res.status)) {
      console.warn(
        `[RIDER_LOCATION_HTTP] ${res.status} — retrying in 2s...`,
      );
      await new Promise((r) => setTimeout(r, 2000));
      return postLocationHTTP(payload, riderId, true);
    }
    throw new Error(`Location HTTP POST failed with status ${res.status}`);
  }

  console.log(
    `[RIDER_LOCATION_HTTP_OK] ${new Date().toISOString()} rider=${riderId} status=${res.status}`,
  );
}
