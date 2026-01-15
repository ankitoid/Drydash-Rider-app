import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://api.drydash.in";

export const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
});