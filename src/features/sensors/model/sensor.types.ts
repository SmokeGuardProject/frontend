export type SensorStatus = 'active' | 'inactive';

export interface Sensor {
  id: number;
  location: string;
  floor: number | null;
  building: string | null;
  status: SensorStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SensorReading {
  id: number;
  sensorId: number;
  smokeDetected: boolean;
  smokeLevel: number | null;
  temperature: number | null;
  humidity: number | null;
  timestamp: string;
  createdAt: string;
}

export interface SensorFilters {
  status?: SensorStatus | '';
  floor?: number | null;
  building?: string;
}

export interface SensorReadingsFilters {
  offset: number;
  limit: number;
  startDate?: string;
  endDate?: string;
}

export interface SensorReadingRealtimeData {
  id?: number;
  sensorId: number;
  smokeDetected?: boolean;
  smokeLevel?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  timestamp?: string;
  createdAt?: string;
}

export interface CreateSensorPayload {
  location: string;
  floor?: number | null;
  building?: string;
}

export interface UpdateSensorPayload {
  location?: string;
  floor?: number | null;
  building?: string;
  status?: SensorStatus;
}

export interface CreateSensorResponse {
  sensor: Sensor;
  sensorCode: string;
}

export interface CreatedSensorSuccessData {
  sensorId: number | string;
  sensorCode: string;
}
