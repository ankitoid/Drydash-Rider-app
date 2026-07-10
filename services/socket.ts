// services/socket.ts
import { API_BASE_URL } from "@/constants/apiConfig";
import { io } from "socket.io-client";

const SOCKET_URL = API_BASE_URL;

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
  // Send a ping every 25s so the server doesn't drop the connection while
  // the app is in the background. socket.io uses engine.io ping/pong under
  // the hood; setting a low pingInterval here nudges the client to stay chatty.
  pingInterval: 25000,
  pingTimeout: 20000,
});

socket.onAnyOutgoing((event, ...args) => {
});

socket.onAny((event, ...args) => {
});

socket.on("connect", () => {
  console.log("🟢 [CLIENT] connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 [CLIENT] disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.log("❌ [CLIENT] connect_error:", err.message);
});

/**
 * Application-level keepalive. Even though socket.io has its own ping/pong,
 * some load balancers / reverse proxies drop idle WS connections faster than
 * the engine.io interval. Emitting a lightweight "ping" event every 25s keeps
 * the connection visibly active while in the background.
 */
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

export const startSocketKeepalive = () => {
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(() => {
    try {
      if (socket.connected) {
        socket.emit("ping");
      }
    } catch {
      // best-effort
    }
  }, 25000);
  console.log("🔁 [SOCKET] keepalive started (25s interval)");
};

export const stopSocketKeepalive = () => {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
    console.log("🛑 [SOCKET] keepalive stopped");
  }
};
