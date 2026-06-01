import type { Sensor } from '@/features/sensors/model/sensor.types';
import type { Alarm } from '@/features/alarms/model/alarm.types';

export type EventType =
  | 'smoke_detected'
  | 'smoke_cleared'
  | 'alarm_activated'
  | 'alarm_deactivated';

export interface EventItem {
  id: number;
  sensorId: number | null;
  eventType: EventType;
  createdAt: string;
  alarm?: Alarm | null;
  sensor?: Sensor | null;
}

export interface EventFilters {
  eventType?: EventType | '';
  offset?: number;
  limit?: number;
}

export interface EventStatistics {
  total: number;
  byType: Record<EventType, number>;
}
