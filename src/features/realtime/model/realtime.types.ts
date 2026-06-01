import type { NotificationItem } from '@/features/notifications/model/notification.types';
import type { AlarmStatus } from '@/features/alarms/model/alarm.types';
import type { SensorStatus } from '@/features/sensors/model/sensor.types';

export type RealtimeMode = 'polling' | 'socket';
export type RealtimeState = 'idle' | 'connecting' | 'active' | 'error';

export interface SensorReadingRealtimePayload {
  id?: number;
  sensorId: number;
  location?: string;
  floor?: number | null;
  building?: string | null;
  status?: SensorStatus;
  smokeDetected?: boolean;
  smokeLevel?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  timestamp?: string;
  createdAt?: string;
}

export interface AlarmRealtimePayload {
  alarmId: number;
  sensorId?: number;
  location?: string;
  floor?: number | null;
  building?: string | null;
  status?: AlarmStatus;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  timestamp?: string;
}

export interface RealtimeContext {
  refresh: () => Promise<void>;
  handleNotificationCreated: (_notification: NotificationItem) => void;
  handleSensorReading: (_payload: SensorReadingRealtimePayload) => void;
  handleAlarmChanged: (_payload: AlarmRealtimePayload) => void;
  pollingIntervalMs: number;
}

export interface RealtimeClient {
  connect: (_context: RealtimeContext) => Promise<void>;
  disconnect: () => void;
}
