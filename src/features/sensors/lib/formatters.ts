export function formatDateTime(value: string | null) {
  if (!value) {
    return 'No signal';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatSensorLocation(building: string | null, floor: number | null, location: string) {
  const parts = [building, floor !== null ? `Floor ${floor}` : null, location].filter(Boolean);
  return parts.join(' / ');
}

export function formatMetric(value: number | null, unit: string) {
  if (value === null || Number.isNaN(value)) {
    return 'No data';
  }

  return `${Number(value).toFixed(1)} ${unit}`;
}
