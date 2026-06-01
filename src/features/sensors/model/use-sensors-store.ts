import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { sensorsApi } from '@/features/sensors/api/sensors.api';
import { normalizeApiError } from '@/shared/api/normalize-api-error';
import type {
  CreateSensorPayload,
  CreatedSensorSuccessData,
  Sensor,
  SensorReading,
  SensorReadingRealtimeData,
  SensorFilters,
  SensorReadingsFilters,
  UpdateSensorPayload,
} from '@/features/sensors/model/sensor.types';

export const useSensorsStore = defineStore('sensors', () => {
  const sensors = ref<Sensor[]>([]);
  const currentSensor = ref<Sensor | null>(null);
  const tableReadings = ref<SensorReading[]>([]);
  const chartReadings = ref<SensorReading[]>([]);
  const latestReading = ref<SensorReading | null>(null);
  const lastChartFilters = ref<SensorReadingsFilters | null>(null);
  const lastChartWindowMs = ref<number | null>(null);
  const filters = ref<SensorFilters>({
    status: '',
    floor: null,
    building: '',
  });
  const listLoading = ref(false);
  const detailLoading = ref(false);
  const tableReadingsLoading = ref(false);
  const chartReadingsLoading = ref(false);
  const submitLoading = ref(false);
  const listError = ref('');
  const detailError = ref('');
  const tableReadingsError = ref('');
  const chartReadingsError = ref('');
  const submitError = ref('');
  const createdSensorSuccess = ref<CreatedSensorSuccessData | null>(null);
  const listRequestId = ref(0);

  const readings = computed(() => tableReadings.value);
  const readingsLoading = computed(() => tableReadingsLoading.value || chartReadingsLoading.value);
  const readingsError = computed(() => tableReadingsError.value || chartReadingsError.value);
  const sensorsCount = computed(() => sensors.value.length);
  const activeSensorsCount = computed(
    () => sensors.value.filter((sensor) => sensor.status === 'active').length,
  );

  async function fetchSensors(nextFilters?: SensorFilters) {
    const requestId = listRequestId.value + 1;
    listRequestId.value = requestId;
    listLoading.value = true;
    listError.value = '';

    try {
      if (nextFilters) {
        filters.value = nextFilters;
      }

      const nextSensors = await sensorsApi.getSensors(normalizeSensorFilters(filters.value));

      if (requestId === listRequestId.value) {
        sensors.value = nextSensors;
      }
    } catch (error) {
      if (requestId === listRequestId.value) {
        listError.value = normalizeApiError(error, 'Failed to load sensors.');
        throw error;
      }
    } finally {
      if (requestId === listRequestId.value) {
        listLoading.value = false;
      }
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
      sensors.value = [response.sensor, ...sensors.value];
      createdSensorSuccess.value = {
        sensorId: response.sensor.id,
        sensorCode: response.sensorCode,
      };
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

  async function fetchTableReadings(id: number, filters: SensorReadingsFilters) {
    tableReadingsLoading.value = true;
    tableReadingsError.value = '';

    try {
      tableReadings.value = await sensorsApi.getSensorReadings(id, filters);
      latestReading.value = tableReadings.value[0] ?? latestReading.value;
      return tableReadings.value;
    } catch (error) {
      tableReadingsError.value = normalizeApiError(error, 'Failed to load sensor readings.');
      throw error;
    } finally {
      tableReadingsLoading.value = false;
    }
  }

  async function appendTableReadings(id: number, filters: SensorReadingsFilters) {
    tableReadingsLoading.value = true;
    tableReadingsError.value = '';

    try {
      const nextReadings = await sensorsApi.getSensorReadings(id, filters);
      const existingReadingIds = new Set(tableReadings.value.map((reading) => reading.id));
      const uniqueNextReadings = nextReadings.filter((reading) => !existingReadingIds.has(reading.id));

      tableReadings.value = [...tableReadings.value, ...uniqueNextReadings];

      return nextReadings;
    } catch (error) {
      tableReadingsError.value = normalizeApiError(error, 'Failed to load sensor readings.');
      throw error;
    } finally {
      tableReadingsLoading.value = false;
    }
  }

  async function fetchChartReadings(id: number, filters: SensorReadingsFilters) {
    chartReadingsLoading.value = true;
    chartReadingsError.value = '';
    lastChartFilters.value = filters;
    lastChartWindowMs.value = resolveChartWindowMs(filters);

    try {
      chartReadings.value = await sensorsApi.getSensorReadings(id, filters);
      chartReadings.value = filterReadingsByRange(chartReadings.value, filters);
      latestReading.value = latestReading.value ?? chartReadings.value[0] ?? null;
      return chartReadings.value;
    } catch (error) {
      chartReadingsError.value = normalizeApiError(error, 'Failed to load sensor chart readings.');
      throw error;
    } finally {
      chartReadingsLoading.value = false;
    }
  }

  const fetchReadings = fetchTableReadings;
  const appendReadings = appendTableReadings;

  function clearCreatedSensorSuccess() {
    createdSensorSuccess.value = null;
  }

  function setCreatedSensorSuccess(payload: CreatedSensorSuccessData | null) {
    createdSensorSuccess.value = payload;
  }

  function updateSensorFromRealtime(payload: {
    sensorId: number;
    status?: Sensor['status'];
    timestamp?: string;
    building?: string | null;
    floor?: number | null;
    location?: string;
  }) {
    const patchSensor = (sensor: Sensor): Sensor => ({
      ...sensor,
      status: payload.status ?? sensor.status,
      lastCheckedAt: payload.timestamp ?? sensor.lastCheckedAt,
      updatedAt: payload.timestamp ?? sensor.updatedAt,
      building: payload.building ?? sensor.building,
      floor: payload.floor ?? sensor.floor,
      location: payload.location ?? sensor.location,
    });

    sensors.value = sensors.value
      .map((sensor) => (sensor.id === payload.sensorId ? patchSensor(sensor) : sensor))
      .filter((sensor) => sensor.id !== payload.sensorId || sensorMatchesFilters(sensor, filters.value));

    if (currentSensor.value?.id === payload.sensorId) {
      currentSensor.value = patchSensor(currentSensor.value);
    }
  }

  function prependReadingFromRealtime(payload: SensorReadingRealtimeData) {
    if (String(currentSensor.value?.id) !== String(payload.sensorId)) {
      return;
    }

    const hasReadingValues =
      payload.id !== undefined ||
      payload.smokeDetected !== undefined ||
      payload.smokeLevel !== undefined ||
      payload.temperature !== undefined ||
      payload.humidity !== undefined;

    if (!hasReadingValues) {
      return;
    }

    const timestamp = payload.timestamp ?? new Date().toISOString();
    const reading: SensorReading = {
      id: payload.id ?? -new Date(timestamp).getTime(),
      sensorId: payload.sensorId,
      smokeDetected: payload.smokeDetected ?? false,
      smokeLevel: payload.smokeLevel ?? null,
      temperature: payload.temperature ?? null,
      humidity: payload.humidity ?? null,
      timestamp,
      createdAt: payload.createdAt ?? timestamp,
    };

    logRealtimeReading('incoming', reading);
    logRealtimeReading('current sensor id', currentSensor.value?.id);
    logRealtimeReading('active range', lastChartFilters.value);
    logRealtimeReading('before count', chartReadings.value.length);

    latestReading.value = reading;

    if (!tableReadings.value.some((item) => item.id === reading.id)) {
      tableReadings.value = [reading, ...tableReadings.value];
    }

    const rollingChartFilters = buildRollingChartFilters(reading, lastChartFilters.value, lastChartWindowMs.value);

    if (shouldIncludeReadingInChart(reading, rollingChartFilters)) {
      lastChartFilters.value = rollingChartFilters;
      chartReadings.value = dedupeReadingsById([reading, ...chartReadings.value])
        .filter((item) => shouldIncludeReadingInChart(item, rollingChartFilters))
        .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime());
    }

    logRealtimeReading('rolling range', rollingChartFilters);
    logRealtimeReading('after count', chartReadings.value.length);
    logRealtimeReading('latest chart reading', chartReadings.value[0] ?? null);
  }

  return {
    activeSensorsCount,
    clearCreatedSensorSuccess,
    currentSensor,
    createdSensorSuccess,
    detailLoading,
    detailError,
    filters,
    chartReadings,
    chartReadingsError,
    chartReadingsLoading,
    latestReading,
    listError,
    listLoading,
    readings,
    readingsError,
    readingsLoading,
    sensors,
    sensorsCount,
    setCreatedSensorSuccess,
    submitError,
    submitLoading,
    tableReadings,
    tableReadingsError,
    tableReadingsLoading,
    appendReadings,
    appendTableReadings,
    createSensor,
    deleteSensor,
    fetchChartReadings,
    fetchReadings,
    fetchSensor,
    fetchSensors,
    fetchTableReadings,
    updateSensor,
    updateSensorFromRealtime,
    prependReadingFromRealtime,
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

function sensorMatchesFilters(sensor: Sensor, filters: SensorFilters) {
  if (filters.status && sensor.status !== filters.status) {
    return false;
  }

  if (
    typeof filters.floor === 'number' &&
    !Number.isNaN(filters.floor) &&
    sensor.floor !== filters.floor
  ) {
    return false;
  }

  if (filters.building?.trim() && sensor.building !== filters.building.trim()) {
    return false;
  }

  return true;
}

function shouldIncludeReadingInChart(reading: SensorReading, filters: SensorReadingsFilters | null) {
  if (!filters) {
    return true;
  }

  const timestamp = new Date(reading.timestamp).getTime();

  if (filters.startDate && timestamp < new Date(filters.startDate).getTime()) {
    return false;
  }

  if (filters.endDate && timestamp > new Date(filters.endDate).getTime()) {
    return false;
  }

  return true;
}

function filterReadingsByRange(readings: SensorReading[], filters: SensorReadingsFilters) {
  return readings.filter((reading) => shouldIncludeReadingInChart(reading, filters));
}

function resolveChartWindowMs(filters: SensorReadingsFilters) {
  if (!filters.startDate || !filters.endDate) {
    return null;
  }

  const startTime = new Date(filters.startDate).getTime();
  const endTime = new Date(filters.endDate).getTime();
  const windowMs = endTime - startTime;

  return Number.isFinite(windowMs) && windowMs > 0 ? windowMs : null;
}

function buildRollingChartFilters(
  reading: SensorReading,
  filters: SensorReadingsFilters | null,
  windowMs: number | null,
) {
  if (!filters || !windowMs) {
    return filters;
  }

  const rangeEnd = new Date(Math.max(Date.now(), new Date(reading.timestamp).getTime()));
  const rangeStart = new Date(rangeEnd.getTime() - windowMs);

  return {
    ...filters,
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  };
}

function dedupeReadingsById(readings: SensorReading[]) {
  const seenReadingKeys = new Set<string>();

  return readings.filter((reading) => {
    const key = reading.id !== undefined ? `id:${reading.id}` : `time:${reading.timestamp}`;

    if (seenReadingKeys.has(key)) {
      return false;
    }

    seenReadingKeys.add(key);
    return true;
  });
}

function logRealtimeReading(label: string, value: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.log(`[reading realtime] ${label}`, value);
}
