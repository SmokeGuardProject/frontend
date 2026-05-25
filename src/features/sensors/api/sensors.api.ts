import { apiClient } from '@/shared/api/client';
import type {
  CreateSensorPayload,
  CreateSensorResponse,
  Sensor,
  SensorFilters,
  SensorReading,
  SensorReadingsFilters,
  UpdateSensorPayload,
} from '@/features/sensors/model/sensor.types';

export const sensorsApi = {
  async getSensors(filters: SensorFilters = {}) {
    const { data } = await apiClient.get<Sensor[]>('/sensors', {
      params: filters,
    });
    return data;
  },

  async getSensor(id: number) {
    const { data } = await apiClient.get<Sensor>(`/sensors/${id}`);
    return data;
  },

  async createSensor(payload: CreateSensorPayload) {
    const { data } = await apiClient.post<CreateSensorResponse>('/sensors', payload);
    return data;
  },

  async updateSensor(id: number, payload: UpdateSensorPayload) {
    const { data } = await apiClient.patch<Sensor>(`/sensors/${id}`, payload);
    return data;
  },

  async deleteSensor(id: number) {
    await apiClient.delete(`/sensors/${id}`);
  },

  async getSensorReadings(id: number, filters: SensorReadingsFilters) {
    const { data } = await apiClient.get<SensorReading[]>(`/sensors/${id}/readings`, {
      params: filters,
    });
    return data;
  },
};
