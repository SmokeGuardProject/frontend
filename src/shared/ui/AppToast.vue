<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { clearAllToasts, closeToast, useToastStore } from '@/shared/ui/use-toast';

const { toasts } = useToastStore();

onBeforeUnmount(() => {
  clearAllToasts();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="toasts.length"
      class="app-toast-stack"
      aria-live="polite"
      aria-atomic="false"
    >
      <section
        v-for="toast in toasts"
        :key="toast.id"
        class="app-toast"
        :class="{
          'app-toast--warning': toast.tone === 'warning',
          'app-toast--danger': toast.tone === 'danger',
          'app-toast--success': toast.tone === 'success',
          'app-toast--hidden': !toast.visible,
        }"
        role="status"
      >
        <div class="app-toast__content">
          <strong>{{ toast.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>

        <button
          class="app-toast__close"
          type="button"
          aria-label="Закрити сповіщення"
          @click="closeToast(toast.id)"
        >
          ×
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.app-toast-stack {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 1200;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  gap: 12px;
  pointer-events: none;
}

.app-toast {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  width: min(360px, calc(100vw - 32px));
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  transition:
    opacity 260ms ease,
    transform 260ms ease;
}

.app-toast--warning {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(255, 251, 235, 0.98);
}

.app-toast--danger {
  border-color: rgba(239, 68, 68, 0.28);
  background: rgba(254, 242, 242, 0.98);
}

.app-toast--success {
  border-color: rgba(19, 138, 99, 0.24);
  background: rgba(236, 253, 245, 0.98);
}

.app-toast__content {
  display: grid;
  gap: 6px;
}

.app-toast__content p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.app-toast__close {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.35rem;
  line-height: 1;
}

.app-toast--hidden {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
}

@media (max-width: 720px) {
  .app-toast-stack {
    left: 16px;
    bottom: 16px;
  }
}
</style>
