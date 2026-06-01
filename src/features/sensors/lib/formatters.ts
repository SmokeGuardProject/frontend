export function formatDateTime(value: string | null) {
  if (!value) {
    return 'Немає сигналу';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatSensorLocation(building: string | null, floor: number | null, location: string) {
  const parts = [building, floor !== null ? `Поверх ${floor}` : null, location].filter(Boolean);
  return parts.join(' / ');
}

export function formatMetric(value: number | null, unit: string) {
  if (value === null || Number.isNaN(value)) {
    return 'Немає даних';
  }

  return `${Number(value).toFixed(1)} ${unit}`;
}
