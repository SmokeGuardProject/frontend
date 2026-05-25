<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppModal from '@/shared/ui/AppModal.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';

const sensorsStore = useSensorsStore();
const copyFeedback = ref('');

const filterForm = reactive({
  status: '',
  floor: '',
  building: '',
});

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const summaryCards = computed(() => [
  {
    title: 'Registered sensors',
    value: String(sensorsStore.sensorsCount),
    tone: 'neutral' as const,
  },
  {
    title: 'Active sensors',
    value: String(sensorsStore.activeSensorsCount),
    tone: 'success' as const,
  },
  {
    title: 'Inactive sensors',
    value: String(sensorsStore.sensorsCount - sensorsStore.activeSensorsCount),
    tone: 'warning' as const,
  },
]);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function applyFilters() {
  await sensorsStore.fetchSensors({
    status: filterForm.status as 'active' | 'inactive' | '',
    floor: normalizeOptionalNumber(filterForm.floor),
    building: normalizeText(filterForm.building),
  });
}

function resetFilters() {
  filterForm.status = '';
  filterForm.floor = '';
  filterForm.building = '';
  void applyFilters();
}

function closeCodeModal() {
  copyFeedback.value = '';
  sensorsStore.clearLastCreatedSensor();
}

async function copySensorCode() {
  const sensorCode = sensorsStore.lastCreatedSensor?.sensorCode;

  if (!sensorCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(sensorCode);
    copyFeedback.value = 'Код скопійовано.';
  } catch {
    copyFeedback.value = 'Не вдалося скопіювати код.';
  }
}

function badgeTone(status: string) {
  return status === 'active' ? 'success' : 'warning';
}

watch(
  () => sensorsStore.lastCreatedSensor?.sensor.id,
  async () => {
    await sensorsStore.fetchSensors({
      status: filterForm.status as 'active' | 'inactive' | '',
      floor: normalizeOptionalNumber(filterForm.floor),
      building: normalizeText(filterForm.building),
    });
  },
);

onMounted(async () => {
  await sensorsStore.fetchSensors();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Sensors</span>
        <h1>Моніторинг та керування датчиками</h1>
      </div>

      <RouterLink to="/sensors/new">
        <AppButton>Додати сенсор</AppButton>
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
          <h2>Відбір по статусу і розташуванню</h2>
        </div>
        <div class="filters-panel__actions">
          <AppButton
            variant="ghost"
            @click="resetFilters"
          >
            Скинути
          </AppButton>
          <AppButton @click="applyFilters">
            Застосувати
          </AppButton>
        </div>
      </div>

      <div class="filters-grid">
        <AppSelect
          v-model="filterForm.status"
          label="Статус"
          :options="statusOptions"
        />
        <AppInput
          v-model="filterForm.floor"
          label="Поверх"
          type="number"
          placeholder="Наприклад 3"
        />
        <AppInput
          v-model="filterForm.building"
          label="Будівля"
          placeholder="Building A"
        />
      </div>
    </section>

    <section class="ui-card">
      <div class="section-header">
        <div>
          <span class="ui-card__label">Sensor registry</span>
          <h2>Список сенсорів</h2>
        </div>
        <span class="app-header__meta">
          {{ sensorsStore.listLoading ? 'Оновлення...' : `${sensorsStore.sensorsCount} items` }}
        </span>
      </div>

      <AppAlert
        v-if="sensorsStore.listError"
        title="Sensors unavailable"
        :message="sensorsStore.listError"
        tone="warning"
      >
        <AppButton @click="applyFilters">
          Retry
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!sensorsStore.listLoading && !sensorsStore.sensors.length"
        title="Сенсори ще не додані"
      >
        <RouterLink to="/sensors/new">
          <AppButton>Створити сенсор</AppButton>
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
              <th>Статус</th>
              <th>Останній heartbeat</th>
              <th>Оновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sensor in sensorsStore.sensors"
              :key="sensor.id"
            >
              <td>#{{ sensor.id }}</td>
              <td>{{ formatSensorLocation(sensor.building, sensor.floor, sensor.location) }}</td>
              <td>
                <AppBadge :tone="badgeTone(sensor.status)">
                  {{ sensor.status }}
                </AppBadge>
              </td>
              <td>{{ formatDateTime(sensor.lastCheckedAt) }}</td>
              <td>{{ formatDateTime(sensor.updatedAt) }}</td>
              <td class="data-table__actions">
                <RouterLink :to="`/sensors/${sensor.id}`">
                  <AppButton variant="ghost">
                    Деталі
                  </AppButton>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal
      :open="Boolean(sensorsStore.lastCreatedSensor)"
      title="Sensor code generated"
      @close="closeCodeModal"
    >
      <div class="secret-panel">
        <div class="secret-panel__item secret-panel__item--compact">
          <span class="ui-card__label">Sensor ID</span>
          <code>{{ sensorsStore.lastCreatedSensor?.sensor.id }}</code>
        </div>
        <div class="secret-panel__item">
          <span class="ui-card__label">One-time device credential</span>
          <code>{{ sensorsStore.lastCreatedSensor?.sensorCode }}</code>
        </div>
      </div>
      <p
        v-if="copyFeedback"
        class="form-message"
        :class="copyFeedback.includes('Не вдалося') ? 'form-message--error' : 'form-message--success'"
      >
        {{ copyFeedback }}
      </p>
      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="copySensorCode"
        >
          Скопіювати код
        </AppButton>
        <AppButton @click="closeCodeModal">
          Готово
        </AppButton>
      </div>
    </AppModal>
  </section>
</template>
