<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { getEventTone } from '@/features/events/lib/formatters';
import type { EventItem } from '@/features/events/model/event.types';
import { useEventsStore } from '@/features/events/model/use-events-store';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppButton from '@/shared/ui/AppButton.vue';

const BULK_EVENT_WINDOW_MS = 10_000;

const sensorsStore = useSensorsStore();
const alarmsStore = useAlarmsStore();
const eventsStore = useEventsStore();
const notificationsStore = useNotificationsStore();

const inactiveSensorsCount = computed(() =>
  Math.max(sensorsStore.sensors.length - sensorsStore.activeSensorsCount, 0),
);
const criticalUnreadNotifications = computed(
  () =>
    notificationsStore.notifications.filter(
      (notification) =>
        !notification.read &&
        (notification.event?.eventType === 'smoke_detected' || notification.event?.eventType === 'alarm_activated'),
    ).length,
);
const activeSmokeSensorIds = computed(() => resolveActiveSmokeSensorIds(eventsStore.events));
const hasSensorWarnings = computed(() => sensorsStore.sensors.length > 0 && inactiveSensorsCount.value > 0);
const hasCriticalUnreadNotifications = computed(() => criticalUnreadNotifications.value > 0);
const hasActiveSmoke = computed(() => activeSmokeSensorIds.value.length > 0);
const hasActiveAlarms = computed(() => alarmsStore.activeCount > 0);
const hasActualCriticalState = computed(() => hasActiveSmoke.value || hasActiveAlarms.value);

const heroTone = computed<'success' | 'warning' | 'danger'>(() => {
  if (hasActualCriticalState.value) {
    return 'danger';
  }

  if (hasSensorWarnings.value) {
    return 'warning';
  }

  return 'success';
});

const heroCopy = computed(() => {
  if (hasActiveSmoke.value) {
    return {
      description: 'Виявлено активний дим. Перевірте зону ризику та стан сигналізацій.',
      pill: 'Тривога',
    };
  }

  if (hasActiveAlarms.value) {
    return {
      description: 'Є активні сигналізації.',
      pill: 'Потрібна увага',
    };
  }

  if (hasSensorWarnings.value) {
    return {
      description: 'Є попередження щодо доступності сенсорів.',
      pill: 'Є попередження',
    };
  }

  return {
    description: 'Система працює у штатному режимі.',
    pill: 'Система в нормі',
  };
});

const summaryCards = computed(() => [
  {
    title: 'Сенсори',
    value: String(sensorsStore.sensors.length),
    detail: `${sensorsStore.activeSensorsCount} активних`,
    tone: sensorsStore.activeSensorsCount > 0 ? ('success' as const) : ('warning' as const),
    icon: 'sensors',
  },
  {
    title: 'Сигналізації',
    value: String(alarmsStore.alarms.length),
    detail: `${alarmsStore.activeCount} активних`,
    tone: alarmsStore.activeCount > 0 ? ('danger' as const) : ('success' as const),
    icon: 'alarms',
  },
  {
    title: 'Критичні сповіщення',
    value: String(criticalUnreadNotifications.value),
    detail: 'потребують уваги',
    tone: criticalUnreadNotifications.value > 0 ? ('danger' as const) : ('success' as const),
    icon: 'events',
  },
  {
    title: 'Подій усього',
    value: String(eventsStore.statistics.total),
    detail: 'усього в журналі',
    tone: 'neutral' as const,
    icon: 'archive',
  },
]);

const activeAlarms = computed(() => alarmsStore.alarms.filter((alarm) => alarm.status === 'active').slice(0, 3));
const dashboardEvents = computed(() => buildDashboardEvents(eventsStore.events));

const systemStatusItems = computed(() => [
  {
    label: sensorsStore.sensors.length ? 'Сенсори активні' : 'Сенсори',
    value: sensorsStore.sensors.length
      ? `${sensorsStore.activeSensorsCount} / ${sensorsStore.sensors.length}`
      : 'не додані',
    tone: sensorsStore.sensors.length === 0 || hasSensorWarnings.value ? ('warning' as const) : ('success' as const),
  },
  {
    label: 'Активні сигналізації',
    value: `${alarmsStore.activeCount} / ${alarmsStore.alarms.length}`,
    tone: alarmsStore.activeCount > 0 ? ('danger' as const) : ('success' as const),
  },
  {
    label: 'Активний дим',
    value: String(activeSmokeSensorIds.value.length),
    tone: activeSmokeSensorIds.value.length > 0 ? ('danger' as const) : ('success' as const),
  },
  {
    label: 'Непрочитані сповіщення',
    value: String(notificationsStore.unreadCount),
    tone: notificationsStore.unreadCount > 0 ? ('warning' as const) : ('success' as const),
  },
]);

const warningTitle = computed(() => {
  if (hasActiveSmoke.value) {
    return 'Виявлено дим';
  }

  if (hasActiveAlarms.value) {
    return 'Активні спрацювання';
  }

  return '';
});

const warningDescription = computed(() => {
  if (hasActiveSmoke.value) {
    return `${activeSmokeSensorIds.value.length} сенсорів мають активний стан диму.`;
  }

  if (hasActiveAlarms.value) {
    return `${alarmsStore.activeCount} сигналізацій потребують уваги.`;
  }

  return '';
});

async function loadDashboard() {
  await Promise.all([
    sensorsStore.fetchSensors(),
    alarmsStore.fetchAlarms(),
    eventsStore.fetchEvents({ limit: 30, offset: 0 }),
    eventsStore.fetchStatistics(),
    notificationsStore.fetchUnreadCount(),
    notificationsStore.fetchNotifications({ offset: 0, limit: 100 }),
  ]);
}

function resolveActiveSmokeSensorIds(events: EventItem[]) {
  const latestSmokeBySensor = new Map<number, EventItem>();

  events.forEach((event) => {
    if (event.eventType !== 'smoke_detected' && event.eventType !== 'smoke_cleared') {
      return;
    }

    const sensorId = event.sensor?.id ?? event.sensorId;

    if (sensorId === null || sensorId === undefined) {
      return;
    }

    const previousEvent = latestSmokeBySensor.get(sensorId);

    if (!previousEvent || getEventTime(event) > getEventTime(previousEvent)) {
      latestSmokeBySensor.set(sensorId, event);
    }
  });

  return Array.from(latestSmokeBySensor.entries())
    .filter(([, event]) => event.eventType === 'smoke_detected')
    .map(([sensorId]) => sensorId);
}

function hasDashboardContext(event: EventItem) {
  if (isManualBulkAlarmEvent(event)) {
    return true;
  }

  return Boolean(resolveEventLocation(event));
}

function buildDashboardEvents(events: EventItem[]) {
  const bulkAlarmEvents = events.filter(
    (event) => isManualBulkAlarmEvent(event) || isAutoBulkAlarmActivationFromSensor(event),
  );

  return events
    .filter((event) => {
      if (isManualBulkAlarmEvent(event) || isAutoBulkAlarmActivationFromSensor(event)) {
        return true;
      }

      if (isConcreteAlarmHiddenByBulk(event, bulkAlarmEvents)) {
        return false;
      }

      return hasDashboardContext(event);
    })
    .slice(0, 5);
}

function formatDashboardEventType(event: EventItem) {
  if (isManualBulkAlarmEvent(event)) {
    return 'Масова дія';
  }

  if (isAutoBulkAlarmActivationFromSensor(event)) {
    return 'Тривога';
  }

  if (event.eventType === 'smoke_detected' || event.eventType === 'smoke_cleared') {
    return event.eventType === 'smoke_detected' ? 'Дим виявлено' : 'Дим зник';
  }

  switch (event.eventType) {
    case 'alarm_activated':
      return 'Сигналізація активована';
    case 'alarm_deactivated':
      return 'Сигналізація деактивована';
  }
}

function getDashboardEventBadgeLabel(event: EventItem) {
  if (isManualBulkAlarmEvent(event)) {
    return 'Масова дія';
  }

  if (isAutoBulkAlarmActivationFromSensor(event)) {
    return 'Тривога';
  }

  switch (event.eventType) {
    case 'smoke_detected':
      return 'Дим виявлено';
    case 'smoke_cleared':
      return 'Дим зник';
    case 'alarm_activated':
      return 'Активація';
    case 'alarm_deactivated':
      return 'Деактивація';
  }
}

function getDashboardEventTitle(event: EventItem) {
  if (isManualBulkAlarmEvent(event)) {
    return getBulkAlarmEventLabel(event);
  }

  if (isAutoBulkAlarmActivationFromSensor(event)) {
    return 'Автоматично активовано сигналізації';
  }

  return formatDashboardEventType(event);
}

function getBulkAlarmEventLabel(event: EventItem) {
  if (event.eventType === 'alarm_activated') {
    return 'Активовано всі сигналізації';
  }

  return 'Деактивовано всі сигналізації';
}

function getDashboardEventTone(event: EventItem) {
  if (isAutoBulkAlarmActivationFromSensor(event)) {
    return 'danger';
  }

  if (isManualBulkAlarmEvent(event)) {
    return event.eventType === 'alarm_activated' ? 'danger' : 'warning';
  }

  return getEventTone(event.eventType);
}

function resolveEventLocation(event: EventItem) {
  if (isManualBulkAlarmEvent(event)) {
    return 'Усі сигналізації';
  }

  if (isAutoBulkAlarmActivationFromSensor(event)) {
    const sensor = event.sensor ?? resolveSensorFromEvent(event);

    return sensor ? formatSensorLocation(sensor.building, sensor.floor, sensor.location) : '';
  }

  if (event.eventType === 'smoke_detected' || event.eventType === 'smoke_cleared') {
    const sensor = event.sensor ?? resolveSensorFromEvent(event);

    return sensor ? formatSensorLocation(sensor.building, sensor.floor, sensor.location) : '';
  }

  const alarm = event.alarm ?? resolveAlarmFromEvent(event);

  return alarm ? formatSensorLocation(alarm.building, alarm.floor, alarm.location) : '';
}

function resolveSensorFromEvent(event: EventItem) {
  return event.sensorId === null ? null : sensorsStore.sensors.find((sensor) => sensor.id === event.sensorId) ?? null;
}

function resolveAlarmFromEvent(event: EventItem) {
  return event.sensorId === null ? null : alarmsStore.alarms.find((alarm) => alarm.sensorId === event.sensorId) ?? null;
}

function isAlarmEvent(event: EventItem) {
  return event.eventType === 'alarm_activated' || event.eventType === 'alarm_deactivated';
}

function isConcreteAlarmHiddenByBulk(event: EventItem, bulkEvents: EventItem[]) {
  if (!isConcreteAlarmEvent(event)) {
    return false;
  }

  const eventTime = getEventTime(event);

  return bulkEvents.some((bulkEvent) => {
    if (bulkEvent.eventType !== event.eventType) {
      return false;
    }

    return Math.abs(eventTime - getEventTime(bulkEvent)) <= BULK_EVENT_WINDOW_MS;
  });
}

function isManualBulkAlarmEvent(event: EventItem) {
  const eventWithOptionalAlarmId = event as EventItem & { alarmId?: number | null };
  const hasNoSingleTarget =
    event.sensorId == null &&
    eventWithOptionalAlarmId.alarmId == null &&
    !event.sensor?.id &&
    !event.alarm?.id;

  return isAlarmEvent(event) && hasNoSingleTarget;
}

function isAutoBulkAlarmActivationFromSensor(event: EventItem) {
  const eventWithOptionalAlarmId = event as EventItem & { alarmId?: number | null };
  const hasSensor = event.sensorId != null || Boolean(event.sensor?.id);
  const hasNoAlarm = eventWithOptionalAlarmId.alarmId == null && !event.alarm?.id;

  return event.eventType === 'alarm_activated' && hasSensor && hasNoAlarm;
}

function isConcreteAlarmEvent(event: EventItem) {
  const eventWithOptionalAlarmId = event as EventItem & { alarmId?: number | null };

  return isAlarmEvent(event) && (eventWithOptionalAlarmId.alarmId != null || Boolean(event.alarm?.id));
}

function getEventTime(event: EventItem) {
  const timestamp = new Date(event.createdAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

onMounted(async () => {
  await loadDashboard();
});
</script>

<template>
  <section class="dashboard-page dashboard-overview">
    <div
      class="dashboard-hero"
      :class="`dashboard-hero--${heroTone}`"
    >
      <div class="dashboard-hero__content">
        <span class="dashboard-hero__eyebrow">Моніторинг</span>
        <h1>Стан системи</h1>
        <p>{{ heroCopy.description }}</p>
      </div>

      <span
        class="dashboard-hero__pill"
        :class="`dashboard-hero__pill--${heroTone}`"
      >
        <span class="dashboard-hero__dot" />
        {{ heroCopy.pill }}
      </span>
    </div>

    <AppAlert
      v-if="alarmsStore.listError || eventsStore.listError || sensorsStore.listError || notificationsStore.listError"
      title="Частина даних не завантажилась"
      :message="alarmsStore.listError || eventsStore.listError || sensorsStore.listError || notificationsStore.listError"
      tone="warning"
    >
      <AppButton
        variant="ghost"
        @click="loadDashboard"
      >
        Оновити
      </AppButton>
    </AppAlert>

    <section
      v-if="hasActualCriticalState"
      class="dashboard-warning"
    >
      <div>
        <h2>{{ warningTitle }}</h2>
        <p>{{ warningDescription }}</p>
      </div>

      <div
        v-if="activeAlarms.length"
        class="dashboard-warning__alarms"
      >
        <span
          v-for="alarm in activeAlarms"
          :key="alarm.id"
        >
          #{{ alarm.id }} · {{ formatSensorLocation(alarm.building, alarm.floor, alarm.location) }}
        </span>
      </div>

      <RouterLink
        v-if="hasActiveAlarms || hasActiveSmoke"
        to="/alarms"
      >
        <AppButton variant="ghost">
          Усі сигналізації
        </AppButton>
      </RouterLink>
    </section>

    <div class="dashboard-kpi-grid">
      <article
        v-for="card in summaryCards"
        :key="card.title"
        class="dashboard-kpi"
        :class="`dashboard-kpi--${card.tone}`"
      >
        <div class="dashboard-kpi__icon">
          <svg
            v-if="card.icon === 'sensors'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M4 12a8 8 0 0 1 16 0" />
            <path d="M7 12a5 5 0 0 1 10 0" />
            <path d="M10 12a2 2 0 0 1 4 0" />
            <path d="M12 14v.01" />
          </svg>
          <svg
            v-else-if="card.icon === 'alarms'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M12 4 5 19h14L12 4Z" />
            <path d="M12 9v4" />
            <path d="M12 16h.01" />
          </svg>
          <svg
            v-else-if="card.icon === 'events'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M6 7.5h12" />
            <path d="M6 12h12" />
            <path d="M6 16.5h7" />
            <path d="M4 7.5h.01" />
            <path d="M4 12h.01" />
            <path d="M4 16.5h.01" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M7 5h7l3 3v11H7z" />
            <path d="M14 5v3h3" />
            <path d="M9 12h6" />
            <path d="M9 15h6" />
          </svg>
        </div>

        <div>
          <span class="dashboard-kpi__label">{{ card.title }}</span>
          <strong class="dashboard-kpi__value">{{ card.value }}</strong>
          <span class="dashboard-kpi__detail">{{ card.detail }}</span>
        </div>
      </article>
    </div>

    <div class="dashboard-main-grid">
      <section class="dashboard-card dashboard-events-panel">
        <div class="dashboard-section-header">
          <div>
            <h2>Останні події</h2>
            <p>Останні системні зміни.</p>
          </div>

          <RouterLink to="/events">
            <AppButton variant="ghost">
              Усі події
            </AppButton>
          </RouterLink>
        </div>

        <p
          v-if="!dashboardEvents.length"
          class="dashboard-empty-line"
        >
          Подій поки немає.
        </p>

        <div
          v-else
          class="dashboard-event-list"
        >
          <article
            v-for="event in dashboardEvents"
            :key="event.id"
            class="dashboard-event"
          >
            <span
              class="dashboard-event__badge"
              :class="`dashboard-event__badge--${getDashboardEventTone(event)}`"
            >
              {{ getDashboardEventBadgeLabel(event) }}
            </span>

            <div class="dashboard-event__body">
              <strong>{{ getDashboardEventTitle(event) }}</strong>
              <span>{{ resolveEventLocation(event) }}</span>
            </div>

            <time
              class="dashboard-event__time"
              :datetime="event.createdAt"
            >
              {{ formatDateTime(event.createdAt) }}
            </time>
          </article>
        </div>
      </section>

      <aside class="dashboard-side">
        <section class="dashboard-card dashboard-system-card">
          <div class="dashboard-section-header dashboard-section-header--compact">
            <div>
              <h2>Стан системи</h2>
            </div>
          </div>

          <div class="dashboard-system-list">
            <div
              v-for="item in systemStatusItems"
              :key="item.label"
              class="dashboard-system-row"
            >
              <span
                class="dashboard-system-row__dot"
                :class="`dashboard-system-row__dot--${item.tone}`"
              />
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section
          v-if="hasActiveAlarms"
          class="dashboard-card dashboard-active-card"
        >
          <div class="dashboard-section-header dashboard-section-header--compact">
            <div>
              <h2>Активні спрацювання</h2>
              <p>До 3 активних сигналізацій.</p>
            </div>
          </div>

          <div class="dashboard-active-list">
            <article
              v-for="alarm in activeAlarms"
              :key="alarm.id"
              class="dashboard-active-item"
            >
              <strong>Сигналізація #{{ alarm.id }}</strong>
              <span>{{ formatSensorLocation(alarm.building, alarm.floor, alarm.location) }}</span>
            </article>
          </div>

          <RouterLink to="/alarms">
            <AppButton
              variant="ghost"
              full-width
            >
              Усі сигналізації
            </AppButton>
          </RouterLink>
        </section>

        <section class="dashboard-card dashboard-quick-card">
          <div class="dashboard-section-header dashboard-section-header--compact">
            <div>
              <h2>Швидкі дії</h2>
            </div>
          </div>

          <div class="dashboard-quick-actions">
            <RouterLink to="/alarms">
              <AppButton
                variant="ghost"
                full-width
              >
                Перейти до сигналізацій
              </AppButton>
            </RouterLink>
            <RouterLink to="/sensors">
              <AppButton
                variant="ghost"
                full-width
              >
                Перейти до сенсорів
              </AppButton>
            </RouterLink>
            <RouterLink
              v-if="hasCriticalUnreadNotifications"
              to="/notifications"
            >
              <AppButton
                variant="ghost"
                full-width
              >
                Перейти до сповіщень
              </AppButton>
            </RouterLink>
            <RouterLink to="/reports">
              <AppButton
                variant="ghost"
                full-width
              >
                Згенерувати звіт
              </AppButton>
            </RouterLink>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.dashboard-overview {
  gap: 20px;
}

.dashboard-hero,
.dashboard-card,
.dashboard-kpi,
.dashboard-warning {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

.dashboard-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 124px;
  gap: 20px;
  padding: 24px 28px;
  border-radius: 20px;
}

.dashboard-hero--success {
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.9), #ffffff 54%);
}

.dashboard-hero--warning {
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.92), #ffffff 54%);
}

.dashboard-hero--danger {
  border-color: rgba(239, 68, 68, 0.28);
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.94), #ffffff 54%);
}

.dashboard-hero__content {
  min-width: 0;
}

.dashboard-hero__eyebrow {
  display: block;
  margin-bottom: 8px;
  color: var(--accent-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

.dashboard-hero h1,
.dashboard-section-header h2,
.dashboard-warning h2 {
  margin: 0;
  color: #111827;
  letter-spacing: -0.03em;
}

.dashboard-hero h1 {
  font-size: clamp(1.8rem, 2.6vw, 2.3rem);
  line-height: 1.05;
}

.dashboard-hero p,
.dashboard-section-header p,
.dashboard-warning p {
  margin: 8px 0 0;
  color: #6b7280;
  line-height: 1.5;
}

.dashboard-hero__pill {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #ffffff;
  color: #111827;
  font-weight: 700;
  white-space: nowrap;
}

.dashboard-hero__pill--success {
  border-color: rgba(16, 185, 129, 0.24);
  color: #059669;
}

.dashboard-hero__pill--warning {
  border-color: rgba(245, 158, 11, 0.28);
  color: #b45309;
}

.dashboard-hero__pill--danger {
  border-color: rgba(239, 68, 68, 0.28);
  color: #dc2626;
}

.dashboard-hero__dot,
.dashboard-system-row__dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: currentColor;
}

.dashboard-warning {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  padding: 18px 20px;
  border-color: rgba(239, 68, 68, 0.22);
  border-radius: 18px;
  background: #fff7f7;
}

.dashboard-warning h2 {
  font-size: 1.1rem;
}

.dashboard-warning__alarms {
  display: grid;
  gap: 6px;
  color: #991b1b;
  font-size: 0.9rem;
}

.dashboard-kpi-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dashboard-kpi {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 116px;
  padding: 20px;
  overflow: hidden;
  border-radius: 18px;
}

.dashboard-kpi::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  border-radius: 999px;
  background: transparent;
  content: '';
}

.dashboard-kpi__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: #f3f4f6;
  color: #6b7280;
}

.dashboard-kpi__icon svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dashboard-kpi--success .dashboard-kpi__icon,
.dashboard-kpi--success::before {
  background: #10b981;
}

.dashboard-kpi--success .dashboard-kpi__icon {
  background: #ecfdf5;
  color: #059669;
}

.dashboard-kpi--success .dashboard-kpi__value {
  color: #059669;
}

.dashboard-kpi--warning::before {
  background: #f59e0b;
}

.dashboard-kpi--warning .dashboard-kpi__icon {
  background: #fffbeb;
  color: #b45309;
}

.dashboard-kpi--warning .dashboard-kpi__value {
  color: #f59e0b;
}

.dashboard-kpi--danger {
  border-color: rgba(239, 68, 68, 0.24);
}

.dashboard-kpi--danger::before {
  background: #ef4444;
}

.dashboard-kpi--danger .dashboard-kpi__icon {
  background: #fef2f2;
  color: #dc2626;
}

.dashboard-kpi--danger .dashboard-kpi__value {
  color: #ef4444;
}

.dashboard-kpi--neutral .dashboard-kpi__icon {
  background: #f3f4f6;
  color: #6b7280;
}

.dashboard-kpi--neutral .dashboard-kpi__value {
  color: #111827;
}

.dashboard-kpi__label,
.dashboard-kpi__detail {
  display: block;
  color: #6b7280;
}

.dashboard-kpi__label {
  margin-bottom: 6px;
  font-weight: 700;
}

.dashboard-kpi__value {
  display: block;
  width: fit-content;
  margin-bottom: 4px;
  color: #111827;
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.03em;
  background: transparent;
}

.dashboard-kpi__detail {
  font-size: 0.92rem;
}

.dashboard-main-grid {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.9fr);
}

.dashboard-side {
  display: grid;
  gap: 20px;
}

.dashboard-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 20px;
}

.dashboard-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-section-header h2 {
  font-size: 1.25rem;
}

.dashboard-section-header--compact {
  display: block;
}

.dashboard-empty-line {
  margin: 0;
  padding: 16px 0 4px;
  color: #6b7280;
}

.dashboard-event-list {
  display: grid;
  gap: 0;
}

.dashboard-system-list,
.dashboard-active-list,
.dashboard-quick-actions {
  display: grid;
  gap: 12px;
}

.dashboard-event {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) auto;
  column-gap: 20px;
  align-items: start;
  padding: 18px 0;
  border-bottom: 1px solid #e5e7eb;
}

.dashboard-event:first-child {
  padding-top: 0;
}

.dashboard-event:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.dashboard-event__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
  width: fit-content;
  max-width: 160px;
  height: 32px;
  padding: 0 14px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.dashboard-event__badge--success {
  border-color: rgba(16, 185, 129, 0.2);
  background: rgba(16, 185, 129, 0.1);
  color: #047857;
}

.dashboard-event__badge--warning {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.dashboard-event__badge--danger {
  border-color: rgba(239, 68, 68, 0.22);
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.dashboard-event__body {
  display: grid;
  min-width: 0;
}

.dashboard-event__body strong {
  color: #111827;
  line-height: 1.3;
}

.dashboard-event__body span {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.dashboard-event__time {
  color: #6b7280;
  line-height: 1.35;
  white-space: nowrap;
  text-align: right;
  font-size: 0.9rem;
}

.dashboard-system-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
}

.dashboard-system-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.dashboard-system-row strong {
  color: #111827;
}

.dashboard-system-row__dot--success {
  background: #10b981;
}

.dashboard-system-row__dot--warning {
  background: #f59e0b;
}

.dashboard-system-row__dot--danger {
  background: #ef4444;
}

.dashboard-active-card {
  border-color: rgba(239, 68, 68, 0.2);
}

.dashboard-active-item {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 14px;
  background: #fef2f2;
}

.dashboard-active-item strong {
  color: #991b1b;
}

.dashboard-active-item span {
  color: #6b7280;
}

.dashboard-quick-actions a {
  display: block;
}

@media (max-width: 1180px) {
  .dashboard-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .dashboard-hero,
  .dashboard-section-header,
  .dashboard-warning {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .dashboard-hero {
    flex-direction: column;
    min-height: 0;
    padding: 22px;
  }

  .dashboard-hero__pill,
  .dashboard-section-header :deep(.app-button),
  .dashboard-warning :deep(.app-button) {
    width: 100%;
  }

  .dashboard-kpi-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-event {
    grid-template-columns: minmax(118px, auto) minmax(0, 1fr);
    gap: 10px 12px;
  }

  .dashboard-event__time {
    grid-column: 2;
    text-align: left;
    white-space: normal;
  }
}
</style>
