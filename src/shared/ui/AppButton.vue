<script setup lang="ts">
defineProps<{
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'ghost';
}>();
</script>

<template>
  <button
    :type="type ?? 'button'"
    class="app-button"
    :class="{
      'app-button--full': fullWidth,
      'app-button--ghost': variant === 'ghost',
    }"
    :disabled="loading"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <span v-if="loading">Зачекайте...</span>
    <slot v-else />
  </button>
</template>
