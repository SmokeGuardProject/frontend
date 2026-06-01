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
import AppBadge from '@/shared/ui/AppBadge.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppEmptyState from '@/shared/ui/AppEmptyState.vue';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppModal from '@/shared/ui/AppModal.vue';
import { sensorsApi } from '@/features/sensors/api/sensors.api';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import type { Sensor } from '@/features/sensors/model/sensor.types';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';
import { showToast } from '@/shared/ui/use-toast';

const sensorsStore = useSensorsStore();
const sensorStats = ref<Sensor[]>([]);
const isResettingFilters = ref(false);
const sensorPendingDeleteId = ref<number | null>(null);
let floorFilterTimerId: number | null = null;

const filterForm = reactive({
  status: '',
  floor: '',
  building: '',
});

const statusOptions = [
  { label: 'Всі статуси', value: '' },
  { label: 'Активні', value: 'active' },
  { label: 'Неактивні', value: 'inactive' },
];

const summaryCards = computed(() => [
  {
    label: 'Всього сенсорів',
    value: sensorStats.value.length,
    tone: 'neutral',
  },
  {
    label: 'Активні',
    value: sensorStats.value.filter((sensor) => sensor.status === 'active').length,
    tone: 'active',
  },
  {
    label: 'Неактивні',
    value: sensorStats.value.filter((sensor) => sensor.status === 'inactive').length,
    tone: 'inactive',
  },
]);
const hasActiveFilter = computed(() => Boolean(filterForm.status || filterForm.floor || filterForm.building.trim()));
const sensorBuildingOptions = computed(() =>
  Array.from(
    new Set(
      sensorStats.value
        .map((sensor) => sensor.building)
        .filter((building): building is string => Boolean(building?.trim())),
    ),
  ).sort((first, second) => first.localeCompare(second, 'uk')),
);
const emptyStateTitle = computed(() =>
  hasActiveFilter.value ? 'За вибраними фільтрами сенсорів не знайдено.' : 'Сенсори ще не додані',
);
const sensorPendingDelete = computed(() =>
  sensorsStore.sensors.find((sensor) => sensor.id === sensorPendingDeleteId.value) ?? null,
);

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

async function applyFilters() {
  await sensorsStore.fetchSensors({
    status: filterForm.status as 'active' | 'inactive' | '',
    floor: normalizeOptionalNumber(filterForm.floor),
    building: normalizeText(filterForm.building),
  });
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

async function refreshSensorStats() {
  sensorStats.value = await sensorsApi.getSensors();
}

async function loadPage() {
  await Promise.all([refreshSensorStats(), applyFilters()]);
}

function requestRemoveSensor(sensorId: number) {
  sensorPendingDeleteId.value = sensorId;
}

function closeDeleteModal() {
  if (sensorsStore.submitLoading) {
    return;
  }

  sensorPendingDeleteId.value = null;
}

async function confirmRemoveSensor() {
  const sensorId = sensorPendingDeleteId.value;

  if (sensorId === null) {
    return;
  }

  try {
    await sensorsStore.deleteSensor(sensorId);
    await refreshSensorStats();
    sensorPendingDeleteId.value = null;
    showToast({
      title: 'Сенсор видалено',
      message: `Сенсор #${sensorId} успішно видалено.`,
      tone: 'success',
    });
  } catch {
    showToast({
      title: 'Не вдалося видалити сенсор',
      message: 'Спробуйте повторити дію пізніше.',
      tone: 'danger',
    });
  }
}

function sensorStatusLabel(status: string) {
  return status === 'active' ? 'Активний' : 'Неактивний';
}

function isMissingSignal(value: string | null) {
  return !value;
}

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

onMounted(async () => {
  await loadPage();
});

onUnmounted(() => {
  if (floorFilterTimerId !== null) {
    window.clearTimeout(floorFilterTimerId);
  }
});
</script>

<template>
  <section class="sensors-page">
    <div class="sensors-page__heading">
      <p>Переглядайте стан сенсорів та фільтруйте їх за статусом або розташуванням.</p>

      <RouterLink to="/sensors/new">
        <AppButton class="sensors-page__add-button">
          <span
            class="sensors-page__add-icon"
            aria-hidden="true"
          >
            +
          </span>
          Додати сенсор
        </AppButton>
      </RouterLink>
    </div>

    <div class="sensors-summary">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="sensors-summary__card"
        :class="`sensors-summary__card--${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <section class="sensors-table-card">
      <div class="sensors-table-card__header">
        <div>
          <h2>Список сенсорів</h2>
          <p>Стан сенсорів і їхнє розташування.</p>
        </div>

        <div class="sensors-table-card__controls">
          <label class="sensors-filter">
            <span>Статус</span>
            <select
              v-model="filterForm.status"
              class="sensors-filter__select"
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

          <label class="sensors-filter sensors-filter--building">
            <span>Будівля</span>
            <select
              v-model="filterForm.building"
              class="sensors-filter__select"
            >
              <option value="">Всі будівлі</option>
              <option
                v-for="building in sensorBuildingOptions"
                :key="building"
                :value="building"
              >
                {{ building }}
              </option>
            </select>
          </label>

          <label class="sensors-filter sensors-filter--compact">
            <span>Поверх</span>
            <input
              v-model="filterForm.floor"
              class="sensors-filter__input"
              type="number"
              placeholder="3"
            >
          </label>

          <AppButton
            v-if="hasActiveFilter"
            class="sensors-filter__button"
            variant="ghost"
            @click="resetFilters"
          >
            Скинути
          </AppButton>
        </div>
      </div>

      <AppAlert
        v-if="sensorsStore.listError || sensorsStore.submitError"
        title="Потрібна увага"
        :message="sensorsStore.listError || sensorsStore.submitError"
        tone="warning"
      >
        <AppButton @click="loadPage">
          Повторити
        </AppButton>
      </AppAlert>

      <AppEmptyState
        v-if="!sensorsStore.listLoading && !sensorsStore.sensors.length"
        :title="emptyStateTitle"
      >
        <RouterLink
          v-if="!hasActiveFilter"
          to="/sensors/new"
        >
          <AppButton>Створити сенсор</AppButton>
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
        class="sensors-table-shell"
      >
        <table class="sensors-table">
          <thead>
            <tr>
              <th>Сенсор</th>
              <th>Локація</th>
              <th>Статус</th>
              <th>Останній сигнал</th>
              <th>Оновлено</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sensor in sensorsStore.sensors"
              :key="sensor.id"
            >
              <td>
                <strong class="sensors-table__title">Сенсор #{{ sensor.id }}</strong>
              </td>
              <td>
                <span class="sensors-table__primary">{{ sensor.building || sensor.location }}</span>
                <span class="sensors-table__secondary">{{ formatSensorLocation(sensor.building, sensor.floor, sensor.location) }}</span>
              </td>
              <td>
                <span
                  class="sensor-status"
                  :class="`sensor-status--${sensor.status}`"
                >
                  {{ sensorStatusLabel(sensor.status) }}
                </span>
              </td>
              <td>
                <AppBadge
                  v-if="isMissingSignal(sensor.lastCheckedAt)"
                  tone="neutral"
                >
                  Немає сигналу
                </AppBadge>
                <span
                  v-else
                  class="sensors-table__date"
                >
                  {{ formatDateTime(sensor.lastCheckedAt) }}
                </span>
              </td>
              <td>
                <span class="sensors-table__date">{{ formatDateTime(sensor.updatedAt) }}</span>
              </td>
              <td>
                <div class="sensor-actions">
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger as-child>
                      <button
                        class="sensor-actions__trigger"
                        type="button"
                        aria-label="Відкрити дії сенсора"
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
                            :to="`/sensors/${sensor.id}`"
                          >
                            Деталі
                          </RouterLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem as-child>
                          <RouterLink
                            class="alarm-actions__item"
                            :to="`/sensors/${sensor.id}`"
                          >
                            Редагувати
                          </RouterLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          class="alarm-actions__item alarm-actions__delete"
                          :disabled="sensorsStore.submitLoading"
                          @select="requestRemoveSensor(sensor.id)"
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
      :open="sensorPendingDeleteId !== null"
      title="Видалити сенсор?"
      description="Чи впевнені, що хочете видалити цей сенсор? Цю дію не можна скасувати."
      @close="closeDeleteModal"
    >
      <p class="ui-card__detail">
        {{ sensorPendingDelete ? formatSensorLocation(sensorPendingDelete.building, sensorPendingDelete.floor, sensorPendingDelete.location) : `Сенсор #${sensorPendingDeleteId}` }}
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
          :loading="sensorsStore.submitLoading"
          @click="confirmRemoveSensor"
        >
          Так, видалити
        </AppButton>
      </div>
    </AppModal>
  </section>
</template>

<style scoped>
.sensors-page {
  display: grid;
  gap: 1.25rem;
}

.sensors-page__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.sensors-page__heading p {
  margin: 0;
  max-width: 620px;
  color: #6b7280;
  font-size: 0.96rem;
  line-height: 1.55;
}

.sensors-page__add-button {
  min-height: 42px;
  border-color: #0f8b5f;
  background: #0f8b5f;
  box-shadow: none;
  white-space: nowrap;
}

.sensors-page__add-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.sensors-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.sensors-summary__card {
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

.sensors-summary__card--neutral {
  border-left-color: #9ca3af;
}

.sensors-summary__card--active {
  border-left-color: #10b981;
  background: linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%);
}

.sensors-summary__card--inactive {
  border-left-color: #d1d5db;
  background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
}

.sensors-summary__card span {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
}

.sensors-summary__card strong {
  color: #111827;
  font-size: 2.15rem;
  line-height: 1;
}

.sensors-table-card {
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.04);
}

.sensors-table-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid #e5e7eb;
}

.sensors-table-card__header h2 {
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.sensors-table-card__header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.sensors-table-card__controls {
  display: grid;
  grid-template-columns: 150px minmax(150px, 190px) 100px auto;
  align-items: end;
  justify-content: flex-end;
  gap: 0.6rem;
}

.sensors-filter {
  display: grid;
  gap: 0.35rem;
  color: #374151;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.sensors-filter--compact .sensors-filter__input {
  min-width: 0;
  width: 100%;
}

.sensors-filter__select,
.sensors-filter__input {
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

.sensors-filter__select {
  padding-right: 2rem;
}

.sensors-filter__button {
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  box-shadow: none;
}

.sensors-table-shell {
  overflow-x: auto;
  border-radius: 0 0 18px 18px;
}

.sensors-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.sensors-table th,
.sensors-table td {
  height: 68px;
  padding: 0.85rem 1.2rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

.sensors-table th {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.sensors-table tbody tr:last-child td {
  border-bottom: 0;
}

.sensors-table td {
  color: #111827;
  font-size: 0.92rem;
  font-weight: 500;
}

.sensors-table__title {
  color: #111827;
  font-weight: 700;
  white-space: nowrap;
}

.sensors-table__primary,
.sensors-table__secondary {
  display: block;
}

.sensors-table__primary {
  color: #111827;
  font-weight: 600;
}

.sensors-table__secondary {
  margin-top: 0.2rem;
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 500;
}

.sensors-table__date {
  display: inline-block;
  min-width: max-content;
  color: #374151;
  white-space: nowrap;
}

.sensor-status {
  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 28px;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.sensor-status--active {
  background: #d1fae5;
  color: #0f8b5f;
}

.sensor-status--inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.sensor-actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.sensor-actions__trigger {
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

.sensor-actions__menu {
  z-index: 50;
  min-width: 170px;
  padding: 0.35rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(17, 24, 39, 0.12);
}

.sensor-actions__item {
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

.sensor-actions__item:hover,
.sensor-actions__item[data-highlighted] {
  background: #f3f4f6;
  color: #111827;
}

.sensor-actions__item[data-disabled] {
  color: #9ca3af;
  pointer-events: none;
}

.sensor-actions__delete {
  color: #ef4444;
}

.sensor-actions__delete:hover,
.sensor-actions__delete[data-highlighted] {
  background: #fef2f2;
  color: #ef4444;
}

@media (max-width: 1180px) {
  .sensors-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .sensors-table-card__controls {
    grid-template-columns: minmax(140px, 1fr) minmax(160px, 1fr) minmax(100px, 0.6fr) auto;
    justify-content: stretch;
  }
}

@media (max-width: 860px) {
  .sensors-table-card__controls {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .sensors-filter__button {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .sensors-summary {
    grid-template-columns: 1fr;
  }

  .sensors-page__heading,
  .sensors-table-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .sensors-table-card__controls {
    grid-template-columns: 1fr 1fr;
  }

  .sensors-filter--building {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .sensors-table-card__controls {
    grid-template-columns: 1fr;
  }
}
</style>
