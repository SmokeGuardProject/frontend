import { apiClient } from '@/shared/api/client';
import type {
  EventFilters,
  EventItem,
  EventStatistics,
} from '@/features/events/model/event.types';

export const eventsApi = {
  async getEvents(filters: EventFilters = {}) {
    const { data } = await apiClient.get<EventItem[]>('/events', {
      params: filters,
    });
    return data;
  },

  async getEvent(id: number) {
    const { data } = await apiClient.get<EventItem>(`/events/${id}`);
    return data;
  },

  async getStatistics() {
    const { data } = await apiClient.get<EventStatistics>('/events/statistics');
    return data;
  },
};
