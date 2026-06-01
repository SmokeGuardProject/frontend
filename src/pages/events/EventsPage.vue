<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { alarmsApi } from '@/features/alarms/api/alarms.api';
import type { Alarm } from '@/features/alarms/model/alarm.types';
import { useEventsStore } from '@/features/events/model/use-events-store';
import type { EventItem, EventType } from '@/features/events/model/event.types';
import { formatEventType, getEventTone } from '@/features/events/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';

const PAGE_SIZE = 20;
const LOAD_MORE_ROOT_MARGIN = '300px 0px 500px 0px';
const LOAD_MORE_BOTTOM_MARGIN = 500;

const eventsStore = useEventsStore();
const filtersReady = ref(false);
const isLoadingMore = ref(false);
const hasMoreEvents = ref(false);
const loadedFromServerCount = ref(0);
const alarmContextItems = ref<Alarm[]>([]);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const canLoadMoreForCurrentScroll = ref(false);
let loadMoreObserver: IntersectionObserver | null = null;
let lastScrollPosition = 0;

const filterForm = reactive({
  eventType: '' as EventType | '',
});

const eventTypeOptions = [
  { label: 'Усі типи', value: '' },
  { label: 'Виявлено дим', value: 'smoke_detected' },
  { label: 'Дим зник', value: 'smoke_cleared' },
  { label: 'Сигналізація активована', value: 'alarm_activated' },
  { label: 'Сигналізація деактивована', value: 'alarm_deactivated' },
];

const summaryCards = computed(() => [
  {
    label: 'Усього подій',
    value: eventsStore.statistics.total,
    tone: 'neutral',
  },
  {
    label: 'Критичні події',
    value: eventsStore.criticalEventsCount,
    tone: 'critical',
  },
  {
    label: 'Відновлення',
    value: eventsStore.statistics.byType.smoke_cleared + eventsStore.statistics.byType.alarm_deactivated,
    tone: 'recovery',
  },
]);

const hasActiveFilter = computed(() => Boolean(filterForm.eventType));
const displayableEvents = computed(() => eventsStore.events.filter(hasDisplayableContext));
const shownEventsLabel = computed(() =>
  hasMoreEvents.value ? `${displayableEvents.value.length}+` : String(displayableEvents.value.length),
);
const emptyTitle = computed(() =>
  hasActiveFilter.value ? 'За вибраним типом подій нічого не знайдено.' : 'Подій поки немає',
);

async function loadPage(reset = true) {
  resetLoadMoreGate();
  isLoadingMore.value = false;
  loadedFromServerCount.value = 0;

  const [loadedEvents] = await Promise.all([
    eventsStore.fetchEvents(
      {
        eventType: filterForm.eventType,
        offset: 0,
        limit: PAGE_SIZE,
      },
      { reset },
    ),
    eventsStore.fetchStatistics(),
    loadAlarmContext(),
  ]);

  loadedFromServerCount.value = loadedEvents?.length ?? 0;
  hasMoreEvents.value = (loadedEvents?.length ?? 0) === PAGE_SIZE;
  await nextTick();
  observeLoadMoreSentinel();
}

async function loadMoreEvents() {
  if (eventsStore.listLoading || isLoadingMore.value || !hasMoreEvents.value) {
    return;
  }

  isLoadingMore.value = true;

  try {
    const loadedEvents = await eventsStore.fetchEvents(
      {
        eventType: filterForm.eventType,
        offset: loadedFromServerCount.value,
        limit: PAGE_SIZE,
      },
      { reset: false },
    );

    loadedFromServerCount.value += loadedEvents?.length ?? 0;
    hasMoreEvents.value = (loadedEvents?.length ?? 0) === PAGE_SIZE;
  } finally {
    isLoadingMore.value = false;
  }
}

function resetFilters() {
  filterForm.eventType = '';
}

async function loadAlarmContext() {
  alarmContextItems.value = await alarmsApi.getAlarms({ offset: 0, limit: 100 });
}

function hasDisplayableContext(event: EventItem) {
  if (event.eventType === 'smoke_detected' || event.eventType === 'smoke_cleared') {
    return Boolean(event.sensor?.id && event.sensor.building && event.sensor.location);
  }

  if (event.eventType === 'alarm_activated' || event.eventType === 'alarm_deactivated') {
    const alarm = resolveEventAlarm(event);

    return Boolean(alarm?.id && alarm.building && alarm.location && resolveEventSensorId(event));
  }

  return false;
}

function resolveEventAlarm(event: EventItem) {
  if (event.alarm?.id) {
    return event.alarm;
  }

  return alarmContextItems.value.find((alarm) => alarm.sensorId === event.sensorId) ?? null;
}

function eventLocation(event: EventItem) {
  if (event.eventType === 'alarm_activated' || event.eventType === 'alarm_deactivated') {
    const alarm = resolveEventAlarm(event);

    return alarm ? formatSensorLocation(alarm.building, alarm.floor, alarm.location) : '';
  }

  return event.sensor ? formatSensorLocation(event.sensor.building, event.sensor.floor, event.sensor.location) : '';
}

function eventSensorLabel(event: EventItem) {
  const sensorId = resolveEventSensorId(event);

  return sensorId ? `Сенсор #${sensorId}` : '';
}

function eventDetailsRoute(event: EventItem) {
  if (event.eventType === 'alarm_activated' || event.eventType === 'alarm_deactivated') {
    const alarm = resolveEventAlarm(event);

    return alarm ? `/alarms/${alarm.id}` : '';
  }

  const sensorId = resolveEventSensorId(event);

  return sensorId ? `/sensors/${sensorId}` : '';
}

function resolveEventSensorId(event: EventItem) {
  if (event.eventType === 'alarm_activated' || event.eventType === 'alarm_deactivated') {
    const alarm = resolveEventAlarm(event);

    return alarm?.sensor?.id ?? alarm?.sensorId ?? event.sensor?.id ?? event.sensorId ?? null;
  }

  return event.sensor?.id ?? event.sensorId ?? null;
}

function observeLoadMoreSentinel() {
  loadMoreObserver?.disconnect();

  if (!loadMoreSentinel.value || !('IntersectionObserver' in window)) {
    return;
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) {
        canLoadMoreForCurrentScroll.value = true;
      }

      if (entries.some((entry) => entry.isIntersecting)) {
        requestLoadMoreFromUserTrigger();
      }
    },
    {
      root: null,
      rootMargin: LOAD_MORE_ROOT_MARGIN,
      threshold: 0,
    },
  );

  loadMoreObserver.observe(loadMoreSentinel.value);
}

function handlePageScroll() {
  const currentScrollPosition = getScrollPosition();
  const scrolledDown = currentScrollPosition > lastScrollPosition + 8;

  lastScrollPosition = currentScrollPosition;

  if (!scrolledDown) {
    return;
  }

  canLoadMoreForCurrentScroll.value = true;

  if (isLoadMoreSentinelVisible()) {
    requestLoadMoreFromUserTrigger();
  }
}

function requestLoadMoreFromUserTrigger() {
  if (!canLoadMoreForCurrentScroll.value) {
    return;
  }

  canLoadMoreForCurrentScroll.value = false;
  void loadMoreEvents().catch(() => undefined);
}

function isLoadMoreSentinelVisible() {
  if (!loadMoreSentinel.value) {
    return false;
  }

  const sentinelRect = loadMoreSentinel.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return sentinelRect.top <= viewportHeight + LOAD_MORE_BOTTOM_MARGIN && sentinelRect.bottom >= 0;
}

function getScrollPosition() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function resetLoadMoreGate() {
  canLoadMoreForCurrentScroll.value = false;
  lastScrollPosition = typeof window === 'undefined' ? 0 : getScrollPosition();
}

onMounted(async () => {
  await loadPage();
  window.addEventListener('scroll', handlePageScroll, { passive: true });
  filtersReady.value = true;
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect();
  window.removeEventListener('scroll', handlePageScroll);
});

watch(
  () => filterForm.eventType,
  async () => {
    if (!filtersReady.value) {
      return;
    }

    await loadPage();
  },
);
</script>

<template>
  <section class="events-page">
    <div class="events-page__heading">
      <div>
        <p>Переглядайте події виявлення диму, відновлення стану та керування сигналізаціями.</p>
      </div>
    </div>

    <div class="events-summary">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="events-summary__card"
        :class="`events-summary__card--${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <section class="events-table-card">
      <div class="events-table-card__header">
        <div>
          <h2>
            Останні події
            <AppBadge tone="neutral">
              {{ shownEventsLabel }}
            </AppBadge>
          </h2>
          <p>Системні події за вибраним типом.</p>
        </div>

        <div class="events-table-card__filters">
          <label class="events-filter">
            <span>Тип події</span>
            <select
              v-model="filterForm.eventType"
              class="events-filter__select"
            >
              <option
                v-for="option in eventTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <AppButton
            v-if="hasActiveFilter"
            class="events-filter__button"
            variant="ghost"
            @click="resetFilters"
          >
            Скинути
          </AppButton>
        </div>
      </div>

      <AppAlert
        v-if="eventsStore.listError || eventsStore.statisticsError"
        title="Потрібна увага"
        message="Не вдалося завантажити події. Спробуйте оновити сторінку."
        tone="warning"
      >
        <AppButton @click="loadPage">
          Повторити
        </AppButton>
      </AppAlert>

      <div
        v-if="eventsStore.listLoading && !eventsStore.events.length"
        class="events-skeleton"
        aria-label="Події завантажуються"
      >
        <div
          v-for="row in 5"
          :key="row"
          class="events-skeleton__row"
        >
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <AppEmptyState
        v-else-if="!displayableEvents.length"
        :title="emptyTitle"
      />

      <div
        v-else
        class="events-table-shell"
      >
        <table class="events-table">
          <thead>
            <tr>
              <th>Подія</th>
              <th>Локація</th>
              <th>Сенсор</th>
              <th>Час</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="event in displayableEvents"
              :key="event.id"
            >
              <td>
                <AppBadge :tone="getEventTone(event.eventType)">
                  <span
                    class="event-type"
                    :class="`event-type--${event.eventType}`"
                  >
                    {{ formatEventType(event.eventType) }}
                  </span>
                </AppBadge>
                <span class="events-table__secondary">Подія #{{ event.id }}</span>
              </td>
              <td>
                <span class="events-table__primary">{{ eventLocation(event) }}</span>
              </td>
              <td>
                <span class="events-table__primary">{{ eventSensorLabel(event) }}</span>
              </td>
              <td>
                <span class="events-table__date">{{ formatDateTime(event.createdAt) }}</span>
              </td>
              <td>
                <RouterLink
                  v-if="eventDetailsRoute(event)"
                  :to="eventDetailsRoute(event)"
                  :aria-label="`Відкрити контекст події #${event.id}`"
                >
                  <AppButton
                    class="events-table__action"
                    variant="ghost"
                  >
                    Відкрити
                  </AppButton>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="displayableEvents.length && (isLoadingMore || !hasMoreEvents)"
        class="events-table-card__footer"
      >
        <span
          v-if="isLoadingMore"
          class="events-table-card__loading"
        >
          Завантаження...
        </span>
        <span
          v-else-if="!hasMoreEvents"
          class="events-table-card__loading"
        >
          Усі події завантажено
        </span>
      </div>

      <div
        v-if="displayableEvents.length && hasMoreEvents"
        ref="loadMoreSentinel"
        class="events-table-card__sentinel"
        aria-hidden="true"
      />
    </section>
  </section>
</template>

<style scoped>
.events-page {
  display: grid;
  gap: 1.25rem;
}

.events-page__heading h1 {
  margin: 0;
  color: #111827;
  font-size: 1.65rem;
  letter-spacing: 0;
}

.events-page__heading p {
  margin: 0.35rem 0 0;
  max-width: 760px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.events-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.events-summary__card {
  display: grid;
  min-height: 112px;
  align-content: space-between;
  gap: 0.75rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid #e5e7eb;
  border-left-width: 4px;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
}

.events-summary__card--neutral {
  border-left-color: #9ca3af;
}

.events-summary__card--critical {
  border-left-color: #ef4444;
  background: linear-gradient(180deg, #ffffff 0%, #fef2f2 100%);
}

.events-summary__card--recovery {
  border-left-color: #10b981;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%);
}

.events-summary__card span {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
}

.events-summary__card strong {
  color: #111827;
  font-size: 2.15rem;
  line-height: 1;
}

.events-summary__card--critical strong {
  color: #ef4444;
}

.events-summary__card--recovery strong {
  color: #10b981;
}

.events-table-card {
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.04);
}

.events-table-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.events-table-card__header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.events-table-card__header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.events-table-card__filters {
  display: flex;
  width: 260px;
  max-width: 100%;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.88rem;
  font-weight: 700;
}

.events-table-card__loading {
  color: #6b7280;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
}

.events-filter {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.35rem;
  color: #374151;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.events-filter__select {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 2rem 0 0.8rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  color: #111827;
  font: inherit;
  font-weight: 600;
  text-transform: none;
}

.events-filter__button {
  flex: 0 0 auto;
  min-width: 84px;
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  box-shadow: none;
}

.events-table-shell {
  overflow-x: auto;
  border-radius: 0 0 18px 18px;
}

.events-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.events-table th,
.events-table td {
  height: 68px;
  padding: 0.85rem 1.2rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

.events-table th {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.events-table tbody tr:last-child td {
  border-bottom: 0;
}

.events-table td {
  color: #111827;
  font-size: 0.92rem;
  font-weight: 500;
}

.events-table__primary,
.events-table__secondary {
  display: block;
}

.events-table__primary {
  color: #111827;
  font-weight: 600;
}

.events-table__secondary {
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 500;
}

.events-table__date {
  display: inline-block;
  min-width: max-content;
  color: #374151;
  white-space: nowrap;
}

.events-table__action {
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  box-shadow: none;
  white-space: nowrap;
}

.event-type {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.event-type::before {
  display: inline-grid;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  content: '';
}

.event-type--smoke_detected::before,
.event-type--alarm_activated::before {
  background: #ef4444;
}

.event-type--smoke_cleared::before {
  background: #10b981;
}

.event-type--alarm_deactivated::before {
  background: #f59e0b;
}

.events-skeleton {
  display: grid;
  padding: 0.35rem 1.2rem;
}

.events-skeleton__row {
  display: grid;
  grid-template-columns: 170px minmax(220px, 1fr) 120px 170px 90px;
  gap: 1rem;
  min-height: 68px;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
}

.events-skeleton__row:last-child {
  border-bottom: 0;
}

.events-skeleton__row span {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 48%, #f3f4f6 100%);
  background-size: 220% 100%;
  animation: events-skeleton-pulse 1.2s ease-in-out infinite;
}

.events-table-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.35rem;
  border-top: 1px solid #e5e7eb;
}

.events-table-card__sentinel {
  height: 1px;
}

@keyframes events-skeleton-pulse {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 1120px) {
  .events-table-card__header {
    align-items: center;
  }

  .events-table-card__filters {
    width: 260px;
  }
}

@media (max-width: 720px) {
  .events-summary {
    grid-template-columns: 1fr;
  }

  .events-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .events-table-card__filters {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .events-table-card__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .events-filter {
    width: 100%;
  }

  .events-filter__button {
    width: 100%;
  }
}
</style>
