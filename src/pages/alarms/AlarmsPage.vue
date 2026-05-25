<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { getAlarmTone, formatAlarmStatus } from '@/features/alarms/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';

const alarmsStore = useAlarmsStore();
const sensorsStore = useSensorsStore();

const filterForm = reactive({
  status: '',
});

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const summaryCards = computed(() => [
  {
    title: 'Registered alarms',
    value: String(alarmsStore.alarms.length),
    tone: 'neutral' as const,
  },
  {
    title: 'Active alarms',
    value: String(alarmsStore.activeCount),
    tone: 'danger' as const,
  },
  {
    title: 'Inactive alarms',
    value: String(alarmsStore.inactiveCount),
    tone: 'success' as const,
  },
]);

function sensorLabel(sensorId: number) {
  const sensor = sensorsStore.sensors.find((item) => item.id === sensorId);

  if (!sensor) {
    return `Sensor #${sensorId}`;
  }

  return formatSensorLocation(sensor.building, sensor.floor, sensor.location);
}

async function loadPage() {
  await Promise.all([
    sensorsStore.fetchSensors(),
    alarmsStore.fetchAlarms({
      status: filterForm.status as 'active' | 'inactive' | '',
    }),
  ]);
}

async function applyFilters() {
  await alarmsStore.fetchAlarms({
    status: filterForm.status as 'active' | 'inactive' | '',
  });
}

async function toggleAlarm(alarmId: number, active: boolean) {
  if (active) {
    await alarmsStore.deactivateAlarm(alarmId);
    return;
  }

  await alarmsStore.activateAlarm(alarmId);
}

onMounted(async () => {
  await loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Alarms</span>
        <h1>Керування сигналізаціями</h1>
      </div>

      <RouterLink to="/alarms/new">
        <AppButton>Додати сигналізацію</AppButton>
      </RouterLink>
    </div>

    <div class="status-grid">
      <StatusCard
        v-for="card in summaryCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :tone="card.tone"
      />
    </div>

    <section class="ui-card filters-panel">
      <div class="filters-panel__header">
        <div>
          <span class="ui-card__label">Filters</span>
          <h2>Відбір по стану сигналізації</h2>
        </div>
        <div class="filters-panel__actions">
          <AppButton
            variant="ghost"
            @click="filterForm.status = ''; applyFilters()"
          >
            Скинути
          </AppButton>
          <AppButton @click="applyFilters">
            Застосувати
          </AppButton>
        </div>
      </div>

      <div class="filters-grid filters-grid--single">
        <AppSelect
          v-model="filterForm.status"
          label="Статус"
          :options="statusOptions"
        />
      </div>
    </section>

    <section class="ui-card">
      <div class="section-header">
        <div>
          <span class="ui-card__label">Alarm registry</span>
          <h2>Список сигналізацій</h2>
        </div>
        <span class="app-header__meta">
          {{ alarmsStore.listLoading ? 'Оновлення...' : `${alarmsStore.alarms.length} items` }}
        </span>
      </div>

      <AppAlert
        v-if="alarmsStore.listError || alarmsStore.actionError"
        title="Alarm actions need attention"
        :message="alarmsStore.listError || alarmsStore.actionError"
        tone="warning"
      >
        <AppButton @click="loadPage">
          Retry
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!alarmsStore.listLoading && !alarmsStore.alarms.length"
        title="Сигналізації ще не додані"
      >
        <RouterLink to="/alarms/new">
          <AppButton>Створити сигналізацію</AppButton>
        </RouterLink>
      </AppEmptyState>

      <div
        v-else
        class="table-shell"
      >
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Локація</th>
              <th>Сенсор</th>
              <th>Статус</th>
              <th>Активовано</th>
              <th>Оновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="alarm in alarmsStore.alarms"
              :key="alarm.id"
            >
              <td>#{{ alarm.id }}</td>
              <td>{{ formatSensorLocation(alarm.building, alarm.floor, alarm.location) }}</td>
              <td>{{ sensorLabel(alarm.sensorId) }}</td>
              <td>
                <AppBadge :tone="getAlarmTone(alarm.status)">
                  {{ formatAlarmStatus(alarm.status) }}
                </AppBadge>
              </td>
              <td>{{ formatDateTime(alarm.activatedAt) }}</td>
              <td>{{ formatDateTime(alarm.updatedAt) }}</td>
              <td class="data-table__actions">
                <div class="inline-actions inline-actions--end">
                  <AppButton
                    variant="ghost"
                    :loading="alarmsStore.isActionPending(alarm.id, alarm.status === 'active' ? 'deactivate' : 'activate')"
                    @click="toggleAlarm(alarm.id, alarm.status === 'active')"
                  >
                    {{ alarm.status === 'active' ? 'Деактивувати' : 'Активувати' }}
                  </AppButton>
                  <RouterLink :to="`/alarms/${alarm.id}`">
                    <AppButton variant="ghost">
                      Деталі
                    </AppButton>
                  </RouterLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
