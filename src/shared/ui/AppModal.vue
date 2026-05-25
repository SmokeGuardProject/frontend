<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  description?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    v-if="open"
    class="modal-backdrop"
    @click.self="emit('close')"
  >
    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <div class="modal-card__header">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="description">
            {{ description }}
          </p>
        </div>
        <button
          class="modal-card__close"
          type="button"
          @click="emit('close')"
        >
          Закрити
        </button>
      </div>

      <div class="modal-card__content">
        <slot />
      </div>
    </div>
  </div>
</template>
