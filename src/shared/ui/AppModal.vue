<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  tone?: 'default' | 'success';
  closeOnInteractOutside?: boolean;
}>(), {
  tone: 'default',
  closeOnInteractOutside: true,
});

const emit = defineEmits<{
  close: [];
}>();

function handleOpenChange(isOpen: boolean) {
  if (!isOpen) {
    emit('close');
  }
}

function handleInteractOutside(event: Event) {
  if (!props.closeOnInteractOutside) {
    event.preventDefault();
  }
}
</script>

<template>
  <DialogRoot
    :open="props.open"
    @update:open="handleOpenChange"
  >
    <DialogPortal>
      <DialogOverlay class="modal-backdrop">
        <DialogContent
          class="modal-card"
          :class="{ 'modal-card--success': props.tone === 'success' }"
          @interact-outside="handleInteractOutside"
        >
          <div class="modal-card__header">
            <div class="modal-card__heading">
              <span
                v-if="props.tone === 'success'"
                class="modal-card__status-icon"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <path
                    d="M5 10.5L8.3 13.8L15 7.2"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <div>
                <DialogTitle as-child>
                  <h2>{{ props.title }}</h2>
                </DialogTitle>
                <DialogDescription
                  v-if="props.description"
                  as-child
                >
                  <p>{{ props.description }}</p>
                </DialogDescription>
              </div>
            </div>
            <DialogClose as-child>
              <button
                class="modal-card__close"
                type="button"
                aria-label="Закрити"
              >
                <span aria-hidden="true">×</span>
              </button>
            </DialogClose>
          </div>

          <div class="modal-card__content">
            <slot />
          </div>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>
