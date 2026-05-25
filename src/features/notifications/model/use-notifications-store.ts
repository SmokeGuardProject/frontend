import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { notificationsApi } from '@/features/notifications/api/notifications.api';
import type { NotificationFilters, NotificationItem } from '@/features/notifications/model/notification.types';
import { normalizeApiError } from '@/shared/api/normalize-api-error';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationItem[]>([]);
  const unreadCount = ref(0);
  const listLoading = ref(false);
  const countLoading = ref(false);
  const markAllLoading = ref(false);
  const listError = ref('');
  const countError = ref('');
  const actionError = ref('');
  const filters = ref<NotificationFilters>({
    offset: 0,
    limit: 100,
  });

  const criticalUnreadCount = computed(
    () =>
      notifications.value.filter(
        (notification) =>
          !notification.read &&
          ['smoke_detected', 'alarm_activated'].includes(notification.event.eventType),
      ).length,
  );

  async function fetchNotifications(nextFilters?: NotificationFilters) {
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = {
          ...filters.value,
          ...nextFilters,
        };
      }

      notifications.value = await notificationsApi.getNotifications(filters.value);
    } catch (error) {
      listError.value = normalizeApiError(error, 'Failed to load notifications.');
      throw error;
    } finally {
      listLoading.value = false;
    }
  }

  async function fetchUnreadCount() {
    countLoading.value = true;
    countError.value = '';

    try {
      unreadCount.value = await notificationsApi.getUnreadCount();
    } catch (error) {
      countError.value = normalizeApiError(error, 'Failed to load unread count.');
      throw error;
    } finally {
      countLoading.value = false;
    }
  }

  async function markAllAsRead() {
    markAllLoading.value = true;
    actionError.value = '';

    try {
      await notificationsApi.markAllAsRead();
      notifications.value = notifications.value.map((notification) => ({
        ...notification,
        read: true,
      }));
      unreadCount.value = 0;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to mark notifications as read.');
      throw error;
    } finally {
      markAllLoading.value = false;
    }
  }

  return {
    actionError,
    countError,
    countLoading,
    criticalUnreadCount,
    filters,
    listError,
    listLoading,
    markAllLoading,
    notifications,
    unreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAllAsRead,
  };
});
