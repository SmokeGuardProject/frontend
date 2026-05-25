<script setup lang="ts">
defineProps<{
  title: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}>();
</script>

<template>
  <article class="ui-card">
    <span class="ui-card__label">{{ title }}</span>
    <p
      class="ui-card__value"
      :class="{
        'ui-card__value--success': tone === 'success',
        'ui-card__value--warning': tone === 'warning',
        'ui-card__value--danger': tone === 'danger',
      }"
    >
      {{ value }}
    </p>
    <p
      v-if="detail"
      class="ui-card__detail"
    >
      {{ detail }}
    </p>
  </article>
</template>
