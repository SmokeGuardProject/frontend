<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}>();
</script>

<template>
  <section
    class="app-alert"
    :class="{
      'app-alert--warning': tone === 'warning',
      'app-alert--danger': tone === 'danger',
      'app-alert--success': tone === 'success',
    }"
    role="status"
    aria-live="polite"
  >
    <div class="app-alert__content">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
    </div>
    <div class="app-alert__actions">
      <slot />
    </div>
  </section>
</template>
