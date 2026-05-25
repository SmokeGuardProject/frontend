<script setup lang="ts">
const links = [
  {
    label: 'Dashboard',
    to: '/dashboard',
  },
  {
    label: 'Sensors',
    to: '/sensors',
  },
  {
    label: 'Alarms',
    to: '/alarms',
  },
  {
    label: 'Events',
    to: '/events',
  },
  {
    label: 'Notifications',
    to: '/notifications',
  },
  {
    label: 'Reports',
    to: '/reports',
  },
];
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__brand">
      <span class="auth-layout__eyebrow">SmokeGuard</span>
      <strong>Панель моніторингу</strong>
    </div>

    <nav class="app-sidebar__nav">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        class="app-sidebar__link"
        :to="link.to"
      >
        {{ link.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
