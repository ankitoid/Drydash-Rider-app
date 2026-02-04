// services/socket.ts
import { io } from "socket.io-client";

const SOCKET_URL = "https://api.drydash.in";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"], // 🔥 force websocket (important)
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  timeout: 20000,
});

socket.onAny((event, ...args) => {
  console.log("📩 [CLIENT onAny]", event, JSON.stringify(args));
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
