<script setup lang="ts">
defineProps<{
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}>();
</script>

<template>
  <span
    class="app-badge"
    :class="{
      'app-badge--success': tone === 'success',
      'app-badge--warning': tone === 'warning',
      'app-badge--danger': tone === 'danger',
    }"
  >
    <slot />
  </span>
</template>
