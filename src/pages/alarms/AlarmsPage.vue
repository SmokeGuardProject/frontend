<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import { RouterLink } from 'vue-router';
import { alarmsApi } from '@/features/alarms/api/alarms.api';
import type { Alarm } from '@/features/alarms/model/alarm.types';
import { useAlarmsStore } from '@/features/alarms/model/use-alarms-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppModal from '@/shared/ui/AppModal.vue';
import { showToast } from '@/shared/ui/use-toast';

const alarmsStore = useAlarmsStore();
const sensorsStore = useSensorsStore();

const filterForm = reactive({
  status: '',
  floor: '',
  building: '',
});
const alarmStats = ref<Alarm[]>([]);
const isResettingFilters = ref(false);
const alarmPendingDeleteId = ref<number | null>(null);
const alarmPendingAction = ref<{ alarmId: number; type: 'activate' | 'deactivate' } | null>(null);
const pendingBulkAction = ref<'activate-all' | 'deactivate-all' | null>(null);
let floorFilterTimerId: number | null = null;

const statusOptions = [
  { label: 'Всі статуси', value: '' },
  { label: 'Активні', value: 'active' },
  { label: 'Неактивні', value: 'inactive' },
];

const alarmPendingDelete = computed(() =>
  alarmsStore.alarms.find((alarm) => alarm.id === alarmPendingDeleteId.value) ?? null,
);
const alarmPendingActionItem = computed(() =>
  alarmsStore.alarms.find((alarm) => alarm.id === alarmPendingAction.value?.alarmId) ?? null,
);
const alarmActionCopy = computed(() => {
  if (alarmPendingAction.value?.type === 'deactivate') {
    return {
      title: 'Деактивувати сигналізацію?',
      description: 'Після підтвердження сигналізація буде вимкнена вручну.',
      confirm: 'Так, деактивувати',
      variant: 'success' as const,
      loadingType: 'deactivate' as const,
    };
  }

  return {
    title: 'Активувати сигналізацію?',
    description: 'Після підтвердження сигналізація перейде в активний стан.',
    confirm: 'Так, активувати',
    variant: 'danger' as const,
    loadingType: 'activate' as const,
  };
});
const bulkActionCopy = computed(() => {
  if (pendingBulkAction.value === 'deactivate-all') {
    return {
      title: 'Деактивувати всі сигналізації?',
      description: 'Після підтвердження всі доступні активні сигналізації будуть вимкнені.',
      confirm: 'Так, деактивувати всі',
      variant: 'success' as const,
    };
  }

  return {
    title: 'Активувати всі сигналізації?',
    description: 'Після підтвердження система спробує активувати всі доступні сигналізації.',
    confirm: 'Так, активувати всі',
    variant: 'danger' as const,
  };
});
const hasActiveFilter = computed(() => Boolean(filterForm.status || filterForm.floor || filterForm.building.trim()));
const alarmBuildingOptions = computed(() =>
  Array.from(
    new Set(
      alarmStats.value
        .map((alarm) => alarm.building)
        .filter((building): building is string => Boolean(building?.trim())),
    ),
  ).sort((first, second) => first.localeCompare(second, 'uk')),
);
const emptyStateTitle = computed(() =>
  hasActiveFilter.value ? 'За вибраними фільтрами сигналізацій не знайдено.' : 'Сигналізації ще не додані',
);
const summaryCards = computed(() => [
  {
    label: 'Всього сигналізацій',
    value: alarmStats.value.length,
    tone: 'neutral',
  },
  {
    label: 'Активні',
    value: alarmStats.value.filter((alarm) => alarm.status === 'active').length,
    tone: 'active',
  },
  {
    label: 'Неактивні',
    value: alarmStats.value.filter((alarm) => alarm.status === 'inactive').length,
    tone: 'inactive',
  },
]);

function sensorLocation(sensorId: number) {
  const sensor = sensorsStore.sensors.find((item) => item.id === sensorId);

  if (!sensor) {
    return 'Дані сенсора недоступні';
  }

  return formatSensorLocation(sensor.building, sensor.floor, sensor.location);
}

function alarmPrimaryLocation(alarm: Alarm) {
  return alarm.building || alarm.location;
}

function alarmSecondaryLocation(alarm: Alarm) {
  const parts = [alarm.floor !== null ? `Поверх ${alarm.floor}` : null, alarm.location].filter(Boolean);
  return parts.join(', ');
}

function alarmStatusLabel(status: string) {
  return status === 'active' ? 'Активна' : 'Неактивна';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function resetFilters() {
  isResettingFilters.value = true;
  if (floorFilterTimerId !== null) {
    window.clearTimeout(floorFilterTimerId);
    floorFilterTimerId = null;
  }
  filterForm.status = '';
  filterForm.floor = '';
  filterForm.building = '';
  await nextTick();
  isResettingFilters.value = false;
  await applyFilters();
}

async function refreshAlarmStats() {
  alarmStats.value = await alarmsApi.getAlarms();
}

async function loadPage() {
  await Promise.all([
    sensorsStore.fetchSensors(),
    refreshAlarmStats(),
    alarmsStore.fetchAlarms({
      status: filterForm.status as 'active' | 'inactive' | '',
      floor: normalizeOptionalNumber(filterForm.floor),
      building: normalizeText(filterForm.building),
    }),
  ]);
}

async function applyFilters() {
  await alarmsStore.fetchAlarms({
    status: filterForm.status as 'active' | 'inactive' | '',
    floor: normalizeOptionalNumber(filterForm.floor),
    building: normalizeText(filterForm.building),
  });
}

function requestToggleAlarm(alarm: Alarm) {
  alarmPendingAction.value = {
    alarmId: alarm.id,
    type: alarm.status === 'active' ? 'deactivate' : 'activate',
  };
}

function closeActionModal() {
  if (
    alarmPendingAction.value &&
    alarmsStore.isActionPending(alarmPendingAction.value.alarmId, alarmPendingAction.value.type)
  ) {
    return;
  }

  alarmPendingAction.value = null;
}

async function confirmAlarmAction() {
  const pendingAction = alarmPendingAction.value;

  if (!pendingAction) {
    return;
  }

  if (pendingAction.type === 'deactivate') {
    await alarmsStore.deactivateAlarm(pendingAction.alarmId);
    await refreshAlarmStats();
    alarmPendingAction.value = null;
    showToast({
      title: 'Стан змінено',
      message: 'Сигналізацію деактивовано.',
      tone: 'success',
    });
    return;
  }

  await alarmsStore.activateAlarm(pendingAction.alarmId);
  await refreshAlarmStats();
  alarmPendingAction.value = null;
  showToast({
    title: 'Стан змінено',
    message: 'Сигналізацію активовано.',
    tone: 'success',
  });
}

function requestBulkAction(type: 'activate-all' | 'deactivate-all') {
  pendingBulkAction.value = type;
}

function closeBulkActionModal() {
  if (pendingBulkAction.value && alarmsStore.isBulkActionPending(pendingBulkAction.value)) {
    return;
  }

  pendingBulkAction.value = null;
}

function requestRemoveAlarm(alarmId: number) {
  alarmPendingDeleteId.value = alarmId;
}

function closeDeleteModal() {
  if (
    alarmPendingDeleteId.value !== null &&
    alarmsStore.isActionPending(alarmPendingDeleteId.value, 'delete')
  ) {
    return;
  }

  alarmPendingDeleteId.value = null;
}

async function confirmRemoveAlarm() {
  const alarmId = alarmPendingDeleteId.value;

  if (alarmId === null) {
    return;
  }

  await alarmsStore.deleteAlarm(alarmId);
  await refreshAlarmStats();
  alarmPendingDeleteId.value = null;
  showToast({
    title: 'Сигналізацію видалено',
    message: `Сигналізацію #${alarmId} успішно видалено.`,
    tone: 'success',
  });
}

async function activateAll() {
  const result = await alarmsStore.activateAllAlarms();
  await refreshAlarmStats();
  pendingBulkAction.value = null;
  showToast({
    title: 'Сигналізації увімкнено',
    message: `Активовано ${result.activated ?? 0} з ${result.total}.`,
    tone: result.failed.length ? 'warning' : 'success',
  });
}

async function deactivateAll() {
  const result = await alarmsStore.deactivateAllAlarms();
  await refreshAlarmStats();
  pendingBulkAction.value = null;
  showToast({
    title: 'Сигналізації вимкнено',
    message: `Деактивовано ${result.deactivated ?? 0} з ${result.total}.`,
    tone: result.failed.length ? 'warning' : 'success',
  });
}

onMounted(async () => {
  await loadPage();
});

watch(
  () => [filterForm.status, filterForm.building],
  () => {
    if (!isResettingFilters.value) {
      void applyFilters();
    }
  },
);

watch(
  () => filterForm.floor,
  () => {
    if (isResettingFilters.value) {
      return;
    }

    if (floorFilterTimerId !== null) {
      window.clearTimeout(floorFilterTimerId);
    }

    floorFilterTimerId = window.setTimeout(() => {
      floorFilterTimerId = null;
      void applyFilters();
    }, 350);
  },
);

onUnmounted(() => {
  if (floorFilterTimerId !== null) {
    window.clearTimeout(floorFilterTimerId);
  }
});
</script>

<template>
  <section class="alarms-page">
    <div class="alarms-page__heading">
      <p>Переглядайте стан сигналізацій та керуйте їх активацією.</p>

      <RouterLink to="/alarms/new">
        <AppButton class="alarms-page__add-button">
          <span
            class="alarms-page__add-icon"
            aria-hidden="true"
          >
            +
          </span>
          Додати сигналізацію
        </AppButton>
      </RouterLink>
    </div>

    <div class="alarms-summary">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="alarms-summary__card"
        :class="`alarms-summary__card--${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <section class="alarms-table-card">
      <div class="alarms-table-card__header">
        <div class="alarms-table-card__intro">
          <h2>Список сигналізацій</h2>
          <p>Стан сигналізацій і прив’язані до них сенсори.</p>

          <div class="alarms-bulk-actions">
            <AppButton
              class="alarms-bulk-actions__button alarms-bulk-actions__button--deactivate"
              variant="ghost"
              :loading="alarmsStore.isBulkActionPending('deactivate-all')"
              @click="requestBulkAction('deactivate-all')"
            >
              Деактивувати всі
            </AppButton>
            <AppButton
              class="alarms-bulk-actions__button alarms-bulk-actions__button--activate"
              variant="ghost"
              :loading="alarmsStore.isBulkActionPending('activate-all')"
              @click="requestBulkAction('activate-all')"
            >
              Активувати всі
            </AppButton>
          </div>
        </div>

        <div class="alarms-table-card__controls">
          <label class="alarms-filter">
            <span>Статус</span>
            <select
              v-model="filterForm.status"
              class="alarms-filter__select"
            >
              <option
                v-for="option in statusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="alarms-filter alarms-filter--building">
            <span>Будівля</span>
            <select
              v-model="filterForm.building"
              class="alarms-filter__select"
            >
              <option value="">Всі будівлі</option>
              <option
                v-for="building in alarmBuildingOptions"
                :key="building"
                :value="building"
              >
                {{ building }}
              </option>
            </select>
          </label>

          <label class="alarms-filter alarms-filter--compact">
            <span>Поверх</span>
            <input
              v-model="filterForm.floor"
              class="alarms-filter__input"
              type="number"
              placeholder="3"
            >
          </label>

          <AppButton
            v-if="hasActiveFilter"
            class="alarms-filter__button"
            variant="ghost"
            @click="resetFilters"
          >
            Скинути
          </AppButton>
        </div>
      </div>

      <AppAlert
        v-if="alarmsStore.listError || alarmsStore.actionError"
        title="Потрібна увага"
        :message="alarmsStore.listError || alarmsStore.actionError"
        tone="warning"
      >
        <AppButton @click="loadPage">
          Повторити
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!alarmsStore.listLoading && !alarmsStore.alarms.length"
        :title="emptyStateTitle"
      >
        <RouterLink
          v-if="!hasActiveFilter"
          to="/alarms/new"
        >
          <AppButton>Створити сигналізацію</AppButton>
        </RouterLink>
        <AppButton
          v-else
          variant="ghost"
          @click="resetFilters"
        >
          Скинути фільтри
        </AppButton>
      </AppEmptyState>

      <div
        v-else
        class="alarms-table-shell"
      >
        <table class="alarms-table">
          <thead>
            <tr>
              <th>Сигналізація</th>
              <th>Сенсор</th>
              <th>Локація</th>
              <th>Статус</th>
              <th>Активовано</th>
              <th>Оновлено</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="alarm in alarmsStore.alarms"
              :key="alarm.id"
            >
              <td>
                <strong class="alarms-table__title">Сигналізація #{{ alarm.id }}</strong>
              </td>
              <td>
                <span class="alarms-table__primary">#S-{{ alarm.sensorId }}</span>
                <span class="alarms-table__secondary">{{ sensorLocation(alarm.sensorId) }}</span>
              </td>
              <td>
                <span class="alarms-table__primary">{{ alarmPrimaryLocation(alarm) }}</span>
                <span class="alarms-table__secondary">{{ alarmSecondaryLocation(alarm) }}</span>
              </td>
              <td>
                <span
                  class="alarm-status"
                  :class="`alarm-status--${alarm.status}`"
                >
                  {{ alarmStatusLabel(alarm.status) }}
                </span>
              </td>
              <td>
                <AppBadge
                  v-if="!alarm.activatedAt"
                  tone="neutral"
                >
                  Не активовано
                </AppBadge>
                <span
                  v-else
                  class="alarms-table__date"
                >
                  {{ formatDateTime(alarm.activatedAt) }}
                </span>
              </td>
              <td>
                <span class="alarms-table__date">{{ formatDateTime(alarm.updatedAt) }}</span>
              </td>
              <td>
                <div class="alarm-actions">
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger as-child>
                      <button
                        class="alarm-actions__trigger"
                        type="button"
                        aria-label="Відкрити дії сигналізації"
                      >
                        ...
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuPortal>
                      <DropdownMenuContent
                        class="alarm-actions__menu"
                        side="bottom"
                        align="end"
                        :side-offset="10"
                        :collision-padding="16"
                        :loop="true"
                      >
                        <DropdownMenuItem as-child>
                          <RouterLink
                            class="alarm-actions__item"
                            :to="`/alarms/${alarm.id}`"
                          >
                            Деталі
                          </RouterLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="alarm-actions__item"
                          :disabled="alarmsStore.isActionPending(alarm.id, alarm.status === 'active' ? 'deactivate' : 'activate')"
                          @select="requestToggleAlarm(alarm)"
                        >
                          {{ alarm.status === 'active' ? 'Деактивувати' : 'Активувати' }}
                        </DropdownMenuItem>
                        <DropdownMenuItem as-child>
                          <RouterLink
                            class="alarm-actions__item"
                            :to="`/alarms/${alarm.id}`"
                          >
                            Редагувати
                          </RouterLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="alarm-actions__item alarm-actions__delete"
                          :disabled="alarmsStore.isActionPending(alarm.id, 'delete')"
                          @select="requestRemoveAlarm(alarm.id)"
                        >
                          Видалити
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenuRoot>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal
      :open="alarmPendingAction !== null"
      :title="alarmActionCopy.title"
      :description="alarmActionCopy.description"
      @close="closeActionModal"
    >
      <p class="ui-card__detail">
        {{ alarmPendingActionItem ? formatSensorLocation(alarmPendingActionItem.building, alarmPendingActionItem.floor, alarmPendingActionItem.location) : `Сигналізація #${alarmPendingAction?.alarmId}` }}
      </p>

      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="closeActionModal"
        >
          Скасувати
        </AppButton>
        <AppButton
          :variant="alarmActionCopy.variant"
          :loading="alarmPendingAction !== null && alarmsStore.isActionPending(alarmPendingAction.alarmId, alarmActionCopy.loadingType)"
          @click="confirmAlarmAction"
        >
          {{ alarmActionCopy.confirm }}
        </AppButton>
      </div>
    </AppModal>

    <AppModal
      :open="pendingBulkAction !== null"
      :title="bulkActionCopy.title"
      :description="bulkActionCopy.description"
      @close="closeBulkActionModal"
    >
      <p class="ui-card__detail">
        Дія буде застосована до всього списку сигналізацій.
      </p>

      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="closeBulkActionModal"
        >
          Скасувати
        </AppButton>
        <AppButton
          :variant="bulkActionCopy.variant"
          :loading="pendingBulkAction !== null && alarmsStore.isBulkActionPending(pendingBulkAction)"
          @click="pendingBulkAction === 'activate-all' ? activateAll() : deactivateAll()"
        >
          {{ bulkActionCopy.confirm }}
        </AppButton>
      </div>
    </AppModal>

    <AppModal
      :open="alarmPendingDeleteId !== null"
      title="Видалити сигналізацію?"
      description="Чи впевнені, що хочете видалити цю сигналізацію? Цю дію не можна скасувати."
      @close="closeDeleteModal"
    >
      <p class="ui-card__detail">
        {{ alarmPendingDelete ? formatSensorLocation(alarmPendingDelete.building, alarmPendingDelete.floor, alarmPendingDelete.location) : `Сигналізація #${alarmPendingDeleteId}` }}
      </p>

      <div class="form-actions">
        <AppButton
          variant="ghost"
          @click="closeDeleteModal"
        >
          Скасувати
        </AppButton>
        <AppButton
          variant="danger"
          :loading="alarmPendingDeleteId !== null && alarmsStore.isActionPending(alarmPendingDeleteId, 'delete')"
          @click="confirmRemoveAlarm"
        >
          Так, видалити
        </AppButton>
      </div>
    </AppModal>
  </section>
</template>

<style scoped>
.alarms-page {
  display: grid;
  gap: 1.25rem;
}

.alarms-page__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.alarms-page__heading p {
  margin: 0;
  max-width: 620px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.alarms-page__add-button {
  min-height: 42px;
  border-color: #0f8b5f;
  background: #0f8b5f;
  box-shadow: none;
  white-space: nowrap;
}

.alarms-page__add-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.alarms-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.alarms-summary__card {
  display: grid;
  min-height: 112px;
  align-content: space-between;
  gap: 0.75rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid #e5e7eb;
  border-left-width: 4px;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
}

.alarms-summary__card--neutral {
  border-left-color: #9ca3af;
}

.alarms-summary__card--active {
  border-left-color: #ef4444;
  background: linear-gradient(180deg, #ffffff 0%, #fef2f2 100%);
}

.alarms-summary__card--inactive {
  border-left-color: #10b981;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%);
}

.alarms-summary__card span {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
}

.alarms-summary__card strong {
  color: #111827;
  font-size: 2.15rem;
  line-height: 1;
}

.alarms-table-card {
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.04);
}

.alarms-table-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid #e5e7eb;
}

.alarms-table-card__header h2 {
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.alarms-table-card__header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.alarms-table-card__intro {
  display: grid;
  gap: 0.75rem;
}

.alarms-table-card__controls {
  display: grid;
  grid-template-columns: 150px minmax(150px, 190px) 100px auto;
  align-items: end;
  justify-content: flex-end;
  gap: 0.6rem;
}

.alarms-bulk-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alarms-bulk-actions__button {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  box-shadow: none;
  font-size: 0.86rem;
  white-space: nowrap;
}

.alarms-bulk-actions__button--activate {
  border-color: #fecaca;
  background: #fff7f7;
  color: #dc2626;
}

.alarms-bulk-actions__button--deactivate {
  border-color: #bbf7d0;
  background: #f0fdf8;
  color: #0f8b5f;
}

.alarms-bulk-actions__button--activate:hover {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
}

.alarms-bulk-actions__button--deactivate:hover {
  border-color: #86efac;
  background: #dcfce7;
  color: #047857;
}

.alarms-filter {
  display: grid;
  gap: 0.35rem;
  color: #374151;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.alarms-filter--compact .alarms-filter__input {
  min-width: 0;
  width: 100%;
}

.alarms-filter__select,
.alarms-filter__input {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 0.8rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  color: #111827;
  font: inherit;
  font-weight: 600;
  text-transform: none;
}

.alarms-filter__select {
  padding-right: 2rem;
}

.alarms-filter__button {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  box-shadow: none;
}

.alarms-table-shell {
  overflow-x: auto;
  border-radius: 0 0 18px 18px;
}

.alarms-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

.alarms-table th,
.alarms-table td {
  height: 68px;
  padding: 0.85rem 1.2rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

.alarms-table th {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.alarms-table tbody tr:last-child td {
  border-bottom: 0;
}

.alarms-table td {
  color: #111827;
  font-size: 0.92rem;
  font-weight: 500;
}

.alarms-table__title {
  color: #111827;
  font-weight: 700;
  white-space: nowrap;
}

.alarms-table__primary,
.alarms-table__secondary {
  display: block;
}

.alarms-table__primary {
  color: #111827;
  font-weight: 600;
}

.alarms-table__secondary {
  margin-top: 0.2rem;
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 500;
}

.alarms-table__date {
  display: inline-block;
  min-width: max-content;
  color: #374151;
  white-space: nowrap;
}

.alarm-status {
  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 28px;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.alarm-status--active {
  background: #fee2e2;
  color: #dc2626;
}

.alarm-status--inactive {
  background: #d1fae5;
  color: #0f8b5f;
}

.alarm-actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.alarm-actions__trigger {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: #374151;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: none;
}

.alarm-actions__menu {
  z-index: 50;
  min-width: 170px;
  padding: 0.35rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.12);
}

.alarm-actions__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 0.6rem 0.8rem;
  border-radius: 9px;
  color: #111827;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  text-decoration: none;
  outline: none;
  cursor: pointer;
}

.alarm-actions__item:hover,
.alarm-actions__item[data-highlighted] {
  background: #f3f4f6;
  color: #111827;
}

.alarm-actions__item[data-disabled] {
  color: #9ca3af;
  pointer-events: none;
}

.alarm-actions__delete {
  color: #ef4444;
}

.alarm-actions__delete:hover,
.alarm-actions__delete[data-highlighted] {
  background: #fef2f2;
  color: #ef4444;
}

@media (max-width: 1180px) {
  .alarms-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .alarms-table-card__controls {
    grid-template-columns: minmax(140px, 1fr) minmax(160px, 1fr) minmax(100px, 0.6fr) auto;
    justify-content: stretch;
  }
}

@media (max-width: 860px) {
  .alarms-table-card__controls {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .alarms-filter__button {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .alarms-summary {
    grid-template-columns: 1fr;
  }

  .alarms-page__heading,
  .alarms-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .alarms-table-card__controls {
    grid-template-columns: 1fr 1fr;
  }

  .alarms-filter--building {
    grid-column: 1 / -1;
  }

  .alarms-bulk-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .alarms-filter__select {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .alarms-table-card__controls {
    grid-template-columns: 1fr;
  }
}
</style>
