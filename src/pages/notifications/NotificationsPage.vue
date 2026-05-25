<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { formatEventType, getEventTone } from '@/features/events/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';

const notificationsStore = useNotificationsStore();

const summaryCards = computed(() => [
  {
    title: 'Unread notifications',
    value: String(notificationsStore.unreadCount),
    tone: 'warning' as const,
  },
  {
    title: 'Critical unread',
    value: String(notificationsStore.criticalUnreadCount),
    tone: 'danger' as const,
  },
  {
    title: 'Loaded notifications',
    value: String(notificationsStore.notifications.length),
    tone: 'neutral' as const,
  },
]);

async function loadPage() {
  await Promise.all([
    notificationsStore.fetchNotifications(),
    notificationsStore.fetchUnreadCount(),
  ]);
}

function notificationLocation(index: number) {
  const notification = notificationsStore.notifications[index];

  if (!notification?.event?.sensor) {
    return 'No sensor context';
  }

  return formatSensorLocation(
    notification.event.sensor.building,
    notification.event.sensor.floor,
    notification.event.sensor.location,
  );
}

onMounted(async () => {
  await loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Notifications</span>
        <h1>Оповіщення оператора</h1>
      </div>

      <AppButton
        :loading="notificationsStore.markAllLoading"
        @click="notificationsStore.markAllAsRead()"
      >
        Позначити все як прочитане
      </AppButton>
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

    <section class="ui-card">
      <div class="section-header">
        <div>
          <span class="ui-card__label">Inbox</span>
          <h2>Стрічка повідомлень</h2>
        </div>
        <span class="app-header__meta">
          {{ notificationsStore.listLoading ? 'Оновлення...' : `${notificationsStore.notifications.length} items` }}
        </span>
      </div>

      <AppAlert
        v-if="notificationsStore.listError || notificationsStore.actionError || notificationsStore.countError"
        title="Notifications unavailable"
        :message="notificationsStore.listError || notificationsStore.actionError || notificationsStore.countError"
        tone="warning"
      >
        <AppButton @click="loadPage">
          Retry
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!notificationsStore.listLoading && !notificationsStore.notifications.length"
        title="Сповіщень поки немає"
      />

      <div
        v-else
        class="notifications-list"
      >
        <article
          v-for="(notification, index) in notificationsStore.notifications"
          :key="notification.id"
          class="notification-card"
          :class="{ 'notification-card--unread': !notification.read }"
        >
          <div class="notification-card__meta">
            <AppBadge :tone="getEventTone(notification.event.eventType)">
              {{ formatEventType(notification.event.eventType) }}
            </AppBadge>
            <span class="app-header__meta">{{ formatDateTime(notification.createdAt) }}</span>
          </div>
          <h3>{{ notification.message }}</h3>
          <p>{{ notificationLocation(index) }}</p>
          <div class="notification-card__footer">
            <span class="app-header__meta">Event #{{ notification.eventId }}</span>
            <AppBadge :tone="notification.read ? 'success' : 'warning'">
              {{ notification.read ? 'Read' : 'Unread' }}
            </AppBadge>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
