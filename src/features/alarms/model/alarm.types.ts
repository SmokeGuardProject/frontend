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
}

export interface AlarmFilters {
  status?: AlarmStatus | '';
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
