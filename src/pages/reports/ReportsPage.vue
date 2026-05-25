<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import { useReportsStore } from '@/features/reports/model/use-reports-store';
import AppButton from '@/shared/ui/AppButton.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import StatusCard from '@/shared/ui/StatusCard.vue';

const sensorsStore = useSensorsStore();
const reportsStore = useReportsStore();

const form = reactive({
  startDate: '',
  endDate: '',
  sensorId: '',
  eventType: '',
});

const sensorOptions = computed(() => [
  { label: 'All sensors', value: '' },
  ...sensorsStore.sensors.map((sensor) => ({
    label: `#${sensor.id} - ${sensor.location}`,
    value: String(sensor.id),
  })),
]);

const eventTypeOptions = [
  { label: 'All event types', value: '' },
  { label: 'Smoke detected', value: 'smoke_detected' },
  { label: 'Smoke cleared', value: 'smoke_cleared' },
  { label: 'Alarm activated', value: 'alarm_activated' },
  { label: 'Alarm deactivated', value: 'alarm_deactivated' },
];

const summaryCards = computed(() => [
  {
    title: 'Формат звіту',
    value: 'PDF',
    tone: 'neutral' as const,
  },
  {
    title: 'Доступні сенсори',
    value: String(sensorsStore.sensors.length),
    tone: 'success' as const,
  },
  {
    title: 'Останній звіт',
    value: reportsStore.lastFilename || 'Ще не створено',
    tone: 'warning' as const,
  },
]);

async function submitForm() {
  reportsStore.clearMessages();

  await reportsStore.generateReport({
    ...(form.startDate ? { startDate: new Date(form.startDate).toISOString() } : {}),
    ...(form.endDate ? { endDate: new Date(form.endDate).toISOString() } : {}),
    ...(form.sensorId ? { sensorId: Number(form.sensorId) } : {}),
    ...(form.eventType
      ? {
          eventType: form.eventType as
            | 'smoke_detected'
            | 'smoke_cleared'
            | 'alarm_activated'
            | 'alarm_deactivated',
        }
      : {}),
  });
}

function resetForm() {
  form.startDate = '';
  form.endDate = '';
  form.sensorId = '';
  form.eventType = '';
  reportsStore.clearMessages();
}

onMounted(async () => {
  if (!sensorsStore.sensors.length) {
    await sensorsStore.fetchSensors();
  }
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Reports</span>
        <h1>Генерація PDF-звітів</h1>
      </div>
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

    <section class="auth-card form-card-wide reports-card">
      <div class="auth-card__header">
        <span class="auth-card__eyebrow">Report filters</span>
        <h2>Параметри вибірки для PDF</h2>
      </div>

      <form
        class="auth-form"
        @submit.prevent="submitForm"
      >
        <AppAlert
          v-if="sensorsStore.listError"
          title="Sensors list unavailable"
          :message="sensorsStore.listError"
          tone="warning"
        >
          <AppButton @click="sensorsStore.fetchSensors()">
            Retry
          </AppButton>
        </AppAlert>

        <div class="filters-grid">
          <AppInput
            v-model="form.startDate"
            label="Початок періоду"
            type="datetime-local"
          />
          <AppInput
            v-model="form.endDate"
            label="Кінець періоду"
            type="datetime-local"
          />
          <AppSelect
            v-model="form.sensorId"
            label="Сенсор"
            :options="sensorOptions"
          />
        </div>

        <div class="filters-grid filters-grid--single">
          <AppSelect
            v-model="form.eventType"
            label="Тип події"
            :options="eventTypeOptions"
          />
        </div>

        <p
          v-if="reportsStore.successMessage"
          class="form-message form-message--success"
          role="status"
          aria-live="polite"
        >
          {{ reportsStore.successMessage }}
        </p>

        <p
          v-if="reportsStore.errorMessage"
          class="form-message form-message--error"
          role="alert"
          aria-live="assertive"
        >
          {{ reportsStore.errorMessage }}
        </p>

        <div class="form-actions">
          <AppButton
            type="button"
            variant="ghost"
            @click="resetForm"
          >
            Скинути
          </AppButton>
          <AppButton
            type="submit"
            :loading="reportsStore.isGenerating"
          >
            Згенерувати PDF
          </AppButton>
        </div>
      </form>
    </section>
  </section>
</template>
