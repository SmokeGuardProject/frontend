<script setup lang="ts">
defineProps<{
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'neutral';
}>();
</script>

<template>
  <button
    :type="type ?? 'button'"
    class="app-button"
    :class="{
      'app-button--full': fullWidth,
      'app-button--ghost': variant === 'ghost',
      'app-button--danger': variant === 'danger',
      'app-button--success': variant === 'success',
      'app-button--neutral': variant === 'neutral',
    }"
    :disabled="loading || disabled"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <span v-if="loading">{{ loadingText ?? 'Зачекайте...' }}</span>
    <slot v-else />
  </button>
</template>
