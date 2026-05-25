<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SensorLineChart from '@/entities/sensors/ui/SensorLineChart.vue';
import { formatDateTime, formatMetric, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';

const route = useRoute();
const router = useRouter();
const sensorsStore = useSensorsStore();
const sensorId = computed(() => Number(route.params.id));

const form = reactive({
  location: '',
  floor: '',
  building: '',
  status: 'inactive',
});

const readingFilters = reactive({
  offset: 0,
  limit: '100',
  startDate: '',
  endDate: '',
});

const formError = ref('');
const actionError = ref('');

const sensor = computed(() => sensorsStore.currentSensor);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function loadDetails() {
  await sensorsStore.fetchSensor(sensorId.value);
  await sensorsStore.fetchReadings(sensorId.value, {
    offset: readingFilters.offset,
    limit: Number(readingFilters.limit) || 100,
    ...(readingFilters.startDate ? { startDate: new Date(readingFilters.startDate).toISOString() } : {}),
    ...(readingFilters.endDate ? { endDate: new Date(readingFilters.endDate).toISOString() } : {}),
  });
}

async function saveChanges() {
  formError.value = '';

  try {
    await sensorsStore.updateSensor(sensorId.value, {
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
      status: form.status as 'active' | 'inactive',
    });
  } catch {
    formError.value = 'Не вдалося оновити сенсор. Перевірте введені значення.';
  }
}

async function removeSensor() {
  actionError.value = '';

  if (!window.confirm('Видалити сенсор? Цю дію не можна скасувати.')) {
    return;
  }

  try {
    await sensorsStore.deleteSensor(sensorId.value);
    await router.push('/sensors');
  } catch {
    actionError.value = 'Не вдалося видалити сенсор.';
  }
}

async function applyReadingsFilters() {
  await sensorsStore.fetchReadings(sensorId.value, {
    offset: readingFilters.offset,
    limit: Number(readingFilters.limit) || 100,
    ...(readingFilters.startDate ? { startDate: new Date(readingFilters.startDate).toISOString() } : {}),
    ...(readingFilters.endDate ? { endDate: new Date(readingFilters.endDate).toISOString() } : {}),
  });
}

watch(
  sensor,
  (nextSensor) => {
    if (!nextSensor) {
      return;
    }

    form.location = nextSensor.location;
    form.floor = nextSensor.floor !== null ? String(nextSensor.floor) : '';
    form.building = nextSensor.building ?? '';
    form.status = nextSensor.status;
  },
  { immediate: true },
);

onMounted(async () => {
  await loadDetails();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Sensor details</span>
        <h1>Сенсор #{{ sensorId }}</h1>
        <p v-if="sensor">
          {{ formatSensorLocation(sensor.building, sensor.floor, sensor.location) }}
        </p>
      </div>

      <div class="inline-actions">
        <AppButton
          variant="ghost"
          @click="router.push('/sensors')"
        >
          До списку
        </AppButton>
        <AppButton
          variant="ghost"
          @click="loadDetails"
        >
          Оновити
        </AppButton>
      </div>
    </div>

    <section
      v-if="sensor"
      class="sensor-meta-grid"
    >
      <article class="ui-card">
        <span class="ui-card__label">Status</span>
        <div class="sensor-meta-grid__status">
          <AppBadge :tone="sensor.status === 'active' ? 'success' : 'warning'">
            {{ sensor.status }}
          </AppBadge>
          <p class="ui-card__detail">
            Last heartbeat: {{ formatDateTime(sensor.lastCheckedAt) }}
          </p>
        </div>
      </article>
      <article class="ui-card">
        <span class="ui-card__label">Created</span>
        <p class="ui-card__value">
          {{ formatDateTime(sensor.createdAt) }}
        </p>
        <p class="ui-card__detail">
          Оновлено {{ formatDateTime(sensor.updatedAt) }}
        </p>
      </article>
      <article class="ui-card">
        <span class="ui-card__label">Latest sample</span>
        <p class="ui-card__value">
          {{ sensorsStore.readings[0] ? formatMetric(sensorsStore.readings[0].smokeLevel, '%') : 'No data' }}
        </p>
        <p class="ui-card__detail">
          {{ sensorsStore.readings[0] ? formatDateTime(sensorsStore.readings[0].timestamp) : 'Readings are not available yet.' }}
        </p>
      </article>
    </section>

    <section
      v-if="sensor"
      class="details-grid"
    >
      <article class="ui-card">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Configuration</span>
            <h2>Редагування сенсора</h2>
          </div>
        </div>

        <form
          class="auth-form"
          @submit.prevent="saveChanges"
        >
          <AppInput
            v-model="form.location"
            label="Локація"
            placeholder="Room 101"
            required
          />
          <AppInput
            v-model="form.floor"
            label="Поверх"
            type="number"
            placeholder="0"
          />
          <AppInput
            v-model="form.building"
            label="Будівля"
            placeholder="Building A"
          />
          <AppSelect
            v-model="form.status"
            label="Статус"
            :options="[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]"
          />

          <p
            v-if="formError"
            class="form-message form-message--error"
          >
            {{ formError }}
          </p>

          <p
            v-if="actionError"
            class="form-message form-message--error"
          >
            {{ actionError }}
          </p>

          <div class="form-actions">
            <AppButton
              type="button"
              variant="ghost"
              @click="removeSensor"
            >
              Видалити
            </AppButton>
            <AppButton
              type="submit"
              :loading="sensorsStore.submitLoading"
            >
              Зберегти зміни
            </AppButton>
          </div>
        </form>
      </article>

      <article class="ui-card">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Readings filters</span>
            <h2>Параметри вибірки</h2>
          </div>
        </div>

        <div class="filters-grid filters-grid--compact">
          <AppInput
            v-model="readingFilters.startDate"
            label="Початок"
            type="datetime-local"
          />
          <AppInput
            v-model="readingFilters.endDate"
            label="Кінець"
            type="datetime-local"
          />
          <AppInput
            v-model="readingFilters.limit"
            label="Ліміт"
            type="number"
            placeholder="100"
          />
        </div>

        <div class="form-actions form-actions--spread">
          <p class="app-header__meta">
            {{ sensorsStore.readingsLoading ? 'Завантаження readings...' : `${sensorsStore.readings.length} readings` }}
          </p>
          <AppButton @click="applyReadingsFilters">
            Оновити readings
          </AppButton>
        </div>
      </article>
    </section>

    <section
      v-if="sensor"
      class="charts-grid"
    >
      <SensorLineChart
        title="Smoke level"
        tone="danger"
        unit="%"
        :readings="sensorsStore.readings"
        :selector="(reading) => reading.smokeLevel"
      />
      <SensorLineChart
        title="Temperature"
        tone="warning"
        unit="°C"
        :readings="sensorsStore.readings"
        :selector="(reading) => reading.temperature"
      />
      <SensorLineChart
        title="Humidity"
        tone="primary"
        unit="%"
        :readings="sensorsStore.readings"
        :selector="(reading) => reading.humidity"
      />
    </section>

    <section
      v-if="sensor"
      class="ui-card"
    >
      <div class="section-header">
        <div>
          <span class="ui-card__label">Readings log</span>
          <h2>Останні показники</h2>
        </div>
      </div>

      <AppEmptyState
        v-if="!sensorsStore.readingsLoading && !sensorsStore.readings.length"
        title="Показники відсутні"
        description="Сенсор ще не передавав telemetry або вибраний часовий інтервал порожній."
      />

      <div
        v-else
        class="table-shell"
      >
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Smoke detected</th>
              <th>Smoke level</th>
              <th>Temperature</th>
              <th>Humidity</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="reading in sensorsStore.readings"
              :key="reading.id"
            >
              <td>{{ formatDateTime(reading.timestamp) }}</td>
              <td>
                <AppBadge :tone="reading.smokeDetected ? 'danger' : 'success'">
                  {{ reading.smokeDetected ? 'Detected' : 'Clear' }}
                </AppBadge>
              </td>
              <td>{{ formatMetric(reading.smokeLevel, '%') }}</td>
              <td>{{ formatMetric(reading.temperature, '°C') }}</td>
              <td>{{ formatMetric(reading.humidity, '%') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
