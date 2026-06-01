<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SensorLineChart from '@/entities/sensors/ui/SensorLineChart.vue';
import { formatDateTime, formatMetric, formatSensorLocation } from '@/features/sensors/lib/formatters';
import type { SensorReading } from '@/features/sensors/model/sensor.types';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppModal from '@/shared/ui/AppModal.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import { showToast } from '@/shared/ui/use-toast';

type MetricKey = 'smoke' | 'temperature' | 'humidity';
type ChartPreset = '15m' | '1h' | '3h' | '12h' | 'custom';

const PAGE_SIZE = 20;
const CHART_LIMIT = 500;
const LOAD_MORE_ROOT_MARGIN = '260px 0px 420px 0px';

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
  limit: String(PAGE_SIZE),
  startDate: '',
  endDate: '',
});

const formError = ref('');
const actionError = ref('');
const pageError = ref('');
const copyFeedback = ref('');
const deleteConfirmOpen = ref(false);
const hasMoreReadings = ref(false);
const activeMetric = ref<MetricKey>('smoke');
const activeChartPreset = ref<ChartPreset>('15m');
const chartRange = ref<{ startDate: string; endDate: string; label: string } | null>(null);
const loadMoreSentinel = ref<HTMLElement | null>(null);
let copyFeedbackTimerId: number | null = null;
let loadMoreObserver: IntersectionObserver | null = null;

const sensor = computed(() => sensorsStore.currentSensor);
const latestReading = computed(() => sensorsStore.latestReading ?? sensorsStore.tableReadings[0] ?? null);
const createdSensorSuccess = computed(() => {
  const payload = sensorsStore.createdSensorSuccess;
  return payload?.sensorId === sensorId.value ? payload : null;
});
const createdSensorLocation = computed(() =>
  sensor.value ? formatSensorLocation(sensor.value.building, sensor.value.floor, sensor.value.location) : '',
);
const copyButtonText = computed(() => (copyFeedback.value === 'Скопійовано' ? 'Скопійовано' : 'Скопіювати'));
const sensorStatusLabel = computed(() => (sensor.value?.status === 'active' ? 'Активний' : 'Неактивний'));
const sensorLocation = computed(() =>
  sensor.value ? formatSensorLocation(sensor.value.building, sensor.value.floor, sensor.value.location) : '',
);
const loadedReadingsLabel = computed(() =>
  `Показано ${sensorsStore.tableReadings.length} зчитувань`,
);

const chartRangePresets: Array<{ label: string; value: Exclude<ChartPreset, 'custom'>; minutes: number }> = [
  { label: '15 хв', value: '15m', minutes: 15 },
  { label: '1 год', value: '1h', minutes: 60 },
  { label: '3 год', value: '3h', minutes: 180 },
  { label: '12 год', value: '12h', minutes: 720 },
];

const metricTabs: Array<{
  key: MetricKey;
  label: string;
  title: string;
  unit: string;
  selector: (_reading: SensorReading) => number | null;
}> = [
  {
    key: 'smoke',
    label: 'Дим',
    title: 'Рівень диму',
    unit: '%',
    selector: (reading) => reading.smokeLevel,
  },
  {
    key: 'temperature',
    label: 'Температура',
    title: 'Температура',
    unit: '°C',
    selector: (reading) => reading.temperature,
  },
  {
    key: 'humidity',
    label: 'Вологість',
    title: 'Вологість',
    unit: '%',
    selector: (reading) => reading.humidity,
  },
];

const activeMetricConfig = computed(
  () => metricTabs.find((metric) => metric.key === activeMetric.value) ?? metricTabs[0],
);
const filteredChartReadings = computed(() => {
  const range = chartRange.value;

  if (!range) {
    return sensorsStore.chartReadings;
  }

  const startTime = new Date(range.startDate).getTime();
  const endTime = new Date(range.endDate).getTime();

  return sensorsStore.chartReadings.filter((reading) => {
    const timestamp = new Date(reading.timestamp).getTime();

    return timestamp >= startTime && timestamp <= endTime;
  });
});
const activeMetricStats = computed(() =>
  calculateMetricStats(filteredChartReadings.value, activeMetricConfig.value.selector),
);
const isActiveMetricStable = computed(
  () =>
    activeMetric.value === 'humidity' &&
    activeMetricStats.value.count > 0 &&
    activeMetricStats.value.min === activeMetricStats.value.max,
);
const activeMetricColor = computed(() => {
  if (activeMetric.value === 'smoke') {
    if (filteredChartReadings.value.some((reading) => reading.smokeDetected)) {
      return '#ef4444';
    }

    return '#f97316';
  }

  return activeMetric.value === 'temperature' ? '#f59e0b' : '#0ea5e9';
});

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

function normalizeReadingsLimit() {
  const limit = Number(readingFilters.limit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : PAGE_SIZE;
}

function readingsRequestFilters(offset = 0) {
  return {
    offset,
    limit: normalizeReadingsLimit(),
    ...(readingFilters.startDate ? { startDate: new Date(readingFilters.startDate).toISOString() } : {}),
    ...(readingFilters.endDate ? { endDate: new Date(readingFilters.endDate).toISOString() } : {}),
  };
}

function chartRequestFilters() {
  if (activeChartPreset.value === 'custom' && (readingFilters.startDate || readingFilters.endDate)) {
    const startDate = readingFilters.startDate ? new Date(readingFilters.startDate).toISOString() : '';
    const endDate = readingFilters.endDate ? new Date(readingFilters.endDate).toISOString() : new Date().toISOString();

    chartRange.value = {
      startDate: startDate || new Date(new Date(endDate).getTime() - 60 * 60 * 1000).toISOString(),
      endDate,
      label: 'власний період',
    };
    logChartRange(chartRange.value);

    return {
      offset: 0,
      limit: CHART_LIMIT,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
  }

  const preset = resolveChartRangePreset(activeChartPreset.value);
  const { startDate, endDate } = buildChartRange(preset.minutes);
  chartRange.value = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    label: `останні ${preset.label}`,
  };
  logChartRange(chartRange.value);

  return {
    offset: 0,
    limit: CHART_LIMIT,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function logChartRange(range: { startDate: string; endDate: string; label: string }) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.log('chart range:', range);
  console.log('chart start:', range.startDate);
  console.log('chart end:', range.endDate);
}

function resolveChartRangePreset(value: ChartPreset) {
  return chartRangePresets.find((preset) => preset.value === value) ?? chartRangePresets[0];
}

function buildChartRange(minutes: number) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - minutes * 60 * 1000);

  return { startDate, endDate };
}

async function loadDetails() {
  pageError.value = '';

  try {
    await sensorsStore.fetchSensor(sensorId.value);
    await refreshReadings(false);
  } catch {
    pageError.value = 'Не вдалося завантажити деталі сенсора.';
  }
}

async function refreshReadings(showSuccessToast = true) {
  try {
    const [loadedReadings] = await Promise.all([
      sensorsStore.fetchTableReadings(sensorId.value, readingsRequestFilters(0)),
      sensorsStore.fetchChartReadings(sensorId.value, chartRequestFilters()),
    ]);
    hasMoreReadings.value = (loadedReadings?.length ?? 0) === normalizeReadingsLimit();
    await nextTick();
    observeLoadMoreSentinel();

    if (showSuccessToast) {
      showToast({
        title: 'Показники оновлено',
        message: 'Останні зчитування сенсора завантажено.',
        tone: 'success',
      });
    }
  } catch {
    showToast({
      title: 'Не вдалося завантажити показники',
      message: 'Спробуйте оновити період зчитувань ще раз.',
      tone: 'danger',
    });
    throw new Error('Не вдалося завантажити показники');
  }
}

async function refreshChartReadings() {
  try {
    await sensorsStore.fetchChartReadings(sensorId.value, chartRequestFilters());
  } catch {
    showToast({
      title: 'Не вдалося завантажити показники',
      message: 'Спробуйте вибрати інший період для графіка.',
      tone: 'danger',
    });
  }
}

function applyChartPreset(preset: ChartPreset) {
  activeChartPreset.value = preset;
  void refreshChartReadings();
}

async function loadMoreReadings() {
  if (sensorsStore.tableReadingsLoading || !hasMoreReadings.value) {
    return;
  }

  const beforeCount = sensorsStore.tableReadings.length;
  const loadedReadings = await sensorsStore.appendTableReadings(
    sensorId.value,
    readingsRequestFilters(beforeCount),
  );
  const addedCount = sensorsStore.tableReadings.length - beforeCount;

  hasMoreReadings.value = (loadedReadings?.length ?? 0) === normalizeReadingsLimit() && addedCount > 0;
}

async function saveChanges() {
  formError.value = '';
  actionError.value = '';

  try {
    const updated = await sensorsStore.updateSensor(sensorId.value, {
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
      status: form.status as 'active' | 'inactive',
    });

    showToast({
      title: 'Сенсор оновлено',
      message: `Сенсор #${updated.id} успішно відредаговано.`,
      tone: 'success',
    });
  } catch {
    formError.value = 'Не вдалося оновити сенсор. Перевірте введені значення.';
  }
}

function openDeleteConfirm() {
  actionError.value = '';
  deleteConfirmOpen.value = true;
}

function closeDeleteConfirm() {
  if (sensorsStore.submitLoading) {
    return;
  }

  deleteConfirmOpen.value = false;
}

async function removeSensor() {
  actionError.value = '';

  try {
    await sensorsStore.deleteSensor(sensorId.value);
    deleteConfirmOpen.value = false;
    showToast({
      title: 'Сенсор видалено',
      message: `Сенсор #${sensorId.value} видалено із системи.`,
      tone: 'success',
    });
    await router.push('/sensors');
  } catch {
    actionError.value = 'Не вдалося видалити сенсор.';
  }
}

function observeLoadMoreSentinel() {
  loadMoreObserver?.disconnect();

  if (!loadMoreSentinel.value || !('IntersectionObserver' in window)) {
    return;
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreReadings().catch(() => {
          showToast({
            title: 'Не вдалося завантажити показники',
            message: 'Старіші зчитування тимчасово недоступні.',
            tone: 'danger',
          });
        });
      }
    },
    {
      root: null,
      rootMargin: LOAD_MORE_ROOT_MARGIN,
      threshold: 0,
    },
  );

  loadMoreObserver.observe(loadMoreSentinel.value);
}

function closeCreatedSensorModal() {
  copyFeedback.value = '';
  sensorsStore.clearCreatedSensorSuccess();
}

async function copySensorCode() {
  const sensorCode = createdSensorSuccess.value?.sensorCode;

  if (!sensorCode) {
    return;
  }

  if (copyFeedbackTimerId !== null) {
    window.clearTimeout(copyFeedbackTimerId);
    copyFeedbackTimerId = null;
  }

  try {
    await navigator.clipboard.writeText(sensorCode);
    copyFeedback.value = 'Скопійовано';
    showToast({
      title: 'Скопійовано',
      message: 'Код підключення скопійовано',
      tone: 'success',
    });
    copyFeedbackTimerId = window.setTimeout(() => {
      copyFeedback.value = '';
      copyFeedbackTimerId = null;
    }, 1600);
  } catch {
    copyFeedback.value = 'Не вдалося скопіювати код.';
    showToast({
      title: 'Помилка копіювання',
      message: 'Не вдалося скопіювати код',
      tone: 'danger',
    });
  }
}

function calculateMetricStats(
  readings: SensorReading[],
  selector: (_reading: SensorReading) => number | null,
) {
  const values = readings
    .map((reading) => {
      const value = selector(reading);

      return value === null ? null : Number(value);
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!values.length) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((total, value) => total + value, 0) / values.length;

  return { count: values.length, min, max, avg };
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

watch(
  () => [readingFilters.startDate, readingFilters.endDate],
  ([startDate, endDate]) => {
    if (startDate || endDate) {
      activeChartPreset.value = 'custom';
    }
  },
);

watch(
  () => `${sensorsStore.latestReading?.id ?? ''}:${sensorsStore.latestReading?.timestamp ?? ''}`,
  () => {
    if (activeChartPreset.value === 'custom') {
      return;
    }

    const preset = resolveChartRangePreset(activeChartPreset.value);
    const { startDate, endDate } = buildChartRange(preset.minutes);

    chartRange.value = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label: `останні ${preset.label}`,
    };
  },
);

onMounted(async () => {
  await loadDetails();
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect();

  if (copyFeedbackTimerId !== null) {
    window.clearTimeout(copyFeedbackTimerId);
  }

  if (createdSensorSuccess.value) {
    sensorsStore.clearCreatedSensorSuccess();
  }
});
</script>

<template>
  <section class="sensor-details page-stack">
    <div class="page-heading sensor-details__heading">
      <div>
        <div class="sensor-details__title-row">
          <h1>Сенсор #{{ sensorId }}</h1>
          <AppBadge
            v-if="sensor"
            :tone="sensor.status === 'active' ? 'success' : 'warning'"
          >
            {{ sensorStatusLabel }}
          </AppBadge>
        </div>
        <p v-if="sensor">
          {{ sensorLocation }}
        </p>
        <p v-else>
          Дані сенсора завантажуються.
        </p>
      </div>

      <div class="inline-actions sensor-details__header-actions">
        <AppButton
          type="button"
          variant="ghost"
          @click="router.push('/sensors')"
        >
          До списку
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          :loading="sensorsStore.detailLoading"
          @click="loadDetails"
        >
          Оновити
        </AppButton>
      </div>
    </div>

    <div
      v-if="sensorsStore.detailLoading && !sensor"
      class="sensor-details-skeleton"
      aria-label="Деталі сенсора завантажуються"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>

    <AppAlert
      v-else-if="pageError || sensorsStore.detailError"
      title="Сенсор не знайдено"
      :message="pageError || 'Не вдалося завантажити деталі сенсора.'"
      tone="warning"
    >
      <AppButton @click="loadDetails">
        Повторити
      </AppButton>
    </AppAlert>

    <section
      v-else-if="sensor"
      class="sensor-details__summary"
    >
      <article class="sensor-details-card">
        <h2>Стан сенсора</h2>
        <div class="sensor-details-card__content">
          <AppBadge :tone="sensor.status === 'active' ? 'success' : 'warning'">
            {{ sensorStatusLabel }}
          </AppBadge>
          <p>{{ sensor.lastCheckedAt ? `Останній сигнал: ${formatDateTime(sensor.lastCheckedAt)}` : 'Сигнал ще не надходив' }}</p>
        </div>
      </article>

      <article class="sensor-details-card">
        <h2>Останній показник</h2>
        <div
          v-if="latestReading"
          class="sensor-details-card__content"
        >
          <p><strong>Дим:</strong> {{ formatMetric(latestReading.smokeLevel, '%') }}</p>
          <p><strong>Температура:</strong> {{ formatMetric(latestReading.temperature, '°C') }}</p>
          <p><strong>Вологість:</strong> {{ formatMetric(latestReading.humidity, '%') }}</p>
          <p>{{ formatDateTime(latestReading.timestamp) }}</p>
        </div>
        <p v-else>
          Зчитувань поки немає
        </p>
      </article>

      <article class="sensor-details-card">
        <h2>Останні зміни</h2>
        <p>Створено: {{ formatDateTime(sensor.createdAt) }}</p>
        <p>Оновлено: {{ formatDateTime(sensor.updatedAt) }}</p>
      </article>
    </section>

    <section
      v-if="sensor"
      class="sensor-details__content"
    >
      <article class="ui-card sensor-details__settings">
        <div class="section-header">
          <div>
            <h2>Налаштування сенсора</h2>
            <p>Оновіть розташування та стан сенсора в системі моніторингу.</p>
          </div>
        </div>

        <form
          class="auth-form"
          @submit.prevent="saveChanges"
        >
          <AppInput
            v-model="form.building"
            label="Будівля"
            placeholder="Building A"
          />
          <AppInput
            v-model="form.floor"
            label="Поверх"
            type="number"
            placeholder="0"
          />
          <AppInput
            v-model="form.location"
            label="Кімната / локація"
            placeholder="Room 101"
            required
          />
          <AppSelect
            v-model="form.status"
            label="Статус"
            :options="[
              { label: 'Активний', value: 'active' },
              { label: 'Неактивний', value: 'inactive' },
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
              class="sensor-details__delete-button"
              type="button"
              variant="danger"
              :loading="sensorsStore.submitLoading && deleteConfirmOpen"
              @click="openDeleteConfirm"
            >
              Видалити
            </AppButton>
            <AppButton
              type="submit"
              :loading="sensorsStore.submitLoading && !deleteConfirmOpen"
            >
              Зберегти зміни
            </AppButton>
          </div>
        </form>
      </article>

      <aside class="sensor-details__side-column">
        <article class="ui-card sensor-details__readings-filter">
          <div class="section-header">
            <div>
              <h2>Період зчитувань</h2>
              <p>{{ loadedReadingsLabel }}</p>
            </div>
          </div>

          <div class="sensor-details__period">
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
              placeholder="20"
            />
          </div>

          <AppButton
            class="sensor-details__refresh-readings"
            :loading="sensorsStore.readingsLoading"
            @click="refreshReadings"
          >
            Оновити показники
          </AppButton>
        </article>
      </aside>
    </section>

    <section
      v-if="sensor"
      class="ui-card sensor-details__chart-panel"
    >
      <div class="sensor-details__chart-header">
        <div>
          <h2>Динаміка показників</h2>
          <p>Оберіть показник для перегляду за поточний період.</p>
          <p
            v-if="chartRange"
            class="sensor-details__chart-period"
          >
            Період: {{ chartRange.label }}
          </p>
        </div>

        <div class="sensor-details__chart-controls">
          <div
            class="sensor-details__metric-tabs"
            role="tablist"
            aria-label="Показники сенсора"
          >
            <button
              v-for="metric in metricTabs"
              :key="metric.key"
              type="button"
              :class="{ 'sensor-details__metric-tab--active': activeMetric === metric.key }"
              @click="activeMetric = metric.key"
            >
              {{ metric.label }}
            </button>
          </div>

          <div
            class="sensor-details__preset-tabs"
            aria-label="Період графіка"
          >
            <button
              v-for="preset in chartRangePresets"
              :key="preset.value"
              type="button"
              :class="{ 'sensor-details__preset-tab--active': activeChartPreset === preset.value }"
              @click="applyChartPreset(preset.value)"
            >
              {{ preset.label }}
            </button>
            <span
              v-if="activeChartPreset === 'custom'"
              class="sensor-details__custom-period"
            >
              Власний період
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="isActiveMetricStable"
        class="sensor-details__stable-metric"
      >
        <h3>{{ activeMetricConfig.title }} стабільна</h3>
        <strong>{{ formatMetric(activeMetricStats.avg, activeMetricConfig.unit) }}</strong>
        <p>За вибраний період змін не зафіксовано</p>
      </div>
      <SensorLineChart
        v-else
        :title="activeMetricConfig.title"
        :color="activeMetricColor"
        :unit="activeMetricConfig.unit"
        :readings="filteredChartReadings"
        :range="chartRange"
        :selector="activeMetricConfig.selector"
      />

      <div class="sensor-details__metric-stats">
        <span>Мін: {{ formatMetric(activeMetricStats.min, activeMetricConfig.unit) }}</span>
        <span>Макс: {{ formatMetric(activeMetricStats.max, activeMetricConfig.unit) }}</span>
        <span>Середнє: {{ formatMetric(activeMetricStats.avg, activeMetricConfig.unit) }}</span>
      </div>
    </section>

    <section
      v-if="sensor"
      class="ui-card sensor-details__history"
    >
      <div class="section-header sensor-details__history-header">
        <div>
          <h2>Історія зчитувань</h2>
          <p>{{ loadedReadingsLabel }}</p>
        </div>
      </div>

      <AppEmptyState
        v-if="!sensorsStore.tableReadingsLoading && !sensorsStore.tableReadings.length"
        title="Зчитувань поки немає"
        description="Коли сенсор передасть дані, вони з’являться в історії."
      />

      <div
        v-else
        class="sensor-details__table-shell"
      >
        <table class="sensor-details__table">
          <thead>
            <tr>
              <th>Час</th>
              <th>Стан диму</th>
              <th>Рівень диму</th>
              <th>Температура</th>
              <th>Вологість</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="reading in sensorsStore.tableReadings"
              :key="reading.id"
            >
              <td>{{ formatDateTime(reading.timestamp) }}</td>
              <td>
                <AppBadge :tone="reading.smokeDetected ? 'danger' : 'success'">
                  {{ reading.smokeDetected ? 'Дим виявлено' : 'Диму немає' }}
                </AppBadge>
              </td>
              <td>{{ formatMetric(reading.smokeLevel, '%') }}</td>
              <td>{{ formatMetric(reading.temperature, '°C') }}</td>
              <td>{{ formatMetric(reading.humidity, '%') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="sensorsStore.tableReadings.length"
        class="sensor-details__history-footer"
      >
        <span v-if="sensorsStore.tableReadingsLoading">Завантаження...</span>
        <span v-else-if="!hasMoreReadings">Усі зчитування завантажено</span>
      </div>

      <div
        v-if="sensorsStore.tableReadings.length && hasMoreReadings"
        ref="loadMoreSentinel"
        class="sensor-details__sentinel"
        aria-hidden="true"
      />
    </section>

    <AppModal
      :open="deleteConfirmOpen"
      title="Видалити сенсор?"
      description="Цю дію неможливо скасувати. Сенсор і пов’язані з ним дані буде видалено із системи."
      @close="closeDeleteConfirm"
    >
      <p
        v-if="sensor"
        class="ui-card__detail"
      >
        {{ sensorLocation }}
      </p>

      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="closeDeleteConfirm"
        >
          Скасувати
        </AppButton>
        <AppButton
          variant="danger"
          :loading="sensorsStore.submitLoading"
          @click="removeSensor"
        >
          Видалити
        </AppButton>
      </div>
    </AppModal>

    <AppModal
      :open="Boolean(createdSensorSuccess)"
      title="Сенсор створено"
      description="Сенсор успішно додано до системи."
      tone="success"
      :close-on-interact-outside="false"
      @close="closeCreatedSensorModal"
    >
      <div class="created-sensor-modal">
        <section
          class="created-sensor-modal__section"
          aria-label="Інформація про створений сенсор"
        >
          <h3>Дані сенсора</h3>
          <div class="created-sensor-modal__details">
            <div class="created-sensor-modal__row">
              <span>ID сенсора</span>
              <strong>#{{ createdSensorSuccess?.sensorId }}</strong>
            </div>
            <div
              v-if="createdSensorLocation"
              class="created-sensor-modal__row"
            >
              <span>Розташування</span>
              <strong>{{ createdSensorLocation }}</strong>
            </div>
          </div>
        </section>

        <section class="created-sensor-modal__section">
          <div class="created-sensor-modal__section-heading">
            <h3>Код підключення</h3>
            <p>Використайте цей код для прив’язки фізичного ESP32-сенсора.</p>
          </div>
          <div class="created-sensor-modal__code-block">
            <code>{{ createdSensorSuccess?.sensorCode }}</code>
            <AppButton
              class="created-sensor-modal__copy"
              variant="ghost"
              type="button"
              @click="copySensorCode"
            >
              {{ copyButtonText }}
            </AppButton>
          </div>
          <p class="created-sensor-modal__warning">
            Код підключення показується лише один раз. Скопіюйте його перед закриттям вікна.
          </p>
        </section>
      </div>

      <p
        v-if="copyFeedback && copyFeedback.includes('Не вдалося')"
        class="form-message form-message--error"
      >
        {{ copyFeedback }}
      </p>

      <div class="created-sensor-modal__actions">
        <AppButton
          type="button"
          @click="closeCreatedSensorModal"
        >
          Зрозуміло
        </AppButton>
      </div>
    </AppModal>
  </section>
</template>

<style scoped>
.sensor-details {
  color: #111827;
}

.sensor-details.page-stack {
  gap: 1rem;
}

.sensor-details :deep(.app-badge) {
  letter-spacing: 0;
  text-transform: none;
}

.sensor-details__heading {
  padding: 1.2rem 1.35rem;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.sensor-details__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.sensor-details__title-row h1 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.8rem, 3vw, 2.35rem);
  line-height: 1.1;
  letter-spacing: 0;
}

.sensor-details__title-row :deep(.app-badge),
.sensor-details-card :deep(.app-badge),
.sensor-details__table :deep(.app-badge) {
  min-height: 26px;
  padding: 0.25rem 0.58rem;
  font-size: 0.78rem;
  line-height: 1;
}

.sensor-details__heading p {
  margin: 0.55rem 0 0;
  color: #6b7280;
}

.sensor-details__header-actions .app-button {
  min-height: 40px;
  padding: 0.62rem 0.95rem;
  border-color: #e5e7eb;
  background: #ffffff;
  box-shadow: none;
}

.sensor-details__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.sensor-details-card {
  display: grid;
  min-height: 112px;
  align-content: start;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.sensor-details-card h2,
.sensor-details__settings h2,
.sensor-details__readings-filter h2,
.sensor-details__chart-panel h2,
.sensor-details__history h2 {
  margin: 0;
  color: #111827;
  font-size: 1.05rem;
  line-height: 1.3;
  letter-spacing: 0;
}

.sensor-details-card p,
.sensor-details__settings p,
.sensor-details__readings-filter p,
.sensor-details__chart-panel p,
.sensor-details__history p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
}

.sensor-details-card__content {
  display: grid;
  gap: 0.35rem;
}

.sensor-details-card strong {
  color: #111827;
  font-weight: 750;
}

.sensor-details__content {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr);
  gap: 0.9rem;
  align-items: start;
}

.sensor-details__settings,
.sensor-details__readings-filter,
.sensor-details__chart-panel,
.sensor-details__history {
  border-color: #e5e7eb;
  background: #ffffff;
  box-shadow: none;
}

.sensor-details__settings .section-header,
.sensor-details__readings-filter .section-header {
  align-items: flex-start;
}

.sensor-details__settings .auth-form {
  margin-top: 1.25rem;
}

.sensor-details__settings .form-actions {
  align-items: center;
}

.sensor-details__delete-button.app-button {
  min-height: 44px;
  border-color: #fca5a5;
  background: #ffffff;
  color: #ef4444;
  box-shadow: none;
}

.sensor-details__delete-button.app-button:hover {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #ef4444;
}

.sensor-details__side-column {
  display: grid;
  gap: 0.9rem;
}

.sensor-details__readings-filter {
  display: grid;
  gap: 0.8rem;
}

.sensor-details__period {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.sensor-details__period :deep(.form-field) {
  min-width: 0;
}

.sensor-details__period :deep(.form-field__label) {
  font-size: 0.82rem;
}

.sensor-details__period :deep(.form-field__input) {
  min-width: 0;
  height: 40px;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  font-size: 0.86rem;
}

.sensor-details__period :deep(.form-field:last-child) {
  max-width: 150px;
}

.sensor-details__refresh-readings.app-button {
  width: fit-content;
  min-height: 38px;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  box-shadow: none;
}

.sensor-details__chart-panel {
  display: grid;
  gap: 0.85rem;
  padding: 1.1rem;
}

.sensor-details__chart-period {
  margin-top: 0.35rem;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 700;
}

.sensor-details__chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.sensor-details__chart-controls {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
}

.sensor-details__preset-tabs,
.sensor-details__metric-tabs {
  display: inline-flex;
  padding: 0.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f9fafb;
}

.sensor-details__preset-tabs button,
.sensor-details__metric-tabs button {
  min-height: 34px;
  padding: 0.35rem 0.75rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
}

.sensor-details__preset-tabs button:hover,
.sensor-details__preset-tab--active,
.sensor-details__metric-tabs button:hover,
.sensor-details__metric-tab--active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.sensor-details__custom-period {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0.35rem 0.75rem;
  color: #0f8b5f;
  font-size: 0.86rem;
  font-weight: 750;
}

.sensor-details__stable-metric {
  display: grid;
  min-height: 190px;
  place-items: center;
  gap: 0.45rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f9fafb;
  text-align: center;
}

.sensor-details__stable-metric h3 {
  margin: 0;
  color: #111827;
  font-size: 1rem;
  letter-spacing: 0;
}

.sensor-details__stable-metric strong {
  color: #111827;
  font-size: 2rem;
  line-height: 1;
}

.sensor-details__metric-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.sensor-details__metric-stats span {
  padding: 0.58rem 0.7rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 700;
}

.sensor-details__history-header {
  align-items: flex-start;
}

.sensor-details__table-shell {
  margin-top: 0.75rem;
  overflow-x: auto;
}

.sensor-details__table {
  width: 100%;
  border-collapse: collapse;
}

.sensor-details__table th,
.sensor-details__table td {
  height: 42px;
  padding: 0.46rem 0.7rem;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.sensor-details__table th {
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: 0;
  text-transform: none;
}

.sensor-details__history-footer {
  display: flex;
  justify-content: center;
  padding-top: 0.9rem;
  color: #6b7280;
  font-size: 0.9rem;
  font-weight: 650;
}

.sensor-details__sentinel {
  height: 1px;
}

.sensor-details-skeleton {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.sensor-details-skeleton span {
  min-height: 112px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: linear-gradient(90deg, #ffffff 0%, #f3f4f6 48%, #ffffff 100%);
  background-size: 220% 100%;
  animation: sensor-details-pulse 1.2s ease-in-out infinite;
}

.sensor-details-skeleton span:nth-child(n + 4) {
  min-height: 260px;
}

@keyframes sensor-details-pulse {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 1120px) {
  .sensor-details__summary,
  .sensor-details__content,
  .sensor-details-skeleton {
    grid-template-columns: 1fr;
  }

  .sensor-details__header-actions {
    width: 100%;
    flex-direction: row;
  }
}

@media (max-width: 760px) {
  .sensor-details__chart-header,
  .sensor-details__metric-stats {
    grid-template-columns: 1fr;
  }

  .sensor-details__chart-header {
    display: grid;
  }

  .sensor-details__chart-controls {
    justify-items: stretch;
  }

  .sensor-details__preset-tabs,
  .sensor-details__metric-tabs {
    width: 100%;
    flex-wrap: wrap;
  }

  .sensor-details__preset-tabs button,
  .sensor-details__metric-tabs button {
    flex: 1;
  }

  .sensor-details__period {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .sensor-details__heading,
  .sensor-details-card,
  .sensor-details__settings,
  .sensor-details__readings-filter,
  .sensor-details__chart-panel,
  .sensor-details__history {
    border-radius: 16px;
  }

  .sensor-details__header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .sensor-details__header-actions .app-button,
  .sensor-details__settings .form-actions .app-button {
    width: 100%;
  }
}
</style>
