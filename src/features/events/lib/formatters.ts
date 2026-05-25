import type { EventType } from '@/features/events/model/event.types';

export function formatEventType(eventType: EventType) {
  switch (eventType) {
    case 'smoke_detected':
      return 'Smoke detected';
    case 'smoke_cleared':
      return 'Smoke cleared';
    case 'alarm_activated':
      return 'Alarm activated';
    case 'alarm_deactivated':
      return 'Alarm deactivated';
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
