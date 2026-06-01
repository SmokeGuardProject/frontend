<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import { useReportsStore } from '@/features/reports/model/use-reports-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import AppButton from '@/shared/ui/AppButton.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import { showToast } from '@/shared/ui/use-toast';

type ReportEventType =
  | 'smoke_detected'
  | 'smoke_cleared'
  | 'alarm_activated'
  | 'alarm_deactivated';

const sensorsStore = useSensorsStore();
const reportsStore = useReportsStore();
const validationError = ref('');

const form = reactive({
  startDate: '',
  endDate: '',
  sensorId: '',
  eventType: '',
});

const eventTypeOptions: Array<{ label: string; value: '' | ReportEventType }> = [
  { label: 'Усі типи подій', value: '' },
  { label: 'Виявлено дим', value: 'smoke_detected' },
  { label: 'Дим зник', value: 'smoke_cleared' },
  { label: 'Сигналізація активована', value: 'alarm_activated' },
  { label: 'Сигналізація деактивована', value: 'alarm_deactivated' },
];

const sensorOptions = computed(() => [
  { label: sensorsStore.sensors.length ? 'Усі сенсори' : 'Сенсорів немає', value: '' },
  ...sensorsStore.sensors.map((sensor) => ({
    label: `Сенсор #${sensor.id} — ${formatSensorLocation(sensor.building, sensor.floor, sensor.location)}`,
    value: String(sensor.id),
  })),
]);
const lastReportValue = computed(() =>
  reportsStore.lastGeneratedAt ? formatDateTime(reportsStore.lastGeneratedAt) : 'Не створено',
);
const lastReportDescription = computed(() =>
  reportsStore.lastGeneratedAt ? 'Останній сформований PDF' : 'Після генерації тут з’явиться дата',
);
const summaryCards = computed(() => [
  {
    title: 'Формат',
    value: 'PDF',
    description: 'Звіт формується у форматі PDF',
  },
  {
    title: 'Доступні сенсори',
    value: String(sensorsStore.sensors.length),
    description: 'Можна вибрати один сенсор або всі',
  },
  {
    title: 'Останній звіт',
    value: lastReportValue.value,
    description: lastReportDescription.value,
  },
]);

function validateForm() {
  if (!form.startDate || !form.endDate) {
    return 'Виберіть початок і кінець періоду.';
  }

  if (new Date(form.startDate).getTime() > new Date(form.endDate).getTime()) {
    return 'Початок періоду не може бути пізніше кінця.';
  }

  return '';
}

async function submitForm() {
  reportsStore.clearMessages();
  validationError.value = validateForm();

  if (validationError.value) {
    return;
  }

  try {
    await reportsStore.generateReport({
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      ...(form.sensorId ? { sensorId: Number(form.sensorId) } : {}),
      ...(form.eventType ? { eventType: form.eventType as ReportEventType } : {}),
    });

    showToast({
      title: 'PDF-звіт створено',
      message: 'Файл завантажено на ваш пристрій.',
      tone: 'success',
    });
  } catch {
    showToast({
      title: 'Не вдалося створити PDF-звіт',
      message: 'Перевірте параметри звіту та спробуйте ще раз.',
      tone: 'danger',
    });
  }
}

function resetForm() {
  form.startDate = '';
  form.endDate = '';
  form.sensorId = '';
  form.eventType = '';
  validationError.value = '';
  reportsStore.clearMessages();
}

onMounted(async () => {
  if (!sensorsStore.sensors.length) {
    await sensorsStore.fetchSensors();
  }
});
</script>

<template>
  <section class="reports-page">
    <div class="reports-page__heading">
      <div>
        <p>Сформуйте PDF-звіт за подіями системи, сенсорами та вибраним періодом.</p>
      </div>
    </div>

    <div class="reports-summary">
      <article
        v-for="card in summaryCards"
        :key="card.title"
        class="reports-summary__card"
      >
        <span>{{ card.title }}</span>
        <strong>{{ card.value }}</strong>
        <p>{{ card.description }}</p>
      </article>
    </div>

    <section class="reports-card">
      <div class="reports-card__header">
        <div>
          <h2>Параметри звіту</h2>
          <p>Виберіть період, сенсор і тип подій для формування PDF.</p>
        </div>
      </div>

      <form
        class="reports-form"
        @submit.prevent="submitForm"
      >
        <AppAlert
          v-if="sensorsStore.listError"
          title="Потрібна увага"
          :message="sensorsStore.listError"
          tone="warning"
        >
          <AppButton @click="sensorsStore.fetchSensors()">
            Повторити
          </AppButton>
        </AppAlert>

        <div class="reports-form__grid">
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
          <AppSelect
            v-model="form.eventType"
            label="Тип подій"
            :options="eventTypeOptions"
          />
        </div>

        <p
          v-if="validationError || reportsStore.errorMessage"
          class="reports-form__message reports-form__message--error"
          role="alert"
          aria-live="assertive"
        >
          {{ validationError || reportsStore.errorMessage }}
        </p>

        <div class="reports-form__actions">
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
            loading-text="Генерація..."
          >
            Згенерувати PDF
          </AppButton>
        </div>
      </form>
    </section>
  </section>
</template>

<style scoped>
.reports-page {
  display: grid;
  gap: 1.25rem;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.reports-page__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.reports-page__heading h1 {
  margin: 0;
  color: #111827;
  font-size: 1.55rem;
  line-height: 1.2;
  letter-spacing: 0;
}

.reports-page__heading p {
  margin: 0.45rem 0 0;
  max-width: 680px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.reports-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.15rem;
}

.reports-summary__card {
  display: grid;
  min-height: 142px;
  align-content: space-between;
  gap: 0.55rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.reports-summary__card span {
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0;
}

.reports-summary__card strong {
  color: #111827;
  font-size: 1.8rem;
  line-height: 1.1;
}

.reports-summary__card p {
  margin: 0;
  color: #6b7280;
  font-size: 0.88rem;
  line-height: 1.45;
}

.reports-card {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.reports-card__header {
  padding: 1.5rem 1.5rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.reports-card__header h2 {
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.reports-card__header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.reports-form {
  display: grid;
  gap: 1.25rem;
  padding: 1.5rem;
}

.reports-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.reports-form__message {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
}

.reports-form__message--error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.reports-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.reports-form__actions :deep(.app-button) {
  min-height: 48px;
  border-radius: 12px;
  box-shadow: none;
}

.reports-form__actions :deep(.app-button:not(.app-button--ghost)) {
  border-color: #0f8b5f;
  background: #0f8b5f;
}

@media (max-width: 980px) {
  .reports-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reports-summary__card:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .reports-summary,
  .reports-form__grid {
    grid-template-columns: 1fr;
  }

  .reports-summary__card:last-child {
    grid-column: auto;
  }

  .reports-form__actions {
    flex-direction: column-reverse;
  }

  .reports-form__actions :deep(.app-button) {
    width: 100%;
  }
}
</style>
