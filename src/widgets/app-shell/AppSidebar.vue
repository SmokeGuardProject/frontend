<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useNotificationsStore } from '@/features/notifications/model/use-notifications-store';

const notificationsStore = useNotificationsStore();
const unreadBadgeLabel = computed(() => (notificationsStore.unreadCount > 99 ? '99+' : String(notificationsStore.unreadCount)));

const links = [
  {
    label: 'Дашборд',
    to: '/dashboard',
    icon: 'dashboard',
  },
  {
    label: 'Сенсори',
    to: '/sensors',
    icon: 'sensors',
  },
  {
    label: 'Сигналізації',
    to: '/alarms',
    icon: 'alarms',
  },
  {
    label: 'Події',
    to: '/events',
    icon: 'events',
  },
  {
    label: 'Сповіщення',
    to: '/notifications',
    icon: 'notifications',
  },
  {
    label: 'Звіти',
    to: '/reports',
    icon: 'reports',
  },
];

onMounted(async () => {
  if (!notificationsStore.unreadCount) {
    await notificationsStore.fetchUnreadCount().catch(() => undefined);
  }
});
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__brand">
      <span class="auth-layout__eyebrow">SmokeGuard</span>
      <strong>Система виявлення задимлення</strong>
    </div>

    <nav class="app-sidebar__nav">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        class="app-sidebar__link"
        :to="link.to"
      >
        <span
          class="app-sidebar__icon"
          aria-hidden="true"
        >
          <svg
            v-if="link.icon === 'dashboard'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M4 11.5 12 5l8 6.5" />
            <path d="M6.5 10.5V19h11v-8.5" />
            <path d="M10 19v-5h4v5" />
          </svg>
          <svg
            v-else-if="link.icon === 'sensors'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="7"
            />
            <circle
              cx="12"
              cy="12"
              r="2.5"
            />
          </svg>
          <svg
            v-else-if="link.icon === 'alarms'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M12 4 5 19h14L12 4Z" />
            <path d="M12 9v4" />
            <path d="M12 16h.01" />
          </svg>
          <svg
            v-else-if="link.icon === 'events'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M7 5.5h10" />
            <path d="M7 10.5h10" />
            <path d="M7 15.5h6" />
            <path d="M4.5 5.5h.01" />
            <path d="M4.5 10.5h.01" />
            <path d="M4.5 15.5h.01" />
          </svg>
          <svg
            v-else-if="link.icon === 'notifications'"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 7h17S18 16 18 9Z" />
            <path d="M10 20a2.2 2.2 0 0 0 4 0" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M7 4.5h7l3 3V19.5H7z" />
            <path d="M14 4.5v3h3" />
            <path d="M9 12h6" />
            <path d="M9 15h6" />
          </svg>
        </span>
        <span class="app-sidebar__text">{{ link.label }}</span>
        <span
          v-if="link.icon === 'notifications' && notificationsStore.unreadCount"
          class="app-sidebar__badge"
        >
          {{ unreadBadgeLabel }}
        </span>
      </RouterLink>
    </nav>

    <div class="app-sidebar__footer">
      <span class="app-sidebar__meta">© 2026 SmokeGuard</span>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar__link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.app-sidebar__icon {
  display: inline-flex;
  width: 1.15rem;
  height: 1.15rem;
  color: currentColor;
  flex: 0 0 auto;
}

.app-sidebar__icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-sidebar__text {
  min-width: 0;
}

.app-sidebar__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  margin-left: auto;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}
</style>
