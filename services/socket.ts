import { io } from 'socket.io-client';

const SOCKET_URL = 'https://rider-app-testing.onrender.com';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});