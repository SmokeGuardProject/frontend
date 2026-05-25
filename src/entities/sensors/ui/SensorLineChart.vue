<script setup lang="ts">
import { computed } from 'vue';
import { buildLineChartPoints } from '@/features/sensors/lib/chart';
import type { SensorReading } from '@/features/sensors/model/sensor.types';

const props = defineProps<{
  title: string;
  tone?: 'primary' | 'warning' | 'danger';
  unit: string;
  readings: SensorReading[];
  selector: (_reading: SensorReading) => number | null;
}>();

const chart = computed(() => buildLineChartPoints(props.readings, props.selector));
</script>

<template>
  <article class="chart-card">
    <div class="chart-card__header">
      <div>
        <span class="ui-card__label">{{ title }}</span>
        <p class="chart-card__range">
          <template v-if="chart.points.length">
            {{ chart.min.toFixed(1) }} - {{ chart.max.toFixed(1) }} {{ unit }}
          </template>
          <template v-else>
            No data
          </template>
        </p>
      </div>
    </div>

    <div
      v-if="chart.points.length"
      class="chart-card__body"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        class="chart-card__svg"
      >
        <defs>
          <linearGradient
            :id="`gradient-${title}`"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              :class="`chart-card__gradient-stop chart-card__gradient-stop--${tone ?? 'primary'}`"
            />
            <stop
              offset="100%"
              stop-color="transparent"
            />
          </linearGradient>
        </defs>
        <polyline
          :points="chart.polyline"
          :class="`chart-card__line chart-card__line--${tone ?? 'primary'}`"
        />
        <circle
          v-for="point in chart.points"
          :key="`${title}-${point.x}-${point.y}`"
          :cx="point.x"
          :cy="point.y"
          r="1.8"
          :class="`chart-card__point chart-card__point--${tone ?? 'primary'}`"
        />
      </svg>

      <div class="chart-card__legend">
        <span
          v-for="point in chart.points.slice(-4)"
          :key="`${title}-${point.label}`"
        >
          {{ point.label }}: {{ point.value.toFixed(1) }} {{ unit }}
        </span>
      </div>
    </div>

    <div
      v-else
      class="chart-card__empty"
    >
      Readings для цього показника ще не надходили.
    </div>
  </article>
</template>
