import type { Sensor } from '@/features/sensors/model/sensor.types';

export type AlarmStatus = 'active' | 'inactive';

export interface Alarm {
  id: number;
  sensorId: number;
  location: string;
  floor: number | null;
  building: string | null;
  status: AlarmStatus;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sensor?: Sensor | null;
}

export interface BulkAlarmActionResult {
  total: number;
  failed: Array<{
    alarmId: number;
    error: string;
  }>;
  activated?: number;
  deactivated?: number;
}

export interface AlarmFilters {
  status?: AlarmStatus | '';
  floor?: number | null;
  building?: string;
  offset?: number;
  limit?: number;
}

export interface CreateAlarmPayload {
  sensorId: number;
  location: string;
  floor?: number | null;
  building?: string;
}

export interface UpdateAlarmPayload {
  location?: string;
  floor?: number | null;
  building?: string;
}
