import { apiClient } from '@/shared/api/client';
import type {
  Alarm,
  AlarmFilters,
  BulkAlarmActionResult,
  CreateAlarmPayload,
  UpdateAlarmPayload,
} from '@/features/alarms/model/alarm.types';

export const alarmsApi = {
  async getAlarms(filters: AlarmFilters = {}) {
    const { data } = await apiClient.get<Alarm[]>('/alarms', {
      params: filters,
    });
    return data;
  },

  async getAlarm(id: number) {
    const { data } = await apiClient.get<Alarm>(`/alarms/${id}`);
    return data;
  },

  async createAlarm(payload: CreateAlarmPayload) {
    const { data } = await apiClient.post<Alarm>('/alarms', payload);
    return data;
  },

  async updateAlarm(id: number, payload: UpdateAlarmPayload) {
    const { data } = await apiClient.patch<Alarm>(`/alarms/${id}`, payload);
    return data;
  },

  async deleteAlarm(id: number) {
    await apiClient.delete(`/alarms/${id}`);
  },

  async activateAlarm(id: number) {
    const { data } = await apiClient.post<Alarm>(`/alarms/${id}/activate`);
    return data;
  },

  async deactivateAlarm(id: number) {
    const { data } = await apiClient.post<Alarm>(`/alarms/${id}/deactivate`);
    return data;
  },

  async activateAllAlarms() {
    const { data } = await apiClient.post<BulkAlarmActionResult>('/alarms/activate-all');
    return data;
  },

  async deactivateAllAlarms() {
    const { data } = await apiClient.post<BulkAlarmActionResult>('/alarms/deactivate-all');
    return data;
  },
};
