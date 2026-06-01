<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import type { NotificationItem } from '@/features/notifications/model/notification.types';
import {
  getNotificationEventMeta,
  isCriticalNotificationEvent,
} from '@/features/notifications/lib/event-type-meta';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import type { Sensor } from '@/features/sensors/model/sensor.types';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import { showToast } from '@/shared/ui/use-toast';

const PAGE_SIZE = 10;
const LOAD_MORE_ROOT_MARGIN = '300px 0px 500px 0px';
const LOAD_MORE_BOTTOM_MARGIN = 500;

const notificationsStore = useNotificationsStore();
const sensorsStore = useSensorsStore();
const hasMoreNotifications = ref(false);
const filtersReady = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const canLoadMoreForCurrentScroll = ref(false);
let loadMoreObserver: IntersectionObserver | null = null;
let lastScrollPosition = 0;

const filters = reactive({
  status: '',
  eventType: '',
});

const statusOptions = [
  { label: 'Всі', value: '' },
  { label: 'Непрочитані', value: 'unread' },
  { label: 'Прочитані', value: 'read' },
];

const eventTypeOptions = [
  { label: 'Всі типи', value: '' },
  { label: 'Виявлено дим', value: 'smoke_detected' },
  { label: 'Дим зник', value: 'smoke_cleared' },
  { label: 'Сигналізація активована', value: 'alarm_activated' },
  { label: 'Сигналізація деактивована', value: 'alarm_deactivated' },
];

const summaryCards = computed(() => [
  {
    label: 'Непрочитані',
    value: notificationsStore.unreadCount,
    tone: 'unread',
  },
  {
    label: 'Критичні непрочитані',
    value: notificationsStore.criticalUnreadCount,
    tone: 'critical',
  },
  {
    label: 'Останні сповіщення',
    value: notificationsStore.notifications.length,
    tone: 'neutral',
    description: 'Показано останні доступні сповіщення.',
  },
]);

const hasActiveFilter = computed(() => Boolean(filters.status || filters.eventType));

const filteredNotifications = computed(() =>
  notificationsStore.notifications.filter((notification) => {
    const matchesStatus =
      !filters.status ||
      (filters.status === 'unread' && !notification.read) ||
      (filters.status === 'read' && notification.read);
    const matchesEventType = !filters.eventType || notification.event?.eventType === filters.eventType;

    return matchesStatus && matchesEventType;
  }),
);

const loadedNotificationsCount = computed(() => notificationsStore.notifications.length);

const visibleNotificationsCount = computed(() => filteredNotifications.value.length);

const recentNotificationsTotalLabel = computed(() =>
  hasMoreNotifications.value ? `${loadedNotificationsCount.value}+` : String(loadedNotificationsCount.value),
);

const emptyTitle = computed(() =>
  hasActiveFilter.value
    ? 'За вибраними фільтрами сповіщень не знайдено.'
    : 'Сповіщень поки немає',
);

const emptyDescription = computed(() =>
  hasActiveFilter.value
    ? ''
    : 'Коли система зафіксує події, вони з’являться тут.',
);

async function loadPage(reset = true) {
  resetLoadMoreGate();

  const [loadedNotifications] = await Promise.all([
    notificationsStore.fetchNotifications(
      {
        offset: 0,
        limit: PAGE_SIZE,
      },
      { reset },
    ),
    sensorsStore.sensors.length ? Promise.resolve() : sensorsStore.fetchSensors().catch(() => undefined),
  ]);
  hasMoreNotifications.value = (loadedNotifications?.length ?? 0) === PAGE_SIZE;
  await notificationsStore.fetchUnreadCount();
  await nextTick();
  observeLoadMoreSentinel();
}

async function loadMoreNotifications() {
  if (
    notificationsStore.isLoadingInitial ||
    notificationsStore.isLoadingMore ||
    !hasMoreNotifications.value
  ) {
    return;
  }

  const beforeCount = notificationsStore.notifications.length;
  const loadedNotifications = await notificationsStore.fetchNotifications(
    {
      offset: beforeCount,
      limit: PAGE_SIZE,
    },
    { reset: false },
  );

  const addedCount = notificationsStore.notifications.length - beforeCount;
  hasMoreNotifications.value = (loadedNotifications?.length ?? 0) === PAGE_SIZE && addedCount > 0;
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
  void loadMoreNotifications().catch(() => undefined);
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

async function markAllNotificationsAsRead() {
  await notificationsStore.markAllAsRead();
  await notificationsStore.fetchUnreadCount();

  showToast({
    title: 'Готово',
    message: 'Усі сповіщення позначено як прочитані.',
    tone: 'success',
  });
}

function formatNotificationLocation(sensor: Sensor) {
  return formatSensorLocation(sensor.building, sensor.floor, sensor.location);
}

function notificationLocation(notification: NotificationItem) {
  const eventSensor = notification.event?.sensor;

  if (eventSensor) {
    return formatNotificationLocation(eventSensor);
  }

  const sensorId = notification.event?.sensorId;

  if (sensorId === null || sensorId === undefined) {
    return findSensorLocationFromMessage(notification.message);
  }

  const sensor = sensorsStore.sensors.find((item) => item.id === sensorId);

  return sensor ? formatNotificationLocation(sensor) : findSensorLocationFromMessage(notification.message);
}

function findSensorLocationFromMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (!normalizedMessage) {
    return '';
  }

  const sensor = sensorsStore.sensors.find((item) => {
    const location = item.location.trim().toLowerCase();

    return location && normalizedMessage.includes(location);
  });

  return sensor ? formatNotificationLocation(sensor) : '';
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
  () => [filters.status, filters.eventType],
  async () => {
    if (!filtersReady.value) {
      return;
    }

    await loadPage();
  },
);
</script>

<template>
  <section class="notifications-page">
    <div class="notifications-page__heading">
      <p>Переглядайте системні сповіщення про дим, сигналізації та відновлення нормального стану.</p>

      <AppButton
        class="notifications-page__mark-button"
        :disabled="notificationsStore.unreadCount === 0"
        :loading="notificationsStore.markAllLoading"
        loading-text="Оновлюємо..."
        @click="markAllNotificationsAsRead"
      >
        Позначити все як прочитане
      </AppButton>
    </div>

    <div class="notifications-summary">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="notifications-summary__card"
        :class="`notifications-summary__card--${card.tone}`"
        :title="card.description"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <section class="notifications-table-card">
      <div class="notifications-table-card__header">
        <div>
          <h2>
            Список сповіщень
            <AppBadge tone="neutral">
              {{ recentNotificationsTotalLabel }}
            </AppBadge>
          </h2>
          <p>Останні системні повідомлення та їхній статус.</p>
        </div>

        <div class="notifications-table-card__meta">
          <label class="notifications-filter">
            <span>Статус</span>
            <select
              v-model="filters.status"
              class="notifications-filter__select"
            >
              <option
                v-for="option in statusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="notifications-filter notifications-filter--type">
            <span>Тип</span>
            <select
              v-model="filters.eventType"
              class="notifications-filter__select"
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
        </div>
      </div>

      <AppAlert
        v-if="notificationsStore.listError || notificationsStore.actionError || notificationsStore.countError"
        title="Потрібна увага"
        message="Не вдалося завантажити сповіщення. Спробуйте оновити сторінку."
        tone="warning"
      >
        <AppButton @click="loadPage">
          Повторити
        </AppButton>
      </AppAlert>

      <div
        v-if="notificationsStore.isLoadingInitial && !notificationsStore.notifications.length"
        class="notifications-skeleton"
        aria-label="Сповіщення завантажуються"
      >
        <div
          v-for="row in 5"
          :key="row"
          class="notifications-skeleton__row"
        >
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <AppEmptyState
        v-else-if="!filteredNotifications.length"
        :title="emptyTitle"
        :description="emptyDescription"
      />

      <div
        v-else
        class="notifications-table-shell"
      >
        <table class="notifications-table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Сповіщення</th>
              <th>Подія</th>
              <th>Час</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="notification in filteredNotifications"
              :key="notification.id"
              :class="{ 'notifications-table__row--unread': !notification.read }"
            >
              <td>
                <AppBadge :tone="getNotificationEventMeta(notification.event?.eventType).severity">
                  <span
                    class="notification-type"
                    :class="`notification-type--${getNotificationEventMeta(notification.event?.eventType).icon}`"
                  >
                    {{ getNotificationEventMeta(notification.event?.eventType).label }}
                  </span>
                </AppBadge>
              </td>
              <td>
                <strong class="notifications-table__title">
                  {{ getNotificationEventMeta(notification.event?.eventType).label }}
                </strong>
                <span
                  v-if="notificationLocation(notification)"
                  class="notifications-table__secondary"
                >
                  {{ notificationLocation(notification) }}
                </span>
              </td>
              <td>
                <span class="notifications-table__primary">Подія #{{ notification.eventId }}</span>
                <span
                  v-if="isCriticalNotificationEvent(notification.event?.eventType)"
                  class="notifications-table__secondary notifications-table__secondary--danger"
                >
                  Критична
                </span>
              </td>
              <td>
                <span class="notifications-table__date">{{ formatDateTime(notification.createdAt) }}</span>
              </td>
              <td>
                <AppBadge :tone="notification.read ? 'success' : 'warning'">
                  {{ notification.read ? 'Прочитане' : 'Непрочитане' }}
                </AppBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="loadedNotificationsCount"
        class="notifications-table-card__footer"
      >
        <span class="notifications-table-card__shown">
          Показано {{ visibleNotificationsCount }} із {{ recentNotificationsTotalLabel }} останніх
        </span>

        <span
          v-if="notificationsStore.isLoadingMore"
          class="notifications-table-card__loading"
        >
          Завантаження...
        </span>
        <span
          v-else-if="!hasMoreNotifications"
          class="notifications-table-card__loading"
        >
          Усі сповіщення завантажено
        </span>
      </div>

      <div
        v-if="loadedNotificationsCount && hasMoreNotifications"
        ref="loadMoreSentinel"
        class="notifications-table-card__sentinel"
        aria-hidden="true"
      />
    </section>
  </section>
</template>

<style scoped>
.notifications-page {
  display: grid;
  gap: 1.25rem;
}

.notifications-page__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.notifications-page__heading p {
  margin: 0;
  max-width: 720px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.notifications-page__mark-button {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  box-shadow: none;
  white-space: nowrap;
}

.notifications-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.notifications-summary__card {
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

.notifications-summary__card--neutral {
  border-left-color: #9ca3af;
}

.notifications-summary__card--unread {
  border-left-color: #10b981;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%);
}

.notifications-summary__card--critical {
  border-left-color: #ef4444;
  background: linear-gradient(180deg, #ffffff 0%, #fef2f2 100%);
}

.notifications-summary__card span {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
}

.notifications-summary__card strong {
  color: #111827;
  font-size: 2.15rem;
  line-height: 1;
}

.notifications-table-card {
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.04);
}

.notifications-table-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.notifications-table-card__header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.notifications-table-card__header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.notifications-table-card__meta {
  display: flex;
  align-items: end;
  justify-content: flex-end;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.88rem;
  font-weight: 700;
}

.notifications-filter {
  display: grid;
  gap: 0.35rem;
  color: #374151;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.notifications-filter__select {
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

.notifications-filter:not(.notifications-filter--type) {
  width: 140px;
}

.notifications-filter--type {
  width: 230px;
}

.notifications-table-shell {
  overflow-x: auto;
  border-radius: 0 0 18px 18px;
}

.notifications-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.notifications-table th,
.notifications-table td {
  height: 64px;
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

.notifications-table th {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.notifications-table tbody tr:last-child td {
  border-bottom: 0;
}

.notifications-table td {
  color: #111827;
  font-size: 0.92rem;
  font-weight: 500;
}

.notifications-table__row--unread {
  background: #f9fafb;
}

.notifications-table__title,
.notifications-table__primary,
.notifications-table__secondary {
  display: block;
}

.notifications-table__title,
.notifications-table__primary {
  color: #111827;
  font-weight: 700;
}

.notifications-table__secondary {
  margin-top: 0.2rem;
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 500;
}

.notifications-table__secondary--danger {
  color: #ef4444;
  font-weight: 700;
}

.notifications-table__date {
  display: inline-block;
  min-width: max-content;
  color: #374151;
  white-space: nowrap;
}

.notification-type {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.notification-type::before {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.75rem;
  height: 0.75rem;
  font-size: 0.8rem;
  line-height: 1;
}

.notification-type--flame::before {
  content: '!';
}

.notification-type--check::before {
  content: '✓';
}

.notification-type--bell::before {
  content: '•';
}

.notification-type--bell-off::before {
  content: '−';
}

.notification-type--alert::before {
  content: 'i';
}

.notifications-skeleton {
  display: grid;
  padding: 0.35rem 1.2rem;
}

.notifications-skeleton__row {
  display: grid;
  grid-template-columns: 150px minmax(220px, 1fr) 110px 150px;
  gap: 1rem;
  min-height: 64px;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
}

.notifications-skeleton__row:last-child {
  border-bottom: 0;
}

.notifications-skeleton__row span {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 48%, #f3f4f6 100%);
  background-size: 220% 100%;
  animation: notifications-skeleton-pulse 1.2s ease-in-out infinite;
}

.notifications-table-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.35rem;
  border-top: 1px solid #e5e7eb;
}

.notifications-table-card__shown {
  color: #6b7280;
  font-size: 0.88rem;
  font-weight: 700;
}

.notifications-table-card__loading {
  color: #6b7280;
  font-size: 0.88rem;
  font-weight: 700;
}

.notifications-table-card__sentinel {
  height: 1px;
}

@keyframes notifications-skeleton-pulse {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 1080px) {
  .notifications-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .notifications-table-card__meta {
    align-items: end;
    justify-content: space-between;
  }
}

@media (max-width: 720px) {
  .notifications-page__heading {
    align-items: stretch;
    flex-direction: column;
  }

  .notifications-summary {
    grid-template-columns: 1fr;
  }

  .notifications-table-card__meta {
    align-items: stretch;
    flex-direction: column;
  }

  .notifications-table-card__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .notifications-filter,
  .notifications-filter:not(.notifications-filter--type),
  .notifications-filter--type {
    width: 100%;
  }
}
</style>
