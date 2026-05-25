import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { eventsApi } from '@/features/events/api/events.api';
import type { EventFilters, EventItem, EventStatistics } from '@/features/events/model/event.types';
import { normalizeApiError } from '@/shared/api/normalize-api-error';

const emptyStatistics: EventStatistics = {
  total: 0,
  byType: {
    smoke_detected: 0,
    smoke_cleared: 0,
    alarm_activated: 0,
    alarm_deactivated: 0,
  },
};

export const useEventsStore = defineStore('events', () => {
  const events = ref<EventItem[]>([]);
  const currentEvent = ref<EventItem | null>(null);
  const statistics = ref<EventStatistics>(emptyStatistics);
  const filters = ref<EventFilters>({
    eventType: '',
    offset: 0,
    limit: 100,
  });
  const listLoading = ref(false);
  const detailLoading = ref(false);
  const statisticsLoading = ref(false);
  const listError = ref('');
  const detailError = ref('');
  const statisticsError = ref('');

  const criticalEventsCount = computed(
    () => statistics.value.byType.smoke_detected + statistics.value.byType.alarm_activated,
  );

  async function fetchEvents(nextFilters?: EventFilters) {
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = {
          ...filters.value,
          ...nextFilters,
        };
      }

      events.value = await eventsApi.getEvents(normalizeFilters(filters.value));
    } catch (error) {
      listError.value = normalizeApiError(error, 'Failed to load events.');
      throw error;
    } finally {
      listLoading.value = false;
    }
  }

  async function fetchEvent(id: number) {
    detailLoading.value = true;
    detailError.value = '';

    try {
      currentEvent.value = await eventsApi.getEvent(id);
    } catch (error) {
      detailError.value = normalizeApiError(error, 'Failed to load event details.');
      throw error;
    } finally {
      detailLoading.value = false;
    }
  }

  async function fetchStatistics() {
    statisticsLoading.value = true;
    statisticsError.value = '';

    try {
      statistics.value = await eventsApi.getStatistics();
    } catch (error) {
      statisticsError.value = normalizeApiError(error, 'Failed to load event statistics.');
      throw error;
    } finally {
      statisticsLoading.value = false;
    }
  }

  return {
    criticalEventsCount,
    currentEvent,
    detailLoading,
    detailError,
    events,
    filters,
    listError,
    listLoading,
    statistics,
    statisticsError,
    statisticsLoading,
    fetchEvent,
    fetchEvents,
    fetchStatistics,
  };
});

function normalizeFilters(filters: EventFilters) {
  return {
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(typeof filters.offset === 'number' ? { offset: filters.offset } : {}),
    ...(typeof filters.limit === 'number' ? { limit: filters.limit } : {}),
  };
}
