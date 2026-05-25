<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/features/auth/model/use-auth-store';
import { useRealtimeStore } from '@/features/realtime/model/use-realtime-store';

const authStore = useAuthStore();
const realtimeStore = useRealtimeStore();

onMounted(async () => {
  await authStore.bootstrap();
});

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await realtimeStore.start();
      return;
    }

    realtimeStore.stop();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  realtimeStore.stop();
});
</script>

<template>
  <RouterView />
</template>
