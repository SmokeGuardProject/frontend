import type { EventItem } from '@/features/events/model/event.types';

export interface NotificationItem {
  id: number;
  userId: number;
  eventId: number;
  message: string;
  read: boolean;
  sentAt: string | null;
  createdAt: string;
  event: EventItem;
}

export interface NotificationFilters {
  offset?: number;
  limit?: number;
}
