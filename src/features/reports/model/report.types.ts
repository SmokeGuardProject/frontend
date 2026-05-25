import type { EventType } from '@/features/events/model/event.types';

export interface ReportPayload {
  startDate?: string;
  endDate?: string;
  sensorId?: number;
  eventType?: EventType;
}
