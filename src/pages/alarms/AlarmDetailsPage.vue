<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { getAlarmTone, formatAlarmStatus } from '@/features/alarms/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';

const route = useRoute();
const router = useRouter();
const alarmsStore = useAlarmsStore();
const sensorsStore = useSensorsStore();

const alarmId = computed(() => Number(route.params.id));
const form = reactive({
  location: '',
  floor: '',
  building: '',
});
const errorMessage = ref('');
const actionMessage = ref('');

const alarm = computed(() => alarmsStore.currentAlarm);
const linkedSensor = computed(() =>
  sensorsStore.sensors.find((sensor) => sensor.id === alarmsStore.currentAlarm?.sensorId) ?? null,
);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function loadDetails() {
  await Promise.all([alarmsStore.fetchAlarm(alarmId.value), sensorsStore.fetchSensors()]);

  if (alarmsStore.currentAlarm) {
    form.location = alarmsStore.currentAlarm.location;
    form.floor =
      alarmsStore.currentAlarm.floor !== null ? String(alarmsStore.currentAlarm.floor) : '';
    form.building = alarmsStore.currentAlarm.building ?? '';
  }
}

async function saveChanges() {
  errorMessage.value = '';
  actionMessage.value = '';

  try {
    const updated = await alarmsStore.updateAlarm(alarmId.value, {
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
    });

    form.location = updated.location;
    form.floor = updated.floor !== null ? String(updated.floor) : '';
    form.building = updated.building ?? '';
    actionMessage.value = 'Зміни збережено.';
  } catch {
    errorMessage.value = 'Не вдалося оновити сигналізацію.';
  }
}

async function toggleAlarm() {
  if (!alarm.value) {
    return;
  }

  errorMessage.value = '';
  actionMessage.value = '';

  try {
    if (alarm.value.status === 'active') {
      await alarmsStore.deactivateAlarm(alarmId.value);
      actionMessage.value = 'Сигналізацію деактивовано.';
      return;
    }

    await alarmsStore.activateAlarm(alarmId.value);
    actionMessage.value = 'Сигналізацію активовано.';
  } catch {
    errorMessage.value = 'Не вдалося змінити стан сигналізації.';
  }
}

async function removeAlarm() {
  errorMessage.value = '';
  actionMessage.value = '';

  if (!window.confirm('Видалити сигналізацію? Цю дію не можна скасувати.')) {
    return;
  }

  try {
    await alarmsStore.deleteAlarm(alarmId.value);
    await router.push('/alarms');
  } catch {
    errorMessage.value = 'Не вдалося видалити сигналізацію.';
  }
}

onMounted(async () => {
  await loadDetails();
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">Alarm details</span>
        <h1>Сигналізація #{{ alarmId }}</h1>
        <p v-if="alarm">
          {{ formatSensorLocation(alarm.building, alarm.floor, alarm.location) }}
        </p>
      </div>

      <div class="inline-actions">
        <AppButton
          type="button"
          variant="ghost"
          @click="router.push('/alarms')"
        >
          До списку
        </AppButton>
        <AppButton
          type="button"
          variant="ghost"
          @click="loadDetails"
        >
          Оновити
        </AppButton>
      </div>
    </div>

    <section
      v-if="alarm"
      class="sensor-meta-grid"
    >
      <article class="ui-card">
        <span class="ui-card__label">Status</span>
        <div class="sensor-meta-grid__status">
          <AppBadge :tone="getAlarmTone(alarm.status)">
            {{ formatAlarmStatus(alarm.status) }}
          </AppBadge>
          <p class="ui-card__detail">
            Активовано: {{ formatDateTime(alarm.activatedAt) }}
          </p>
        </div>
      </article>
      <article class="ui-card">
        <span class="ui-card__label">Linked sensor</span>
        <p class="ui-card__value">
          #{{ alarm.sensorId }}
        </p>
        <p class="ui-card__detail">
          {{ linkedSensor ? formatSensorLocation(linkedSensor.building, linkedSensor.floor, linkedSensor.location) : 'Sensor data unavailable' }}
        </p>
      </article>
      <article class="ui-card">
        <span class="ui-card__label">Updated</span>
        <p class="ui-card__value">
          {{ formatDateTime(alarm.updatedAt) }}
        </p>
        <p class="ui-card__detail">
          Створено {{ formatDateTime(alarm.createdAt) }}
        </p>
      </article>
    </section>

    <section
      v-if="alarm"
      class="details-grid"
    >
      <article class="ui-card">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Configuration</span>
            <h2>Редагування сигналізації</h2>
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

          <p
            v-if="errorMessage"
            class="form-message form-message--error"
          >
            {{ errorMessage }}
          </p>

          <p
            v-if="actionMessage"
            class="form-message form-message--success"
          >
            {{ actionMessage }}
          </p>

          <div class="form-actions">
            <AppButton
              type="button"
              variant="ghost"
              @click="removeAlarm"
            >
              Видалити
            </AppButton>
            <AppButton
              type="submit"
              :loading="alarmsStore.submitLoading"
            >
              Зберегти зміни
            </AppButton>
          </div>
        </form>
      </article>

      <article class="ui-card">
        <div class="section-header">
          <div>
            <span class="ui-card__label">Manual control</span>
            <h2>Оперативні дії</h2>
          </div>
        </div>

        <div class="alarm-action-panel">
          <p class="ui-card__detail">
            Використовуйте ручне керування, щоб швидко змінити стан сигналізації.
          </p>

          <AppButton
            :variant="alarm.status === 'active' ? 'ghost' : 'primary'"
            :loading="alarmsStore.isActionPending(alarm.id, alarm.status === 'active' ? 'deactivate' : 'activate')"
            @click="toggleAlarm"
          >
            {{ alarm.status === 'active' ? 'Деактивувати сигналізацію' : 'Активувати сигналізацію' }}
          </AppButton>

          <p class="app-header__meta">
            Остання деактивація: {{ formatDateTime(alarm.deactivatedAt) }}
          </p>
        </div>
      </article>
    </section>
  </section>
</template>
