import type { SensorReading } from '@/features/sensors/model/sensor.types';

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

export function buildLineChartPoints(
  readings: SensorReading[],
  selector: (_reading: SensorReading) => number | null,
) {
  const reversed = [...readings].reverse();
  const series = reversed
    .map((reading) => {
      const value = selector(reading);

      if (value === null || Number.isNaN(value)) {
        return null;
      }

      return {
        reading,
        value: Number(value),
      };
    })
    .filter((item): item is { reading: SensorReading; value: number } => item !== null);

  if (!series.length) {
    return {
      points: [] as ChartPoint[],
      min: 0,
      max: 0,
      polyline: '',
    };
  }

  const values = series.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = series.map((item, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
    const y = 100 - ((item.value - min) / range) * 100;

    return {
      x,
      y,
      value: item.value,
      label: new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(item.reading.timestamp)),
    };
  });

  return {
    points,
    min,
    max,
    polyline: points.map((point) => `${point.x},${point.y}`).join(' '),
  };
}
