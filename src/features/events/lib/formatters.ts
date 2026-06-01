import type { EventType } from '@/features/events/model/event.types';

export function formatEventType(eventType: EventType) {
  switch (eventType) {
    case 'smoke_detected':
      return 'Виявлено дим';
    case 'smoke_cleared':
      return 'Дим зник';
    case 'alarm_activated':
      return 'Сигналізація активована';
    case 'alarm_deactivated':
      return 'Сигналізація деактивована';
  }
}

export function getEventTone(eventType: EventType) {
  switch (eventType) {
    case 'smoke_detected':
    case 'alarm_activated':
      return 'danger';
    case 'smoke_cleared':
      return 'success';
    case 'alarm_deactivated':
      return 'warning';
  }
}
