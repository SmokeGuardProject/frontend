<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { getNotificationEventMeta } from '@/features/notifications/lib/event-type-meta';
import type { NotificationItem } from '@/features/notifications/model/notification.types';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import { formatSensorLocation } from '@/features/sensors/lib/formatters';
import type { Sensor } from '@/features/sensors/model/sensor.types';
import AppButton from '@/shared/ui/AppButton.vue';
import { showToast } from '@/shared/ui/use-toast';

const notificationsStore = useNotificationsStore();
const sensorsStore = useSensorsStore();
const router = useRouter();
const isOpen = ref(false);
const PREVIEW_NOTIFICATIONS_LIMIT = 5;

const notificationPreviewItems = computed(() => notificationsStore.notificationPreviewItems);

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatNotificationLocation(sensor?: Sensor | null) {
  if (!sensor) {
    return '';
  }

  return formatSensorLocation(sensor.building, sensor.floor, sensor.location);
}

function notificationLocation(notification: NotificationItem) {
  const eventSensor = notification.event?.sensor;

  if (eventSensor) {
    return formatNotificationLocation(eventSensor);
  }

  const sensorId = notification.event?.sensorId;

  if (sensorId === null || sensorId === undefined) {
    return findSensorLocationFromMessage(notification.message) || '';
  }

  const sensor = sensorsStore.sensors.find((item) => item.id === sensorId);

  return sensor ? formatNotificationLocation(sensor) : findSensorLocationFromMessage(notification.message) || '';
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

async function handleOpenChange(open: boolean) {
  isOpen.value = open;

  if (open) {
    await Promise.all([
      notificationsStore.fetchNotificationPreview({ limit: PREVIEW_NOTIFICATIONS_LIMIT, offset: 0 }),
      notificationsStore.fetchUnreadCount(),
      sensorsStore.sensors.length ? Promise.resolve() : sensorsStore.fetchSensors().catch(() => undefined),
    ]);
  }
}

async function markAllRead() {
  await notificationsStore.markAllAsRead();
  showToast({
    title: 'Готово',
    message: 'Усі сповіщення позначено як прочитані.',
    tone: 'success',
  });
}

async function openNotificationsPage() {
  isOpen.value = false;
  await router.push('/notifications');
}

onMounted(async () => {
  await notificationsStore.fetchUnreadCount();
});
</script>

<template>
  <PopoverRoot
    :open="isOpen"
    @update:open="handleOpenChange"
  >
    <PopoverTrigger
      as-child
    >
      <button
        class="notification-center__trigger"
        type="button"
        aria-label="Відкрити сповіщення"
      >
        <span
          class="notification-center__icon"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M9.5 18.5h5" />
            <path
              d="M6.5 16.5h11l-1.3-1.8a3 3 0 0 1-.6-1.77V10a4.6 4.6 0 1 0-9.2 0v2.93c0 .63-.2 1.24-.57 1.76L4.5 16.5h2Z"
            />
          </svg>
        </span>
        <span
          v-if="notificationsStore.unreadCount"
          class="notification-center__count"
        >
          {{ notificationsStore.unreadCount }}
        </span>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="notification-center__panel"
        side="bottom"
        align="end"
        :side-offset="12"
        :collision-padding="16"
      >
        <div class="notification-center__header">
          <h3>Останні сповіщення</h3>
          <AppButton
            class="notification-center__mark-all"
            variant="ghost"
            :disabled="notificationsStore.unreadCount === 0"
            :loading="notificationsStore.markAllLoading"
            @click="markAllRead"
          >
            Прочитати все
          </AppButton>
        </div>

        <div
          v-if="notificationPreviewItems.length"
          class="notification-center__list"
        >
          <article
            v-for="notification in notificationPreviewItems"
            :key="notification.id"
            class="notification-center__item"
            :class="{ 'notification-center__item--unread': !notification.read }"
          >
            <span
              class="notification-center__event-dot"
              :class="`notification-center__event-dot--${getNotificationEventMeta(notification.event?.eventType).severity}`"
              aria-hidden="true"
            />
            <div class="notification-center__item-body">
              <h4>{{ getNotificationEventMeta(notification.event?.eventType).label }}</h4>
              <p v-if="notificationLocation(notification)">{{ notificationLocation(notification) }}</p>
            </div>
            <div class="notification-center__item-side">
              <time :datetime="notification.createdAt">
                {{ formatNotificationTime(notification.createdAt) }}
              </time>
              <span
                v-if="!notification.read"
                class="notification-center__unread-dot"
                aria-label="Непрочитане"
              />
            </div>
          </article>
        </div>
        <div
          v-else
          class="notification-center__empty"
        >
          <strong>Сповіщень поки немає</strong>
          <span>Нові системні повідомлення з’являться тут.</span>
        </div>

        <AppButton
          class="notification-center__footer-button"
          variant="ghost"
          full-width
          @click="openNotificationsPage"
        >
          Відкрити всі сповіщення
        </AppButton>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.notification-center__trigger {
  position: relative;
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  gap: 0;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #f4f7f6);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    transform var(--transition-base);
}

.notification-center__trigger:hover {
  border-color: rgba(19, 138, 99, 0.2);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.09);
  transform: translateY(-1px);
}

.notification-center__trigger[aria-expanded='true'] {
  border-color: rgba(19, 138, 99, 0.28);
  box-shadow: 0 0 0 4px rgba(19, 138, 99, 0.08);
}

.notification-center__icon {
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.notification-center__icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.notification-center__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0.15rem;
  right: 0.05rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.22rem;
  border-radius: 999px;
  border: 2px solid #ffffff;
  background: var(--accent-danger);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  box-shadow: 0 6px 14px rgba(239, 68, 68, 0.22);
}
</style>
