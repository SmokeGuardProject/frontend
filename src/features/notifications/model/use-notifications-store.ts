import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { notificationsApi } from '@/features/notifications/api/notifications.api';
import { isCriticalNotificationEvent } from '@/features/notifications/lib/event-type-meta';
import type { NotificationFilters, NotificationItem } from '@/features/notifications/model/notification.types';
import { normalizeApiError } from '@/shared/api/normalize-api-error';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationItem[]>([]);
  const notificationPreviewItems = ref<NotificationItem[]>([]);
  const unreadCount = ref(0);
  const isLoadingInitial = ref(false);
  const isLoadingMore = ref(false);
  const previewLoading = ref(false);
  const countLoading = ref(false);
  const markAllLoading = ref(false);
  const listError = ref('');
  const previewError = ref('');
  const countError = ref('');
  const actionError = ref('');
  const filters = ref<NotificationFilters>({
    offset: 0,
    limit: 100,
  });
  const listRequestToken = ref(0);

  const listLoading = computed(() => isLoadingInitial.value || isLoadingMore.value);

  const criticalUnreadCount = computed(
    () =>
      notifications.value.filter(
        (notification) =>
          !notification.read &&
          isCriticalNotificationEvent(notification.event?.eventType),
      ).length,
  );

  function appendNotifications(nextNotifications: NotificationItem[]) {
    const existingNotificationIds = new Set(notifications.value.map((notification) => notification.id));
    const uniqueNextNotifications = nextNotifications.filter(
      (notification) => !existingNotificationIds.has(notification.id),
    );

    notifications.value = [...notifications.value, ...uniqueNextNotifications];
  }

  function prependNotification(notification: NotificationItem) {
    const existsInList = notifications.value.some((item) => item.id === notification.id);
    const existsInPreview = notificationPreviewItems.value.some((item) => item.id === notification.id);

    if (!existsInList) {
      notifications.value = [notification, ...notifications.value];
    }

    if (!existsInPreview) {
      notificationPreviewItems.value = [notification, ...notificationPreviewItems.value].slice(0, 5);
    }

    if (!notification.read && !existsInList && !existsInPreview) {
      unreadCount.value += 1;
    }
  }

  async function fetchNotifications(
    nextFilters?: NotificationFilters,
    options: { append?: boolean; reset?: boolean } = {},
  ) {
    const shouldAppend = options.append === true || options.reset === false;
    const loadingState = shouldAppend ? isLoadingMore : isLoadingInitial;

    if (shouldAppend && loadingState.value) {
      return [];
    }

    loadingState.value = true;
    listError.value = '';
    let requestToken = listRequestToken.value;

    try {
      const requestFilters = nextFilters
        ? {
            ...filters.value,
            ...nextFilters,
          }
        : filters.value;

      if (!shouldAppend) {
        listRequestToken.value += 1;
        requestToken = listRequestToken.value;
        filters.value = requestFilters;
        notifications.value = [];
      }

      const nextNotifications = await notificationsApi.getNotifications(requestFilters);
      if (requestToken !== listRequestToken.value) {
        return nextNotifications;
      }

      if (shouldAppend) {
        appendNotifications(nextNotifications);
      } else {
        notifications.value = nextNotifications;
      }

      return nextNotifications;
    } catch (error) {
      listError.value = normalizeApiError(error, 'Не вдалося завантажити сповіщення. Спробуйте оновити сторінку.');
      throw error;
    } finally {
      if (shouldAppend || requestToken === listRequestToken.value) {
        loadingState.value = false;
      }
    }
  }

  async function fetchNotificationPreview(filters: NotificationFilters = { offset: 0, limit: 3 }) {
    previewLoading.value = true;
    previewError.value = '';

    try {
      notificationPreviewItems.value = await notificationsApi.getNotifications(filters);
      return notificationPreviewItems.value;
    } catch (error) {
      previewError.value = normalizeApiError(error, 'Не вдалося завантажити останні сповіщення.');
      throw error;
    } finally {
      previewLoading.value = false;
    }
  }

  async function fetchUnreadCount() {
    countLoading.value = true;
    countError.value = '';

    try {
      unreadCount.value = await notificationsApi.getUnreadCount();
    } catch (error) {
      countError.value = normalizeApiError(error, 'Не вдалося завантажити кількість непрочитаних сповіщень.');
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
      notificationPreviewItems.value = notificationPreviewItems.value.map((notification) => ({
        ...notification,
        read: true,
      }));
      unreadCount.value = 0;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Не вдалося позначити сповіщення як прочитані.');
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
    fetchNotificationPreview,
    filters,
    isLoadingInitial,
    isLoadingMore,
    listError,
    listLoading,
    markAllLoading,
    notificationPreviewItems,
    notifications,
    previewError,
    previewLoading,
    unreadCount,
    appendNotifications,
    fetchNotifications,
    fetchUnreadCount,
    markAllAsRead,
    prependNotification,
  };
});
