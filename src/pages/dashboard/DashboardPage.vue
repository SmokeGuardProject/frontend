<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { formatEventType, getEventTone } from '@/features/events/lib/formatters';
import { useEventsStore } from '@/features/events/model/use-events-store';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';

const sensorsStore = useSensorsStore();
const alarmsStore = useAlarmsStore();
const eventsStore = useEventsStore();
const notificationsStore = useNotificationsStore();

const summaryCards = computed(() => [
  {
    title: 'Sensors online',
    value: String(sensorsStore.activeSensorsCount),
    tone: 'success' as const,
  },
  {
    title: 'Active alarms',
    value: String(alarmsStore.activeCount),
    tone: alarmsStore.activeCount > 0 ? ('danger' as const) : ('success' as const),
  },
  {
    title: 'Critical events',
    value: String(eventsStore.criticalEventsCount),
    tone: eventsStore.criticalEventsCount > 0 ? ('danger' as const) : ('neutral' as const),
  },
  {
    title: 'Unread notifications',
    value: String(notificationsStore.unreadCount),
    tone: notificationsStore.unreadCount > 0 ? ('warning' as const) : ('success' as const),
  },
]);

const activeAlarms = computed(() => alarmsStore.alarms.filter((alarm) => alarm.status === 'active').slice(0, 5));
const recentEvents = computed(() => eventsStore.events.slice(0, 6));
const unreadNotifications = computed(() =>
  notificationsStore.notifications.filter((notification) => !notification.read).slice(0, 5),
);
const attentionSensors = computed(() =>
  sensorsStore.sensors.filter((sensor) => sensor.status !== 'active').slice(0, 5),
);

const heroStatus = computed(() => {
  if (alarmsStore.activeCount > 0) {
    return 'Critical alarm state';
  }

  if (notificationsStore.unreadCount > 0 || attentionSensors.value.length > 0) {
    return 'Operator attention required';
  }

  return 'Monitoring nominal';
});

async function loadDashboard() {
  await Promise.all([
    sensorsStore.fetchSensors(),
    alarmsStore.fetchAlarms(),
    eventsStore.fetchEvents({ limit: 20, offset: 0 }),
    eventsStore.fetchStatistics(),
    notificationsStore.fetchNotifications({ limit: 20, offset: 0 }),
    notificationsStore.fetchUnreadCount(),
  ]);
}

function resolveEventLocation(eventId: number) {
  const event = eventsStore.events.find((item) => item.id === eventId);

  if (!event?.sensor) {
    return 'No sensor context';
  }

  return formatSensorLocation(event.sensor.building, event.sensor.floor, event.sensor.location);
}

onMounted(async () => {
  await loadDashboard();
});
</script>

<template>
  <section class="dashboard-page">
    <div class="hero-panel">
      <div>
        <span class="hero-panel__eyebrow">Monitoring overview</span>
        <h1>Smoke detection operations</h1>
      </div>

      <div class="hero-panel__indicator">
        <span class="hero-panel__dot" />
        {{ heroStatus }}
      </div>
    </div>

    <div class="dashboard-summary-grid">
      <StatusCard
        v-for="card in summaryCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :tone="card.tone"
      />
    </div>

    <div class="dashboard-grid">
      <section class="ui-card dashboard-panel dashboard-panel--wide">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Alarm response</span>
            <h2>Активні сигналізації</h2>
          </div>
          <RouterLink to="/alarms">
            <AppButton variant="ghost">
              Всі сигналізації
            </AppButton>
          </RouterLink>
        </div>

        <AppEmptyState
          v-if="!activeAlarms.length"
          title="Активних сигналізацій немає"
        />

        <div
          v-else
          class="dashboard-list"
        >
          <article
            v-for="alarm in activeAlarms"
            :key="alarm.id"
            class="dashboard-list__item dashboard-list__item--critical"
          >
            <div class="dashboard-list__content">
              <div class="dashboard-list__top">
                <strong>#{{ alarm.id }} {{ alarm.location }}</strong>
                <AppBadge tone="danger">
                  Active
                </AppBadge>
              </div>
              <p>{{ formatSensorLocation(alarm.building, alarm.floor, alarm.location) }}</p>
              <span class="app-header__meta">Activated: {{ formatDateTime(alarm.activatedAt) }}</span>
            </div>
            <RouterLink :to="`/alarms/${alarm.id}`">
              <AppButton variant="ghost">
                Перейти
              </AppButton>
            </RouterLink>
          </article>
        </div>
      </section>

      <section class="ui-card dashboard-panel">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Attention queue</span>
            <h2>Сенсори без активного статусу</h2>
          </div>
          <RouterLink to="/sensors">
            <AppButton variant="ghost">
              Всі сенсори
            </AppButton>
          </RouterLink>
        </div>

        <AppEmptyState
          v-if="!attentionSensors.length"
          title="Усі сенсори активні"
        />

        <div
          v-else
          class="dashboard-list"
        >
          <article
            v-for="sensor in attentionSensors"
            :key="sensor.id"
            class="dashboard-list__item"
          >
            <div class="dashboard-list__content">
              <div class="dashboard-list__top">
                <strong>#{{ sensor.id }} {{ sensor.location }}</strong>
                <AppBadge tone="warning">
                  {{ sensor.status }}
                </AppBadge>
              </div>
              <p>{{ formatSensorLocation(sensor.building, sensor.floor, sensor.location) }}</p>
              <span class="app-header__meta">Last heartbeat: {{ formatDateTime(sensor.lastCheckedAt) }}</span>
            </div>
            <RouterLink :to="`/sensors/${sensor.id}`">
              <AppButton variant="ghost">
                Перейти
              </AppButton>
            </RouterLink>
          </article>
        </div>
      </section>

      <section class="ui-card dashboard-panel dashboard-panel--wide">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Event timeline</span>
            <h2>Останні події</h2>
          </div>
          <RouterLink to="/events">
            <AppButton variant="ghost">
              Всі події
            </AppButton>
          </RouterLink>
        </div>

        <AppEmptyState
          v-if="!recentEvents.length"
          title="Подій ще немає"
        />

        <div
          v-else
          class="dashboard-events"
        >
          <article
            v-for="event in recentEvents"
            :key="event.id"
            class="dashboard-events__item"
          >
            <div class="dashboard-events__meta">
              <AppBadge :tone="getEventTone(event.eventType)">
                {{ formatEventType(event.eventType) }}
              </AppBadge>
              <span class="app-header__meta">{{ formatDateTime(event.createdAt) }}</span>
            </div>
            <strong>Event #{{ event.id }}</strong>
            <p>{{ resolveEventLocation(event.id) }}</p>
          </article>
        </div>
      </section>

      <section class="ui-card dashboard-panel">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Notification inbox</span>
            <h2>Непрочитані сповіщення</h2>
          </div>
          <RouterLink to="/notifications">
            <AppButton variant="ghost">
              Всі сповіщення
            </AppButton>
          </RouterLink>
        </div>

        <AppEmptyState
          v-if="!unreadNotifications.length"
          title="Усі сповіщення прочитані"
        />

        <div
          v-else
          class="dashboard-list"
        >
          <article
            v-for="notification in unreadNotifications"
            :key="notification.id"
            class="dashboard-list__item"
          >
            <div class="dashboard-list__content">
              <div class="dashboard-list__top">
                <strong>{{ notification.message }}</strong>
                <AppBadge :tone="getEventTone(notification.event.eventType)">
                  {{ formatEventType(notification.event.eventType) }}
                </AppBadge>
              </div>
              <p>{{ formatDateTime(notification.createdAt) }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
