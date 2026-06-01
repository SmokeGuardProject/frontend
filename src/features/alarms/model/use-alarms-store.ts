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
    floor: null,
    building: '',
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
  const bulkActionLoading = ref<'activate-all' | 'deactivate-all' | null>(null);
  const listRequestId = ref(0);
  const activeAction = ref<{ alarmId: number; type: 'activate' | 'deactivate' | 'delete' | null }>({
    alarmId: 0,
    type: null,
  });

  const activeCount = computed(() => alarms.value.filter((alarm) => alarm.status === 'active').length);
  const inactiveCount = computed(() => alarms.value.filter((alarm) => alarm.status === 'inactive').length);

  async function fetchAlarms(nextFilters?: AlarmFilters) {
    const requestId = listRequestId.value + 1;
    listRequestId.value = requestId;
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = {
          ...filters.value,
          ...nextFilters,
        };
      }

      const nextAlarms = await alarmsApi.getAlarms(normalizeAlarmFilters(filters.value));

      if (requestId === listRequestId.value) {
        alarms.value = nextAlarms;
      }
    } catch (error) {
      if (requestId === listRequestId.value) {
        listError.value = normalizeApiError(error, 'Failed to load alarms.');
        throw error;
      }
    } finally {
      if (requestId === listRequestId.value) {
        listLoading.value = false;
      }
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

  async function activateAllAlarms() {
    bulkActionLoading.value = 'activate-all';
    actionError.value = '';

    try {
      const result = await alarmsApi.activateAllAlarms();
      await fetchAlarms();
      return result;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to activate all alarms.');
      throw error;
    } finally {
      bulkActionLoading.value = null;
    }
  }

  async function deactivateAllAlarms() {
    bulkActionLoading.value = 'deactivate-all';
    actionError.value = '';

    try {
      const result = await alarmsApi.deactivateAllAlarms();
      await fetchAlarms();
      return result;
    } catch (error) {
      actionError.value = normalizeApiError(error, 'Failed to deactivate all alarms.');
      throw error;
    } finally {
      bulkActionLoading.value = null;
    }
  }

  function isBulkActionPending(type: 'activate-all' | 'deactivate-all') {
    return bulkActionLoading.value === type;
  }

  function isActionPending(alarmId: number, type?: 'activate' | 'deactivate' | 'delete') {
    if (type) {
      return activeAction.value.alarmId === alarmId && activeAction.value.type === type;
    }

    return activeAction.value.alarmId === alarmId;
  }

  function syncAlarm(alarm: Alarm) {
    currentAlarm.value = currentAlarm.value?.id === alarm.id ? alarm : currentAlarm.value;

    if (!alarmMatchesFilters(alarm, filters.value)) {
      alarms.value = alarms.value.filter((item) => item.id !== alarm.id);
      return;
    }

    alarms.value = alarms.value.some((item) => item.id === alarm.id)
      ? alarms.value.map((item) => (item.id === alarm.id ? alarm : item))
      : [alarm, ...alarms.value];
  }

  function updateAlarmFromRealtime(payload: {
    alarmId: number;
    status?: Alarm['status'];
    activatedAt?: string | null;
    deactivatedAt?: string | null;
    timestamp?: string;
    building?: string | null;
    floor?: number | null;
    location?: string;
    sensorId?: number;
  }) {
    const patchAlarm = (alarm: Alarm): Alarm => ({
      ...alarm,
      status: payload.status ?? alarm.status,
      activatedAt: payload.activatedAt ?? alarm.activatedAt,
      deactivatedAt: payload.deactivatedAt ?? alarm.deactivatedAt,
      updatedAt: payload.timestamp ?? alarm.updatedAt,
      building: payload.building ?? alarm.building,
      floor: payload.floor ?? alarm.floor,
      location: payload.location ?? alarm.location,
      sensorId: payload.sensorId ?? alarm.sensorId,
    });

    alarms.value = alarms.value
      .map((alarm) => (alarm.id === payload.alarmId ? patchAlarm(alarm) : alarm))
      .filter((alarm) => alarm.id !== payload.alarmId || alarmMatchesFilters(alarm, filters.value));

    if (currentAlarm.value?.id === payload.alarmId) {
      currentAlarm.value = patchAlarm(currentAlarm.value);
    }
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
    bulkActionLoading,
    activateAlarm,
    activateAllAlarms,
    createAlarm,
    deactivateAlarm,
    deactivateAllAlarms,
    deleteAlarm,
    fetchAlarm,
    fetchAlarms,
    isActionPending,
    isBulkActionPending,
    updateAlarmFromRealtime,
    updateAlarm,
  };
});

function normalizeAlarmFilters(filters: AlarmFilters) {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(typeof filters.floor === 'number' && !Number.isNaN(filters.floor)
      ? { floor: filters.floor }
      : {}),
    ...(filters.building?.trim() ? { building: filters.building.trim() } : {}),
    ...(typeof filters.offset === 'number' ? { offset: filters.offset } : {}),
    ...(typeof filters.limit === 'number' ? { limit: filters.limit } : {}),
  };
}

function alarmMatchesFilters(alarm: Alarm, filters: AlarmFilters) {
  if (filters.status && alarm.status !== filters.status) {
    return false;
  }

  if (
    typeof filters.floor === 'number' &&
    !Number.isNaN(filters.floor) &&
    alarm.floor !== filters.floor
  ) {
    return false;
  }

  if (filters.building?.trim() && alarm.building !== filters.building.trim()) {
    return false;
  }

  return true;
}
