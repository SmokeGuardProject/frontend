<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { formatEventType, getEventTone } from '@/features/events/lib/formatters';
import { formatDateTime } from '@/features/sensors/lib/formatters';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';

const notificationsStore = useNotificationsStore();
const router = useRouter();
const isOpen = ref(false);
const notificationCenterRef = ref<HTMLElement | null>(null);

const previewNotifications = computed(() => notificationsStore.notifications.slice(0, 5));

function handleClickOutside(event: PointerEvent) {
  if (!isOpen.value) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Node)) {
    return;
  }

  if (!notificationCenterRef.value?.contains(target)) {
    isOpen.value = false;
  }
}

async function togglePanel() {
  isOpen.value = !isOpen.value;

  if (isOpen.value && !notificationsStore.notifications.length) {
    await Promise.all([
      notificationsStore.fetchNotifications({ limit: 5, offset: 0 }),
      notificationsStore.fetchUnreadCount(),
    ]);
  }
}

async function markAllRead() {
  await notificationsStore.markAllAsRead();
}

async function openNotificationsPage() {
  isOpen.value = false;
  await router.push('/notifications');
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleClickOutside);
  await notificationsStore.fetchUnreadCount();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleClickOutside);
});
</script>

<template>
  <div
    ref="notificationCenterRef"
    class="notification-center"
  >
    <button
      class="notification-center__trigger"
      type="button"
      @click="togglePanel"
    >
      <span>Notifications</span>
      <span
        v-if="notificationsStore.unreadCount"
        class="notification-center__count"
      >
        {{ notificationsStore.unreadCount }}
      </span>
    </button>

    <div
      v-if="isOpen"
      class="notification-center__panel"
    >
      <div class="notification-center__header">
        <div>
          <span class="ui-card__label">Notification center</span>
          <h3>Останні сповіщення</h3>
        </div>
        <AppButton
          variant="ghost"
          :loading="notificationsStore.markAllLoading"
          @click="markAllRead"
        >
          Read all
        </AppButton>
      </div>

      <div
        v-if="previewNotifications.length"
        class="notification-center__list"
      >
        <article
          v-for="notification in previewNotifications"
          :key="notification.id"
          class="notification-center__item"
        >
          <div class="notification-center__item-meta">
            <AppBadge :tone="getEventTone(notification.event.eventType)">
              {{ formatEventType(notification.event.eventType) }}
            </AppBadge>
            <span class="app-header__meta">{{ formatDateTime(notification.createdAt) }}</span>
          </div>
          <p>{{ notification.message }}</p>
        </article>
      </div>
      <p
        v-else
        class="app-header__meta"
      >
        Нових сповіщень немає.
      </p>

      <AppButton
        variant="ghost"
        @click="openNotificationsPage"
      >
        Відкрити всі сповіщення
      </AppButton>
    </div>
  </div>
</template>
