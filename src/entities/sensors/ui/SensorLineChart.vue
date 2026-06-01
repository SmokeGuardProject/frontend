<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { ChartOptions, ScriptableContext } from 'chart.js';
import type { SensorReading } from '@/features/sensors/model/sensor.types';

const MAX_READING_GAP_MS = 60 * 1000;

Chart.register(
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const props = defineProps<{
  title: string;
  color: string;
  unit: string;
  readings: SensorReading[];
  range?: {
    startDate: string;
    endDate: string;
  } | null;
  selector: (_reading: SensorReading) => number | null;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
type ChartPoint = { x: number; y: number };
let chart: Chart<'line', ChartPoint[], number> | null = null;

const chartSegments = computed(() => buildChartSegments(props.readings));
const chartRows = computed(() => chartSegments.value.flat());

const hasData = computed(() => chartRows.value.length > 0);
const valueBounds = computed(() => {
  const values = chartRows.value
    .map((row) => row.y)
    .filter((value): value is number => Number.isFinite(value));

  if (!values.length) {
    return {
      min: 0,
      max: 1,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return {
      min: min - 1,
      max: max + 1,
    };
  }

  return { min, max };
});

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    intersect: false,
    mode: 'index',
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
      displayColors: false,
      callbacks: {
        title(items) {
          const rawX = items[0]?.parsed.x;

          if (typeof rawX !== 'number' || !Number.isFinite(rawX)) {
            return '';
          }

          return new Intl.DateTimeFormat('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(rawX));
        },
        label(context) {
          const value = typeof context.parsed.y === 'number' ? context.parsed.y.toFixed(1) : '0.0';

          return `${props.title}: ${value} ${props.unit}`;
        },
      },
    },
  },
  scales: {
    x: {
      type: 'linear',
      min: chartBounds.value.min,
      max: chartBounds.value.max,
      grid: {
        color: '#f3f4f6',
        lineWidth: 1,
      },
      border: {
        display: false,
      },
      ticks: {
        color: '#6b7280',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6,
        font: {
          size: 11,
        },
        callback(value) {
          return formatChartTime(Number(value));
        },
      },
    },
    y: {
      min: valueBounds.value.min,
      max: valueBounds.value.max,
      grid: {
        color: '#eef2f7',
        lineWidth: 1,
      },
      border: {
        display: false,
      },
      ticks: {
        color: '#6b7280',
        maxTicksLimit: 5,
        padding: 8,
        font: {
          size: 11,
        },
        callback(value) {
          return `${formatAxisValue(Number(value))} ${props.unit}`;
        },
      },
    },
  },
}));

const chartBounds = computed(() => {
  const explicitStart = props.range?.startDate ? new Date(props.range.startDate).getTime() : null;
  const explicitEnd = props.range?.endDate ? new Date(props.range.endDate).getTime() : null;

  if (explicitStart !== null && explicitEnd !== null && explicitEnd > explicitStart) {
    return {
      min: explicitStart,
      max: explicitEnd,
    };
  }

  const timestamps = chartRows.value.map((row) => row.x);

  if (!timestamps.length) {
    const endDate = Date.now();

    return {
      min: endDate - 15 * 60 * 1000,
      max: endDate,
    };
  }

  return {
    min: Math.min(...timestamps),
    max: Math.max(...timestamps),
  };
});

function renderChart() {
  if (!canvasRef.value || !hasData.value) {
    chart?.destroy();
    chart = null;
    return;
  }

  const datasets = buildDatasets(chartSegments.value);

  if (!chart) {
    chart = new Chart(canvasRef.value, {
      type: 'line',
      data: {
        datasets,
      },
      options: chartOptions.value,
    });
    return;
  }

  chart.data.datasets = datasets;
  chart.options = chartOptions.value;
  chart.update('none');
}

function pointRadiusForContext(context: ScriptableContext<'line'>) {
  const data = context.dataset.data as ChartPoint[];
  const currentPoint = data[context.dataIndex];

  if (!currentPoint) {
    return 0;
  }

  return data.length === 1 ? 2.6 : 0;
}

function buildChartSegments(readings: SensorReading[]) {
  const segments: ChartPoint[][] = [];
  let currentSegment: ChartPoint[] = [];
  const sortedReadings = [...readings]
    .map((reading) => {
      const value = props.selector(reading);
      const timestamp = new Date(reading.timestamp).getTime();

      if (value === null || Number.isNaN(Number(value)) || !Number.isFinite(timestamp)) {
        return null;
      }

      return {
        timestamp,
        value: Number(value),
      };
    })
    .filter((reading): reading is { timestamp: number; value: number } => reading !== null)
    .sort((first, second) => first.timestamp - second.timestamp);

  sortedReadings.forEach((reading, index) => {
    const previousReading = index > 0 ? sortedReadings[index - 1] : null;

    if (previousReading && reading.timestamp - previousReading.timestamp > MAX_READING_GAP_MS) {
      if (currentSegment.length) {
        segments.push(currentSegment);
      }

      currentSegment = [];
    }

    currentSegment.push({
      x: reading.timestamp,
      y: reading.value,
    });
  });

  if (currentSegment.length) {
    segments.push(currentSegment);
  }

  return segments;
}

function buildDatasets(segments: ChartPoint[][]) {
  return segments.map((segment, index) => ({
    data: segment,
    label: `${props.title} ${index + 1}`,
    borderColor: props.color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: pointRadiusForContext,
    pointHoverRadius: 4,
    pointHoverBorderWidth: 2,
    pointHoverBackgroundColor: '#ffffff',
    pointHoverBorderColor: props.color,
    tension: 0.28,
    fill: false,
    spanGaps: false,
  }));
}

function formatChartTime(timestamp: number) {
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatAxisValue(value: number) {
  const range = valueBounds.value.max - valueBounds.value.min;

  if (range < 1) {
    return value.toFixed(2);
  }

  if (range < 10) {
    return value.toFixed(1);
  }

  return value.toFixed(0);
}

onMounted(async () => {
  await nextTick();
  renderChart();
});

watch(
  () => [chartSegments.value, props.color, props.unit],
  async () => {
    await nextTick();
    renderChart();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>

<template>
  <article class="chart-card">
    <div class="chart-card__header">
      <h3>{{ title }}</h3>
    </div>

    <div
      v-if="hasData"
      class="chart-card__canvas-wrap"
    >
      <canvas ref="canvasRef" />
    </div>

    <div
      v-else
      class="chart-card__empty"
    >
      Показники для цього параметра ще не надходили.
    </div>
  </article>
</template>

<style scoped>
.chart-card {
  display: grid;
  gap: 0.75rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.chart-card__header h3 {
  margin: 0;
  color: #111827;
  font-size: 1rem;
  line-height: 1.3;
  letter-spacing: 0;
}

.chart-card__canvas-wrap {
  position: relative;
  min-height: 240px;
  height: 240px;
  padding: 0.35rem 0 0;
}

.chart-card__empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  border: 1px dashed #d1d5db;
  border-radius: 14px;
  color: #6b7280;
  text-align: center;
}

@media (max-width: 640px) {
  .chart-card__canvas-wrap {
    min-height: 210px;
    height: 210px;
  }
}
</style>
