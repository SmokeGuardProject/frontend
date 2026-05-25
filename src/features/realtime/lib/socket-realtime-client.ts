import { io, type Socket } from 'socket.io-client';
import { authStorage } from '@/features/auth/model/auth.storage';
import type { RealtimeClient, RealtimeContext } from '@/features/realtime/model/realtime.types';

const REALTIME_EVENTS = [
  'sensor:reading',
  'alarm:activated',
  'alarm:deactivated',
  'critical:event',
];

export function createSocketRealtimeClient(): RealtimeClient {
  let socket: Socket | null = null;
  let refreshTimerId: number | null = null;

  function queueRefresh(context: RealtimeContext) {
    if (refreshTimerId !== null) {
      return;
    }

    refreshTimerId = window.setTimeout(() => {
      refreshTimerId = null;
      void context.refresh().catch(() => undefined);
    }, 80);
  }

  return {
    async connect(context: RealtimeContext) {
      const token = authStorage.getToken();

      if (!token) {
        throw new Error('Missing access token for realtime connection.');
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        socket = io(resolveSocketUrl(), {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
        });

        const handleReady = () => {
          if (!settled) {
            settled = true;
            resolve();
          }

          queueRefresh(context);
        };

        const handleError = (error: Error | { message?: string }) => {
          const message = error instanceof Error ? error.message : error?.message || 'Socket connection failed.';

          if (!settled) {
            settled = true;
            reject(new Error(message));
            return;
          }

          console.warn('[SmokeGuard] Realtime socket error:', message);
        };

        socket.on('connect', handleReady);
        socket.on('socket:ready', handleReady);
        socket.on('connect_error', handleError);
        socket.on('socket:error', handleError);
        socket.on('reconnect', () => queueRefresh(context));

        for (const eventName of REALTIME_EVENTS) {
          socket.on(eventName, () => queueRefresh(context));
        }
      });
    },

    disconnect() {
      if (refreshTimerId !== null) {
        window.clearTimeout(refreshTimerId);
        refreshTimerId = null;
      }

      socket?.disconnect();
      socket = null;
    },
  };
}

function resolveSocketUrl() {
  if (import.meta.env.VITE_REALTIME_SOCKET_URL) {
    return import.meta.env.VITE_REALTIME_SOCKET_URL;
  }

  const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL);
  return `${apiUrl.origin}/realtime`;
}
