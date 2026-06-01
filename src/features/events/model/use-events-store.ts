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
  let latestListRequestId = 0;

  const criticalEventsCount = computed(
    () => statistics.value.byType.smoke_detected + statistics.value.byType.alarm_activated,
  );

  async function fetchEvents(nextFilters?: EventFilters, options: { reset?: boolean } = {}) {
    const requestId = ++latestListRequestId;
    const shouldReset = options.reset ?? true;

    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = {
          ...filters.value,
          ...nextFilters,
        };
      }

      const nextEvents = await eventsApi.getEvents(normalizeFilters(filters.value));

      if (requestId !== latestListRequestId) {
        return [];
      }

      events.value = shouldReset ? dedupeEvents(nextEvents) : dedupeEvents([...events.value, ...nextEvents]);

      return nextEvents;
    } catch (error) {
      if (requestId !== latestListRequestId) {
        return [];
      }

      listError.value = normalizeApiError(error, 'Failed to load events.');
      throw error;
    } finally {
      if (requestId === latestListRequestId) {
        listLoading.value = false;
      }
    }
  }

  function prependEvent(event: EventItem) {
    if (filters.value.eventType && filters.value.eventType !== event.eventType) {
      return;
    }

    events.value = dedupeEvents([event, ...events.value]);
    statistics.value = {
      total: statistics.value.total + 1,
      byType: {
        ...statistics.value.byType,
        [event.eventType]: statistics.value.byType[event.eventType] + 1,
      },
    };
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
    prependEvent,
  };
});

function normalizeFilters(filters: EventFilters) {
  return {
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(typeof filters.offset === 'number' ? { offset: filters.offset } : {}),
    ...(typeof filters.limit === 'number' ? { limit: filters.limit } : {}),
  };
}

function dedupeEvents(events: EventItem[]) {
  const seen = new Set<number>();

  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }

    seen.add(event.id);
    return true;
  });
}
