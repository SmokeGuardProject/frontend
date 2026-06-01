<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { getAlarmTone, formatAlarmStatus } from '@/features/alarms/lib/formatters';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import AppModal from '@/shared/ui/AppModal.vue';
import { showToast } from '@/shared/ui/use-toast';

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
const deleteConfirmOpen = ref(false);
const actionConfirmOpen = ref(false);
const pageError = ref('');

const alarm = computed(() =>
  alarmsStore.currentAlarm?.id === alarmId.value ? alarmsStore.currentAlarm : null,
);
const linkedSensor = computed(() =>
  sensorsStore.sensors.find((sensor) => sensor.id === alarm.value?.sensorId) ?? null,
);
const alarmLocation = computed(() =>
  alarm.value ? formatSensorLocation(alarm.value.building, alarm.value.floor, alarm.value.location) : '',
);
const pendingActionType = computed(() => (alarm.value?.status === 'active' ? 'deactivate' : 'activate'));
const actionConfirmCopy = computed(() => {
  if (pendingActionType.value === 'deactivate') {
    return {
      title: 'Деактивувати сигналізацію?',
      description: 'Переконайтеся, що ситуацію перевірено і небезпеки немає.',
      confirm: 'Деактивувати',
      variant: 'success' as const,
    };
  }

  return {
    title: 'Активувати сигналізацію?',
    description: 'Ця дія може створити тривожну подію та запустити сповіщення.',
    confirm: 'Активувати',
    variant: 'danger' as const,
  };
});
const alarmStateTitle = computed(() => {
  if (!alarm.value) {
    return '';
  }

  if (alarm.value.status === 'active') {
    return 'Тривога активна';
  }

  return 'Тривога не активна';
});
const alarmStateDetail = computed(() => {
  if (!alarm.value) {
    return '';
  }

  if (alarm.value.status === 'active') {
    return alarm.value.activatedAt
      ? `Активовано: ${formatDateTime(alarm.value.activatedAt)}`
      : 'Ще не активувалась';
  }

  return alarm.value.deactivatedAt
    ? `Остання деактивація: ${formatDateTime(alarm.value.deactivatedAt)}`
    : 'Ще не деактивувалась';
});
const manualStateText = computed(() => {
  if (!alarm.value) {
    return '';
  }

  if (alarm.value.status === 'active') {
    return alarm.value.activatedAt
      ? `Активовано: ${formatDateTime(alarm.value.activatedAt)}`
      : 'Активовано: Ще не активувалась';
  }

  return alarm.value.deactivatedAt
    ? `Остання деактивація: ${formatDateTime(alarm.value.deactivatedAt)}`
    : 'Остання деактивація: Ще не деактивувалась';
});
const manualDescription = computed(() => {
  if (alarm.value?.status === 'active') {
    return 'Деактивуйте сигналізацію після перевірки, що небезпеки немає.';
  }

  return 'Активуйте сигналізацію вручну лише після перевірки необхідності.';
});

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function loadDetails() {
  pageError.value = '';

  try {
    await Promise.all([alarmsStore.fetchAlarm(alarmId.value), sensorsStore.fetchSensors()]);
  } catch {
    pageError.value = 'Не вдалося завантажити деталі сигналізації.';
    return;
  }

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
    showToast({
      title: 'Сигналізацію оновлено',
      message: `Сигналізацію #${updated.id} успішно відредаговано.`,
      tone: 'success',
    });
  } catch {
    errorMessage.value = 'Не вдалося оновити сигналізацію.';
  }
}

function openActionConfirm() {
  if (!alarm.value) {
    return;
  }

  errorMessage.value = '';
  actionMessage.value = '';
  actionConfirmOpen.value = true;
}

function closeActionConfirm() {
  if (alarmsStore.isActionPending(alarmId.value, pendingActionType.value)) {
    return;
  }

  actionConfirmOpen.value = false;
}

async function toggleAlarm() {
  if (!alarm.value) {
    return;
  }

  try {
    if (alarm.value.status === 'active') {
      await alarmsStore.deactivateAlarm(alarmId.value);
      actionConfirmOpen.value = false;
      actionMessage.value = 'Сигналізацію деактивовано.';
      showToast({
        title: 'Сигналізацію деактивовано',
        message: 'Сигналізацію деактивовано.',
        tone: 'success',
      });
      return;
    }

    await alarmsStore.activateAlarm(alarmId.value);
    actionConfirmOpen.value = false;
    actionMessage.value = 'Сигналізацію активовано.';
    showToast({
      title: 'Сигналізацію активовано',
      message: 'Сигналізацію активовано.',
      tone: 'success',
    });
  } catch {
    errorMessage.value = 'Не вдалося змінити стан сигналізації.';
  }
}

function openDeleteConfirm() {
  errorMessage.value = '';
  actionMessage.value = '';
  deleteConfirmOpen.value = true;
}

function closeDeleteConfirm() {
  if (alarmsStore.isActionPending(alarmId.value, 'delete')) {
    return;
  }

  deleteConfirmOpen.value = false;
}

async function removeAlarm() {
  try {
    await alarmsStore.deleteAlarm(alarmId.value);
    deleteConfirmOpen.value = false;
    showToast({
      title: 'Сигналізацію видалено',
      message: `Сигналізацію #${alarmId.value} успішно видалено.`,
      tone: 'success',
    });
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
  <section class="alarm-details page-stack">
    <div class="page-heading alarm-details__heading">
      <div>
        <div class="alarm-details__title-row">
          <h1>Сигналізація #{{ alarmId }}</h1>
          <AppBadge
            v-if="alarm"
            :tone="getAlarmTone(alarm.status)"
          >
            {{ formatAlarmStatus(alarm.status) }}
          </AppBadge>
        </div>
        <p v-if="alarm">
          {{ alarmLocation }}
        </p>
        <p v-else>
          Дані сигналізації завантажуються.
        </p>
      </div>

      <div class="inline-actions alarm-details__header-actions">
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
          :loading="alarmsStore.detailLoading"
          @click="loadDetails"
        >
          Оновити
        </AppButton>
      </div>
    </div>

    <div
      v-if="alarmsStore.detailLoading && !alarm"
      class="alarm-details-skeleton"
      aria-label="Деталі сигналізації завантажуються"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>

    <AppAlert
      v-else-if="pageError || alarmsStore.detailError"
      title="Сигналізацію не знайдено"
      :message="pageError || 'Не вдалося завантажити деталі сигналізації.'"
      tone="warning"
    >
      <AppButton @click="loadDetails">
        Повторити
      </AppButton>
    </AppAlert>

    <section
      v-else-if="alarm"
      class="alarm-details__summary"
    >
      <article class="alarm-details-card">
        <h2>Стан сигналізації</h2>
        <div class="alarm-details-card__content">
          <AppBadge :tone="getAlarmTone(alarm.status)">
            {{ formatAlarmStatus(alarm.status) }}
          </AppBadge>
          <p class="alarm-details-card__state-title">
            {{ alarmStateTitle }}
          </p>
          <p>{{ alarmStateDetail }}</p>
        </div>
      </article>
      <article class="alarm-details-card">
        <h2>Прив’язаний сенсор</h2>
        <p class="alarm-details-card__value">
          Сенсор #{{ alarm.sensorId }}
        </p>
        <p>{{ linkedSensor ? formatSensorLocation(linkedSensor.building, linkedSensor.floor, linkedSensor.location) : 'Дані сенсора недоступні' }}</p>
        <RouterLink
          class="alarm-details-card__link"
          :to="`/sensors/${alarm.sensorId}`"
        >
          Відкрити сенсор
        </RouterLink>
      </article>
      <article class="alarm-details-card">
        <h2>Останні зміни</h2>
        <p>Оновлено: {{ formatDateTime(alarm.updatedAt) }}</p>
        <p>Створено: {{ formatDateTime(alarm.createdAt) }}</p>
      </article>
    </section>

    <section
      v-if="alarm"
      class="alarm-details__content"
    >
      <article class="ui-card alarm-details__settings">
        <div class="section-header">
          <div>
            <h2>Налаштування сигналізації</h2>
            <p>Оновіть розташування сигналізації в системі моніторингу.</p>
          </div>
        </div>

        <form
          class="auth-form"
          @submit.prevent="saveChanges"
        >
          <AppInput
            v-model="form.building"
            label="Будівля"
            placeholder="Будівля A"
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
            placeholder="Кімната 101"
            required
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
              class="alarm-details__delete-button"
              type="button"
              variant="danger"
              :loading="alarmsStore.isActionPending(alarm.id, 'delete')"
              @click="openDeleteConfirm"
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

      <aside class="alarm-details__side-column">
        <article class="ui-card alarm-details__manual">
          <div class="section-header">
            <div>
              <h2>Ручне керування</h2>
              <p>{{ manualDescription }}</p>
            </div>
          </div>

          <div class="alarm-action-panel">
            <AppButton
              class="alarm-details__manual-button"
              :variant="alarm.status === 'active' ? 'success' : 'danger'"
              full-width
              :loading="alarmsStore.isActionPending(alarm.id, alarm.status === 'active' ? 'deactivate' : 'activate')"
              @click="openActionConfirm"
            >
              {{ alarm.status === 'active' ? 'Деактивувати сигналізацію' : 'Активувати сигналізацію' }}
            </AppButton>

            <p class="alarm-details__state-note">
              {{ manualStateText }}
            </p>
          </div>
        </article>
      </aside>
    </section>

    <AppModal
      :open="actionConfirmOpen"
      :title="actionConfirmCopy.title"
      :description="actionConfirmCopy.description"
      @close="closeActionConfirm"
    >
      <p
        v-if="alarm"
        class="ui-card__detail"
      >
        {{ alarmLocation }}
      </p>

      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="closeActionConfirm"
        >
          Скасувати
        </AppButton>
        <AppButton
          :variant="actionConfirmCopy.variant"
          :loading="alarmsStore.isActionPending(alarmId, pendingActionType)"
          @click="toggleAlarm"
        >
          {{ actionConfirmCopy.confirm }}
        </AppButton>
      </div>
    </AppModal>

    <AppModal
      :open="deleteConfirmOpen"
      title="Видалити сигналізацію?"
      description="Цю дію неможливо скасувати. Сигналізація буде видалена із системи."
      @close="closeDeleteConfirm"
    >
      <p
        v-if="alarm"
        class="ui-card__detail"
      >
        {{ alarmLocation }}
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
          :loading="alarmsStore.isActionPending(alarmId, 'delete')"
          @click="removeAlarm"
        >
          Видалити
        </AppButton>
      </div>
    </AppModal>
  </section>
</template>

<style scoped>
.alarm-details {
  color: #111827;
}

.alarm-details :deep(.app-badge) {
  letter-spacing: 0;
  text-transform: none;
}

.alarm-details__heading {
  padding: 1.2rem 1.35rem;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.alarm-details__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.alarm-details__title-row :deep(.app-badge) {
  align-self: center;
  flex: 0 0 auto;
  min-height: 26px;
  padding: 0.25rem 0.58rem;
  font-size: 0.78rem;
  line-height: 1;
}

.alarm-details__title-row h1 {
  margin: 0;
  color: #111827;
  font-size: clamp(1.8rem, 3vw, 2.35rem);
  line-height: 1.1;
  letter-spacing: 0;
}

.alarm-details__heading p {
  margin: 0.55rem 0 0;
  color: #6b7280;
}

.alarm-details__header-actions .app-button {
  min-height: 40px;
  padding: 0.62rem 0.95rem;
  border-color: #e5e7eb;
  background: #ffffff;
  box-shadow: none;
}

.alarm-details__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.alarm-details-card {
  display: grid;
  min-height: 126px;
  align-content: start;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: none;
}

.alarm-details-card h2,
.alarm-details__settings h2,
.alarm-details__manual h2 {
  margin: 0;
  color: #111827;
  font-size: 1.05rem;
  line-height: 1.3;
  letter-spacing: 0;
}

.alarm-details-card p,
.alarm-details__settings p,
.alarm-details__manual p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
}

.alarm-details-card__content {
  display: grid;
  gap: 0.55rem;
}

.alarm-details-card__content :deep(.app-badge) {
  width: fit-content;
  min-height: 26px;
  padding: 0.25rem 0.58rem;
  font-size: 0.78rem;
  line-height: 1;
}

.alarm-details-card__value {
  color: #111827;
  font-weight: 750;
}

.alarm-details-card__state-title {
  color: #111827;
  font-weight: 750;
}

.alarm-details-card__link {
  width: fit-content;
  margin-top: auto;
  color: #0f8b5f;
  font-weight: 750;
}

.alarm-details-card__link:hover {
  color: #059669;
}

.alarm-details__content {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr);
  gap: 1rem;
  align-items: start;
}

.alarm-details__settings,
.alarm-details__manual {
  border-color: #e5e7eb;
  background: #ffffff;
  box-shadow: none;
}

.alarm-details__settings .section-header,
.alarm-details__manual .section-header {
  align-items: flex-start;
}

.alarm-details__settings .auth-form {
  margin-top: 1.25rem;
}

.alarm-details__settings .form-actions {
  align-items: center;
}

.alarm-details__delete-button.app-button {
  min-height: 44px;
  border-color: #fca5a5;
  background: #ffffff;
  color: #ef4444;
  box-shadow: none;
}

.alarm-details__delete-button.app-button:hover {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #ef4444;
}

.alarm-details__delete-button.app-button:active {
  border-color: #f87171;
  background: #fee2e2;
  color: #dc2626;
}

.alarm-details__side-column {
  display: grid;
  gap: 1rem;
}

.alarm-details__manual {
  display: grid;
  gap: 1rem;
}

.alarm-details__manual-button.app-button {
  min-height: 50px;
  padding: 0.72rem 1rem;
  box-shadow: none;
}

.alarm-details__state-note {
  padding: 0.75rem 0.9rem;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f9fafb;
  font-size: 0.94rem;
  font-weight: 650;
}

.alarm-details-skeleton {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.alarm-details-skeleton span {
  min-height: 126px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: linear-gradient(90deg, #ffffff 0%, #f3f4f6 48%, #ffffff 100%);
  background-size: 220% 100%;
  animation: alarm-details-pulse 1.2s ease-in-out infinite;
}

.alarm-details-skeleton span:nth-child(n + 4) {
  min-height: 260px;
}

@keyframes alarm-details-pulse {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (max-width: 1120px) {
  .alarm-details__summary,
  .alarm-details__content,
  .alarm-details-skeleton {
    grid-template-columns: 1fr;
  }

  .alarm-details__header-actions {
    width: 100%;
    flex-direction: row;
  }
}

@media (max-width: 640px) {
  .alarm-details__heading,
  .alarm-details-card,
  .alarm-details__settings,
  .alarm-details__manual {
    border-radius: 16px;
  }

  .alarm-details__header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .alarm-details__header-actions .app-button,
  .alarm-details__settings .form-actions .app-button {
    width: 100%;
  }
}
</style>
