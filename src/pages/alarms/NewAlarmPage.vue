<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppSelect from '@/shared/ui/AppSelect.vue';

const router = useRouter();
const alarmsStore = useAlarmsStore();
const sensorsStore = useSensorsStore();

const form = reactive({
  sensorId: '',
  location: '',
  floor: '',
  building: '',
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
  { label: 'Select sensor', value: '' },
  ...sensorsStore.sensors.map((sensor) => ({
    label: `#${sensor.id} - ${sensor.location}`,
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

async function submitForm() {
  errorMessage.value = '';

  try {
    const alarm = await alarmsStore.createAlarm({
      sensorId: Number(form.sensorId),
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
    });

    await router.push(`/alarms/${alarm.id}`);
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : alarmsStore.submitError || 'Не вдалося створити сигналізацію.';
  }
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
        <span class="hero-panel__eyebrow">New alarm</span>
        <h1>Створення сигналізації</h1>
      </div>
    </div>

    <section class="auth-card form-card-wide">
      <div class="auth-card__header">
        <span class="auth-card__eyebrow">Alarm provisioning</span>
        <h2>Конфігурація точки оповіщення</h2>
      </div>

      <form
        class="auth-form"
        @submit.prevent="submitForm"
      >
        <AppSelect
          v-model="form.sensorId"
          label="Сенсор"
          :options="sensorOptions"
        />
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

        <p
          v-if="errorMessage"
          class="form-message form-message--error"
        >
          {{ errorMessage }}
        </p>

        <div class="form-actions">
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
          >
            Створити сигналізацію
          </AppButton>
        </div>
      </form>
    </section>
  </section>
</template>
