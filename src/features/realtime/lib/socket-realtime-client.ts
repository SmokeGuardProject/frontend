import { io, type Socket } from 'socket.io-client';
import { authStorage } from '@/features/auth/model/auth.storage';
import type { NotificationItem } from '@/features/notifications/model/notification.types';
import type {
  AlarmRealtimePayload,
  RealtimeClient,
  RealtimeContext,
  SensorReadingRealtimePayload,
} from '@/features/realtime/model/realtime.types';

export function createSocketRealtimeClient(): RealtimeClient {
  let socket: Socket | null = null;

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

        socket.on('sensor:reading', (payload: SensorReadingRealtimePayload) => {
          context.handleSensorReading(payload);
        });

        socket.on('alarm:activated', (payload: AlarmRealtimePayload) => {
          context.handleAlarmChanged(payload);
        });

        socket.on('alarm:deactivated', (payload: AlarmRealtimePayload) => {
          context.handleAlarmChanged(payload);
        });

        socket.on('critical:event', () => undefined);

        socket.on('notification:created', (notification: NotificationItem) => {
          context.handleNotificationCreated(notification);
        });
      });
    },

    disconnect() {
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
