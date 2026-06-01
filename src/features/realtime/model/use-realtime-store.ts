import { ref } from 'vue';
import { defineStore } from 'pinia';
import { router } from '@/app/router';
import { createSocketRealtimeClient } from '@/features/realtime/lib/socket-realtime-client';
import type {
  AlarmRealtimePayload,
  RealtimeClient,
  RealtimeMode,
  RealtimeState,
  SensorReadingRealtimePayload,
} from '@/features/realtime/model/realtime.types';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { useEventsStore } from '@/features/events/model/use-events-store';
import type { NotificationItem } from '@/features/notifications/model/notification.types';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';
import { useSmokeEmergencyStore } from '@/features/emergency/model/use-smoke-emergency-store';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';

export const useRealtimeStore = defineStore('realtime', () => {
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
        handleAlarmChanged,
        handleNotificationCreated,
        handleSensorReading,
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

  function handleNotificationCreated(notification: NotificationItem) {
    useNotificationsStore().prependNotification(notification);
    useSmokeEmergencyStore().openFromNotification(notification);

    if (notification.event) {
      useEventsStore().prependEvent(notification.event);
    }
  }

  function handleSensorReading(payload: SensorReadingRealtimePayload) {
    const sensorsStore = useSensorsStore();

    sensorsStore.updateSensorFromRealtime(payload);
    sensorsStore.prependReadingFromRealtime(payload);
    lastSyncedAt.value = new Date().toISOString();
    state.value = 'active';
  }

  function handleAlarmChanged(payload: AlarmRealtimePayload) {
    useAlarmsStore().updateAlarmFromRealtime(payload);
    lastSyncedAt.value = new Date().toISOString();
    state.value = 'active';
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
  const notificationTasks = [
    useNotificationsStore().fetchNotificationPreview({ offset: 0, limit: 5 }),
    useNotificationsStore().fetchUnreadCount(),
  ];

  switch (routeName) {
    case 'dashboard':
      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useAlarmsStore().fetchAlarms(useAlarmsStore().filters),
        useEventsStore().fetchEvents(useEventsStore().filters),
        useEventsStore().fetchStatistics(),
        ...notificationTasks,
      ];
    case 'sensors':
    case 'sensor-details':
    case 'sensors-new':
      if (routeName === 'sensor-details' && Number.isInteger(currentId) && currentId > 0) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 15 * 60 * 1000);

        return [
          useSensorsStore().fetchSensor(currentId),
          useSensorsStore().fetchTableReadings(currentId, {
            offset: 0,
            limit: 20,
          }),
          useSensorsStore().fetchChartReadings(currentId, {
            offset: 0,
            limit: 500,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          }),
          ...notificationTasks,
        ];
      }

      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        ...notificationTasks,
      ];
    case 'alarms':
    case 'alarm-details':
    case 'alarms-new':
      if (routeName === 'alarm-details' && Number.isInteger(currentId) && currentId > 0) {
        return [
          useAlarmsStore().fetchAlarm(currentId),
          useSensorsStore().fetchSensors(useSensorsStore().filters),
          ...notificationTasks,
        ];
      }

      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        useAlarmsStore().fetchAlarms(useAlarmsStore().filters),
        ...notificationTasks,
      ];
    case 'events':
      return [
        useEventsStore().fetchEvents(useEventsStore().filters),
        useEventsStore().fetchStatistics(),
        ...notificationTasks,
      ];
    case 'notifications':
      return [];
    case 'reports':
      return [
        useSensorsStore().fetchSensors(useSensorsStore().filters),
        ...notificationTasks,
      ];
    default:
      return notificationTasks;
  }
}

function resolveRealtimeMode(): RealtimeMode {
  return 'socket';
}
