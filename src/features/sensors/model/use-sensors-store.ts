import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { sensorsApi } from '@/features/sensors/api/sensors.api';
import { normalizeApiError } from '@/shared/api/normalize-api-error';
import type {
  CreateSensorPayload,
  CreateSensorResponse,
  Sensor,
  SensorReading,
  SensorFilters,
  SensorReadingsFilters,
  UpdateSensorPayload,
} from '@/features/sensors/model/sensor.types';

export const useSensorsStore = defineStore('sensors', () => {
  const sensors = ref<Sensor[]>([]);
  const currentSensor = ref<Sensor | null>(null);
  const readings = ref<SensorReading[]>([]);
  const filters = ref<SensorFilters>({
    status: '',
    floor: null,
    building: '',
  });
  const listLoading = ref(false);
  const detailLoading = ref(false);
  const readingsLoading = ref(false);
  const submitLoading = ref(false);
  const listError = ref('');
  const detailError = ref('');
  const readingsError = ref('');
  const submitError = ref('');
  const lastCreatedSensor = ref<CreateSensorResponse | null>(null);

  const sensorsCount = computed(() => sensors.value.length);
  const activeSensorsCount = computed(
    () => sensors.value.filter((sensor) => sensor.status === 'active').length,
  );

  async function fetchSensors(nextFilters?: SensorFilters) {
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = nextFilters;
      }

      sensors.value = await sensorsApi.getSensors(normalizeSensorFilters(filters.value));
    } catch (error) {
      listError.value = normalizeApiError(error, 'Failed to load sensors.');
      throw error;
    } finally {
      listLoading.value = false;
    }
  }

  async function fetchSensor(id: number) {
    detailLoading.value = true;
    detailError.value = '';

    try {
      currentSensor.value = await sensorsApi.getSensor(id);
    } catch (error) {
      detailError.value = normalizeApiError(error, 'Failed to load sensor details.');
      throw error;
    } finally {
      detailLoading.value = false;
    }
  }

  async function createSensor(payload: CreateSensorPayload) {
    submitLoading.value = true;
    submitError.value = '';

    try {
      const response = await sensorsApi.createSensor(payload);
      lastCreatedSensor.value = response;
      sensors.value = [response.sensor, ...sensors.value];
      return response;
    } catch (error) {
      submitError.value = normalizeApiError(error, 'Failed to create sensor.');
      throw error;
    } finally {
      submitLoading.value = false;
    }
  }

  async function updateSensor(id: number, payload: UpdateSensorPayload) {
    submitLoading.value = true;
    submitError.value = '';

    try {
      const updated = await sensorsApi.updateSensor(id, payload);
      currentSensor.value = updated;
      sensors.value = sensors.value.map((sensor) => (sensor.id === id ? updated : sensor));
      return updated;
    } catch (error) {
      submitError.value = normalizeApiError(error, 'Failed to update sensor.');
      throw error;
    } finally {
      submitLoading.value = false;
    }
  }

  async function deleteSensor(id: number) {
    submitLoading.value = true;
    submitError.value = '';

    try {
      await sensorsApi.deleteSensor(id);
      sensors.value = sensors.value.filter((sensor) => sensor.id !== id);
      if (currentSensor.value?.id === id) {
        currentSensor.value = null;
      }
    } catch (error) {
      submitError.value = normalizeApiError(error, 'Failed to delete sensor.');
      throw error;
    } finally {
      submitLoading.value = false;
    }
  }

  async function fetchReadings(id: number, filters: SensorReadingsFilters) {
    readingsLoading.value = true;
    readingsError.value = '';

    try {
      readings.value = await sensorsApi.getSensorReadings(id, filters);
    } catch (error) {
      readingsError.value = normalizeApiError(error, 'Failed to load sensor readings.');
      throw error;
    } finally {
      readingsLoading.value = false;
    }
  }

  function clearLastCreatedSensor() {
    lastCreatedSensor.value = null;
  }

  function setLastCreatedSensor(payload: CreateSensorResponse | null) {
    lastCreatedSensor.value = payload;
  }

  return {
    activeSensorsCount,
    currentSensor,
    detailLoading,
    detailError,
    filters,
    lastCreatedSensor,
    listError,
    listLoading,
    readings,
    readingsError,
    readingsLoading,
    sensors,
    sensorsCount,
    submitError,
    submitLoading,
    clearLastCreatedSensor,
    createSensor,
    deleteSensor,
    fetchReadings,
    fetchSensor,
    fetchSensors,
    setLastCreatedSensor,
    updateSensor,
  };
});

function normalizeSensorFilters(filters: SensorFilters) {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(typeof filters.floor === 'number' && !Number.isNaN(filters.floor)
      ? { floor: filters.floor }
      : {}),
    ...(filters.building?.trim() ? { building: filters.building.trim() } : {}),
  };
}
