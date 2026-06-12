// services/socket.ts
import { io } from "socket.io-client";

const SOCKET_URL = "https://api.shiptos.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
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
