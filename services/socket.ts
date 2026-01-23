// services/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://rider-app-testing.onrender.com';

export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Enable both transports
  reconnectionAttempts: 10, // Increase reconnection attempts
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000, // Increase timeout
  forceNew: true,
  withCredentials: true,
  extraHeaders: {
    "x-client-type": "mobile-rider"
  }
});