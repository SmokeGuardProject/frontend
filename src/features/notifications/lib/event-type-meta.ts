export type NotificationEventSeverity = 'neutral' | 'success' | 'warning' | 'danger';
export type NotificationEventIcon = 'flame' | 'check' | 'bell' | 'bell-off' | 'alert';

export interface NotificationEventMeta {
  label: string;
  severity: NotificationEventSeverity;
  icon: NotificationEventIcon;
}

export function getNotificationEventMeta(eventType?: string | null): NotificationEventMeta {
  switch (eventType) {
    case 'smoke_detected':
      return {
        label: 'Виявлено дим',
        severity: 'danger',
        icon: 'flame',
      };
    case 'smoke_cleared':
      return {
        label: 'Дим зник',
        severity: 'success',
        icon: 'check',
      };
    case 'alarm_activated':
      return {
        label: 'Сигналізація активована',
        severity: 'danger',
        icon: 'bell',
      };
    case 'alarm_deactivated':
      return {
        label: 'Сигналізація деактивована',
        severity: 'warning',
        icon: 'bell-off',
      };
    default:
      return {
        label: 'Системне сповіщення',
        severity: 'neutral',
        icon: 'alert',
      };
  }
}

export function isCriticalNotificationEvent(eventType?: string | null) {
  return eventType === 'smoke_detected' || eventType === 'alarm_activated';
}
