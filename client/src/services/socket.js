import { io } from 'socket.io-client';

function getSocketOrigin() {
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api';

  try {
    return new URL(apiBase).origin;
  } catch {
    return 'http://localhost:5000';
  }
}

export function createJobSocket() {
  return io(getSocketOrigin(), {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
  });
}
