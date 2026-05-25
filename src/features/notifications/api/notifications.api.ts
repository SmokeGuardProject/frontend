import { apiClient } from '@/shared/api/client';
import type { NotificationFilters, NotificationItem } from '@/features/notifications/model/notification.types';

export const notificationsApi = {
  async getNotifications(filters: NotificationFilters = {}) {
    const { data } = await apiClient.get<NotificationItem[]>('/notifications/my', {
      params: filters,
    });
    return data;
  },

  async getUnreadCount() {
    const { data } = await apiClient.get<number>('/notifications/unread-count');
    return data;
  },

  async markAllAsRead() {
    await apiClient.patch('/notifications/read-all');
  },
};
