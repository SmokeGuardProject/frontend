import { ref } from 'vue';
import { defineStore } from 'pinia';
import { router } from '@/app/router';
import { createSocketRealtimeClient } from '@/features/realtime/lib/socket-realtime-client';
import type {
  RealtimeClient,
  RealtimeMode,
  RealtimeState,
} from '@/features/realtime/model/realtime.types';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { useEventsStore } from '@/features/events/model/use-events-store';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';

export const useRealtimeStore = defineStore('realtime', () => {
  const sensorsStore = useSensorsStore();
  const alarmsStore = useAlarmsStore();
  const eventsStore = useEventsStore();
  const notificationsStore = useNotificationsStore();

  const mode = ref<RealtimeMode>(resolveRealtimeMode());
  const state = ref<RealtimeState>('idle');
  const errorMessage = ref('');
  const lastSyncedAt = ref<string | null>(null);
  const client = ref<RealtimeClient | null>(null);
  const isStarted = ref(false);
  const refreshInFlight = ref<Promise<void> | null>(null);

  const pollingIntervalMs = 0;

  async function start() {
    if (isStarted.value) {
      return;
    }

    state.value = 'connecting';
    errorMessage.value = '';
    client.value = createSocketRealtimeClient();

    try {
      await client.value.connect({
        pollingIntervalMs,
        refresh,
      });
      state.value = 'active';
      isStarted.value = true;
    } catch {
      state.value = 'error';
      errorMessage.value = 'Автоматичне оновлення даних тимчасово недоступне.';
      isStarted.value = false;
    }
  }

  function stop() {
    client.value?.disconnect();
    client.value = null;
    state.value = 'idle';
    isStarted.value = false;
  }

  async function refresh() {
    if (refreshInFlight.value) {
      return refreshInFlight.value;
    }

    const task = refreshCurrentView();
    refreshInFlight.value = task;

    try {
      await task;
    } finally {
      refreshInFlight.value = null;
    }
  }

  async function refreshCurrentView() {
    errorMessage.value = '';

    try {
      await Promise.all(resolveRefreshTasks());

      lastSyncedAt.value = new Date().toISOString();
      state.value = 'active';
    } catch {
      errorMessage.value = 'Не вдалося оновити дані. На екрані може відображатися неактуальна інформація.';
      state.value = 'error';
      throw new Error(errorMessage.value);
    }
  }

  return {
    errorMessage,
    isStarted,
    lastSyncedAt,
    mode,
    pollingIntervalMs,
    state,
    refresh,
    start,
    stop,
  };
});

function resolveRefreshTasks() {
  const currentRoute = router.currentRoute.value;
  const routeName = String(currentRoute.name ?? '');
  const currentId = Number(currentRoute.params.id);

  switch (routeName) {
    case 'dashboard':
      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useAlarmsStore().fetchAlarms(useAlarmsStore().filters),
        useEventsStore().fetchEvents(useEventsStore().filters),
        useEventsStore().fetchStatistics(),
        useNotificationsStore().fetchNotifications(useNotificationsStore().filters),
        useNotificationsStore().fetchUnreadCount(),
      ];
    case 'sensors':
    case 'sensor-details':
    case 'sensors-new':
      if (routeName === 'sensor-details' && Number.isInteger(currentId) && currentId > 0) {
        return [
          useSensorsStore().fetchSensor(currentId),
          useSensorsStore().fetchReadings(currentId, {
            offset: 0,
            limit: 100,
          }),
          useNotificationsStore().fetchUnreadCount(),
        ];
      }

      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useNotificationsStore().fetchUnreadCount(),
      ];
    case 'alarms':
    case 'alarm-details':
    case 'alarms-new':
      if (routeName === 'alarm-details' && Number.isInteger(currentId) && currentId > 0) {
        return [
          useAlarmsStore().fetchAlarm(currentId),
          useSensorsStore().fetchSensors(useSensorsStore().filters),
          useNotificationsStore().fetchUnreadCount(),
        ];
      }

      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useAlarmsStore().fetchAlarms(useAlarmsStore().filters),
        useNotificationsStore().fetchUnreadCount(),
      ];
    case 'events':
      return [
        useEventsStore().fetchEvents(useEventsStore().filters),
        useEventsStore().fetchStatistics(),
        useNotificationsStore().fetchUnreadCount(),
      ];
    case 'notifications':
      return [
        useNotificationsStore().fetchNotifications(useNotificationsStore().filters),
        useNotificationsStore().fetchUnreadCount(),
      ];
    case 'reports':
      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useNotificationsStore().fetchUnreadCount(),
      ];
    default:
      return [useNotificationsStore().fetchUnreadCount()];
  }
}

function resolveRealtimeMode(): RealtimeMode {
  return 'socket';
}
