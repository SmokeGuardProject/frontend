<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';
import { showToast } from '@/shared/ui/use-toast';

const router = useRouter();
const alarmsStore = useAlarmsStore();
const sensorsStore = useSensorsStore();

const form = reactive({
  sensorId: '',
  building: '',
  floor: '',
  location: '',
});

const fieldErrors = reactive({
  sensorId: '',
  floor: '',
  location: '',
});

const errorMessage = ref('');

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

const sensorOptions = computed(() => [
  { label: 'Оберіть сенсор', value: '' },
  ...sensorsStore.sensors.map((sensor) => ({
    label: `Сенсор #${sensor.id} — ${formatSensorLocation(sensor.building, sensor.floor, sensor.location)}`,
    value: String(sensor.id),
  })),
]);

watch(
  () => form.sensorId,
  (sensorId) => {
    const sensor = sensorsStore.sensors.find((item) => item.id === Number(sensorId));

    if (!sensor) {
      return;
    }

    if (!normalizeText(form.location)) {
      form.location = sensor.location;
    }

    if (!normalizeText(form.floor) && sensor.floor !== null) {
      form.floor = String(sensor.floor);
    }

    if (!normalizeText(form.building) && sensor.building) {
      form.building = sensor.building;
    }
  },
);

function resetFieldErrors() {
  fieldErrors.sensorId = '';
  fieldErrors.floor = '';
  fieldErrors.location = '';
}

function validateForm() {
  resetFieldErrors();

  if (!normalizeText(form.sensorId)) {
    fieldErrors.sensorId = 'Оберіть сенсор.';
  }

  const floor = normalizeText(form.floor);

  if (floor && Number.isNaN(Number(floor))) {
    fieldErrors.floor = 'Вкажіть поверх числом.';
  }

  if (!normalizeText(form.location)) {
    fieldErrors.location = 'Вкажіть кімнату або локацію.';
  }

  return !fieldErrors.sensorId && !fieldErrors.floor && !fieldErrors.location;
}

function formatUserErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : alarmsStore.submitError;

  if (!rawMessage) {
    return 'Не вдалося створити сигналізацію. Спробуйте ще раз.';
  }

  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('network error') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('failed to fetch')
  ) {
    return 'Не вдалося зв’язатися із сервером. Спробуйте ще раз трохи пізніше.';
  }

  if (normalized.includes('sensor') && normalized.includes('required')) {
    return 'Оберіть сенсор для сигналізації.';
  }

  return rawMessage;
}

async function submitForm() {
  errorMessage.value = '';

  if (!validateForm()) {
    return;
  }

  try {
    const alarm = await alarmsStore.createAlarm({
      sensorId: Number(form.sensorId),
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
    });

    showToast({
      title: 'Сигналізацію додано',
      message: `Сигналізацію #${alarm.id} успішно створено.`,
      tone: 'success',
    });

    await router.push(`/alarms/${alarm.id}`);
  } catch (error) {
    errorMessage.value = formatUserErrorMessage(error);
  }
}

onMounted(async () => {
  if (!sensorsStore.sensors.length) {
    await sensorsStore.fetchSensors();
  }
});
</script>

<template>
  <section class="create-page">
    <p class="create-page__description">
      Прив’яжіть сигналізацію до сенсора та задайте її розташування.
    </p>

    <section class="create-card">
      <div class="create-card__header">
        <h2>Розташування сигналізації</h2>
      </div>

      <form
        class="create-form"
        @submit.prevent="submitForm"
      >
        <AppSelect
          v-model="form.sensorId"
          label="Сенсор"
          :options="sensorOptions"
          :error="fieldErrors.sensorId"
        />
        <AppInput
          v-model="form.building"
          label="Будівля"
          placeholder="Наприклад: Building A"
        />
        <AppInput
          v-model="form.floor"
          label="Поверх"
          type="number"
          placeholder="Наприклад: 0"
          helper-text="Можна використовувати 0 для першого/наземного поверху та від’ємні значення для підвалу."
          :error="fieldErrors.floor"
        />
        <AppInput
          v-model="form.location"
          label="Кімната / локація"
          placeholder="Наприклад: Room 101"
          required
          :error="fieldErrors.location"
        />

        <p
          v-if="errorMessage"
          class="create-alert"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <div class="create-actions">
          <AppButton
            type="button"
            variant="ghost"
            @click="router.push('/alarms')"
          >
            Назад
          </AppButton>
          <AppButton
            type="submit"
            :loading="alarmsStore.submitLoading"
            loading-text="Створення..."
          >
            Створити сигналізацію
          </AppButton>
        </div>
      </form>
    </section>
  </section>
</template>

<style scoped>
.create-page {
  display: grid;
  justify-items: start;
  gap: 1rem;
  padding-top: 0.25rem;
}

.create-page__description {
  margin: 0;
  max-width: 640px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.create-card {
  width: min(100%, 720px);
  padding: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.035);
}

.create-card__header h2 {
  margin: 0;
  color: #111827;
  font-size: 1.18rem;
  letter-spacing: 0;
}

.create-form {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
}

.create-form :deep(.form-field) {
  gap: 0.45rem;
}

.create-form :deep(.form-field__label) {
  color: #374151;
  font-size: 0.9rem;
  font-weight: 700;
}

.create-form :deep(.form-field__input) {
  min-height: 50px;
  padding: 0 0.95rem;
  border-color: #e5e7eb;
  border-radius: 12px;
  color: #111827;
  box-shadow: none;
}

.create-form :deep(.form-field__input:focus) {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.create-form :deep(.form-field__input::placeholder) {
  color: #9ca3af;
}

.create-form :deep(.form-field--error .form-field__input) {
  border-color: #ef4444;
}

.create-form :deep(.form-field__helper),
.create-form :deep(.form-field__error) {
  font-size: 0.8rem;
  line-height: 1.4;
}

.create-form :deep(.form-field__helper) {
  color: #6b7280;
}

.create-form :deep(.form-field__error) {
  color: #dc2626;
}

.create-alert {
  margin: 0;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 12px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.9rem;
  line-height: 1.45;
}

.create-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.create-actions :deep(.app-button) {
  min-height: 50px;
  padding: 0 1.15rem;
  border-radius: 12px;
  box-shadow: none;
}

.create-actions :deep(.app-button:not(.app-button--ghost)) {
  border-color: #0f8b5f;
  background: #0f8b5f;
}

.create-actions :deep(.app-button:not(.app-button--ghost):hover) {
  background: #059669;
}

.create-actions :deep(.app-button:not(.app-button--ghost):active) {
  background: #047857;
}

@media (max-width: 720px) {
  .create-card {
    padding: 24px;
  }

  .create-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
