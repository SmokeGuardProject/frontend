import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { alarmsApi } from '@/features/alarms/api/alarms.api';
import { normalizeApiError } from '@/shared/api/normalize-api-error';
import type {
  Alarm,
  AlarmFilters,
  CreateAlarmPayload,
  UpdateAlarmPayload,
} from '@/features/alarms/model/alarm.types';

export const useAlarmsStore = defineStore('alarms', () => {
  const alarms = ref<Alarm[]>([]);
  const currentAlarm = ref<Alarm | null>(null);
  const filters = ref<AlarmFilters>({
    status: '',
    offset: 0,
    limit: 100,
  });
  const listLoading = ref(false);
  const detailLoading = ref(false);
  const submitLoading = ref(false);
  const listError = ref('');
  const detailError = ref('');
  const submitError = ref('');
  const actionError = ref('');
  const activeAction = ref<{ alarmId: number; type: 'activate' | 'deactivate' | 'delete' | null }>({
    alarmId: 0,
    type: null,
  });

  const activeCount = computed(() => alarms.value.filter((alarm) => alarm.status === 'active').length);
  const inactiveCount = computed(() => alarms.value.filter((alarm) => alarm.status === 'inactive').length);

  async function fetchAlarms(nextFilters?: AlarmFilters) {
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = {
          ...filters.value,
          ...nextFilters,
        };
      }

      alarms.value = await alarmsApi.getAlarms(normalizeAlarmFilters(filters.value));
    } catch (error) {
      listError.value = normalizeApiError(error, 'Failed to load alarms.');
      throw error;
    } finally {
      listLoading.value = false;
    }
  }

  async function fetchAlarm(id: number) {
    detailLoading.value = true;
    detailError.value = '';

    try {
      currentAlarm.value = await alarmsApi.getAlarm(id);
    } catch (error) {
      detailError.value = normalizeApiError(error, 'Failed to load alarm details.');
      throw error;
    } finally {
      detailLoading.value = false;
    }
  }

  async function createAlarm(payload: CreateAlarmPayload) {
    submitLoading.value = true;
    submitError.value = '';

    try {
      const alarm = await alarmsApi.createAlarm(payload);
      alarms.value = [alarm, ...alarms.value];
      return alarm;
    } catch (error) {
      submitError.value = normalizeApiError(error, 'Failed to create alarm.');
      throw error;
    } finally {
      submitLoading.value = false;
    }
  }

  async function updateAlarm(id: number, payload: UpdateAlarmPayload) {
    submitLoading.value = true;
    submitError.value = '';

    try {
      const updated = await alarmsApi.updateAlarm(id, payload);
      syncAlarm(updated);
      return updated;
    } catch (error) {
      submitError.value = normalizeApiError(error, 'Failed to update alarm.');
      throw error;
    } finally {
      submitLoading.value = false;
    }
  }

  async function activateAlarm(id: number) {
    activeAction.value = { alarmId: id, type: 'activate' };
    actionError.value = '';

    try {
      const updated = await alarmsApi.activateAlarm(id);
      syncAlarm(updated);
      return updated;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to activate alarm.');
      throw error;
    } finally {
      activeAction.value = { alarmId: 0, type: null };
    }
  }

  async function deactivateAlarm(id: number) {
    activeAction.value = { alarmId: id, type: 'deactivate' };
    actionError.value = '';

    try {
      const updated = await alarmsApi.deactivateAlarm(id);
      syncAlarm(updated);
      return updated;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to deactivate alarm.');
      throw error;
    } finally {
      activeAction.value = { alarmId: 0, type: null };
    }
  }

  async function deleteAlarm(id: number) {
    activeAction.value = { alarmId: id, type: 'delete' };
    actionError.value = '';

    try {
      await alarmsApi.deleteAlarm(id);
      alarms.value = alarms.value.filter((alarm) => alarm.id !== id);

      if (currentAlarm.value?.id === id) {
        currentAlarm.value = null;
      }
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to delete alarm.');
      throw error;
    } finally {
      activeAction.value = { alarmId: 0, type: null };
    }
  }

  function isActionPending(alarmId: number, type?: 'activate' | 'deactivate' | 'delete') {
    if (type) {
      return activeAction.value.alarmId === alarmId && activeAction.value.type === type;
    }

    return activeAction.value.alarmId === alarmId;
  }

  function syncAlarm(alarm: Alarm) {
    currentAlarm.value = currentAlarm.value?.id === alarm.id ? alarm : currentAlarm.value;
    alarms.value = alarms.value.some((item) => item.id === alarm.id)
      ? alarms.value.map((item) => (item.id === alarm.id ? alarm : item))
      : [alarm, ...alarms.value];
  }

  return {
    activeCount,
    alarms,
    actionError,
    currentAlarm,
    detailLoading,
    detailError,
    filters,
    inactiveCount,
    listError,
    listLoading,
    submitError,
    submitLoading,
    activateAlarm,
    createAlarm,
    deactivateAlarm,
    deleteAlarm,
    fetchAlarm,
    fetchAlarms,
    isActionPending,
    updateAlarm,
  };
});

function normalizeAlarmFilters(filters: AlarmFilters) {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(typeof filters.offset === 'number' ? { offset: filters.offset } : {}),
    ...(typeof filters.limit === 'number' ? { limit: filters.limit } : {}),
  };
}
