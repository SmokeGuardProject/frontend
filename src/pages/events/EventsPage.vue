<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import { useEventsStore } from '@/features/events/model/use-events-store';
import { formatEventType, getEventTone } from '@/features/events/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';

const eventsStore = useEventsStore();

const filterForm = reactive({
  eventType: '',
});

const eventTypeOptions = [
  { label: 'All event types', value: '' },
  { label: 'Smoke detected', value: 'smoke_detected' },
  { label: 'Smoke cleared', value: 'smoke_cleared' },
  { label: 'Alarm activated', value: 'alarm_activated' },
  { label: 'Alarm deactivated', value: 'alarm_deactivated' },
];

const summaryCards = computed(() => [
  {
    title: 'Total events',
    value: String(eventsStore.statistics.total),
    tone: 'neutral' as const,
  },
  {
    title: 'Critical events',
    value: String(eventsStore.criticalEventsCount),
    tone: 'danger' as const,
  },
  {
    title: 'Recovery events',
    value: String(
      eventsStore.statistics.byType.smoke_cleared + eventsStore.statistics.byType.alarm_deactivated,
    ),
    tone: 'success' as const,
  },
]);

async function loadPage() {
  await Promise.all([eventsStore.fetchStatistics(), eventsStore.fetchEvents()]);
}

async function applyFilters() {
  await eventsStore.fetchEvents({
    eventType: filterForm.eventType as '' | 'smoke_detected' | 'smoke_cleared' | 'alarm_activated' | 'alarm_deactivated',
  });
}

function resetFilters() {
  filterForm.eventType = '';
  void applyFilters();
}

function eventLocation(eventId: number) {
  const event = eventsStore.events.find((item) => item.id === eventId);

  if (!event?.sensor) {
    return 'No sensor context';
  }

  return formatSensorLocation(event.sensor.building, event.sensor.floor, event.sensor.location);
}

onMounted(async () => {
  await loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Events</span>
        <h1>Стрічка системних подій</h1>
      </div>
    </div>

    <div class="status-grid">
      <StatusCard
        v-for="card in summaryCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :tone="card.tone"
      />
    </div>

    <section class="ui-card filters-panel">
      <div class="filters-panel__header">
        <div>
          <span class="ui-card__label">Filters</span>
          <h2>Відбір по типу події</h2>
        </div>
        <div class="filters-panel__actions">
          <AppButton
            variant="ghost"
            @click="resetFilters"
          >
            Скинути
          </AppButton>
          <AppButton @click="applyFilters">
            Застосувати
          </AppButton>
        </div>
      </div>

      <div class="filters-grid filters-grid--single">
        <AppSelect
          v-model="filterForm.eventType"
          label="Тип події"
          :options="eventTypeOptions"
        />
      </div>
    </section>

    <section class="ui-card">
      <div class="section-header">
        <div>
          <span class="ui-card__label">Timeline</span>
          <h2>Останні події</h2>
        </div>
        <span class="app-header__meta">
          {{ eventsStore.listLoading ? 'Оновлення...' : `${eventsStore.events.length} items` }}
        </span>
      </div>

      <AppAlert
        v-if="eventsStore.listError || eventsStore.statisticsError"
        title="Events unavailable"
        :message="eventsStore.listError || eventsStore.statisticsError"
        tone="warning"
      >
        <AppButton @click="loadPage">
          Retry
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!eventsStore.listLoading && !eventsStore.events.length"
        title="Подій поки немає"
      />

      <div
        v-else
        class="table-shell"
      >
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Тип події</th>
              <th>Локація</th>
              <th>Sensor ID</th>
              <th>Час</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="event in eventsStore.events"
              :key="event.id"
            >
              <td>#{{ event.id }}</td>
              <td>
                <AppBadge :tone="getEventTone(event.eventType)">
                  {{ formatEventType(event.eventType) }}
                </AppBadge>
              </td>
              <td>{{ eventLocation(event.id) }}</td>
              <td>{{ event.sensorId ?? 'N/A' }}</td>
              <td>{{ formatDateTime(event.createdAt) }}</td>
              <td class="data-table__actions">
                <RouterLink :to="`/sensors/${event.sensorId}`">
                  <AppButton
                    v-if="event.sensorId"
                    variant="ghost"
                  >
                    Сенсор
                  </AppButton>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
