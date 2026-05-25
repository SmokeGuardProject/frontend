import type { AlarmStatus } from '@/features/alarms/model/alarm.types';

export function formatAlarmStatus(status: AlarmStatus) {
  return status === 'active' ? 'Active' : 'Inactive';
}

export function getAlarmTone(status: AlarmStatus) {
  return status === 'active' ? 'danger' : 'success';
}
