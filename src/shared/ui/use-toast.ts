import { ref } from 'vue';

export type ToastTone = 'info' | 'warning' | 'danger' | 'success';

export type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
  visible: boolean;
};

const toasts = ref<ToastItem[]>([]);
let toastIdSequence = 0;
const hideTimers = new Map<number, number>();
const removeTimers = new Map<number, number>();

function setToastVisibility(toastId: number, visible: boolean) {
  toasts.value = toasts.value.map((toast) =>
    toast.id === toastId ? { ...toast, visible } : toast,
  );
}

function clearToastTimers(toastId: number) {
  const hideTimer = hideTimers.get(toastId);

  if (hideTimer !== undefined) {
    window.clearTimeout(hideTimer);
    hideTimers.delete(toastId);
  }

  const removeTimer = removeTimers.get(toastId);

  if (removeTimer !== undefined) {
    window.clearTimeout(removeTimer);
    removeTimers.delete(toastId);
  }
}

function removeToast(toastId: number) {
  clearToastTimers(toastId);
  toasts.value = toasts.value.filter((toast) => toast.id !== toastId);
}

export function showToast({
  title,
  message,
  tone = 'success',
  duration = 3600,
}: {
  title: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}) {
  const toastId = ++toastIdSequence;

  toasts.value = [
    {
      id: toastId,
      title,
      message,
      tone,
      visible: true,
    },
    ...toasts.value,
  ];

  hideTimers.set(
    toastId,
    window.setTimeout(() => {
      setToastVisibility(toastId, false);

      removeTimers.set(
        toastId,
        window.setTimeout(() => {
          removeToast(toastId);
        }, 260),
      );
    }, duration),
  );
}

export function closeToast(toastId: number) {
  setToastVisibility(toastId, false);
  clearToastTimers(toastId);

  removeTimers.set(
    toastId,
    window.setTimeout(() => {
      removeToast(toastId);
    }, 260),
  );
}

export function clearAllToasts() {
  hideTimers.forEach((timer) => window.clearTimeout(timer));
  removeTimers.forEach((timer) => window.clearTimeout(timer));
  hideTimers.clear();
  removeTimers.clear();
  toasts.value = [];
}

export function useToastStore() {
  return {
    toasts,
  };
}
