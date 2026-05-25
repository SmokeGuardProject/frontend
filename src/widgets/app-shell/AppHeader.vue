<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppButton from '@/shared/ui/AppButton.vue';
import { useAuthStore } from '@/features/auth/model/use-auth-store';
import { useRealtimeStore } from '@/features/realtime/model/use-realtime-store';
import NotificationCenter from '@/widgets/app-shell/NotificationCenter.vue';

defineProps<{
  title: string;
  userName: string;
}>();

const authStore = useAuthStore();
const realtimeStore = useRealtimeStore();
const router = useRouter();

async function handleLogout() {
  realtimeStore.stop();
  authStore.logout();
  await router.push('/login');
}
</script>

<template>
  <header class="app-header">
    <div>
      <h1 class="app-header__title">
        {{ title }}
      </h1>
    </div>

    <div class="app-header__actions">
      <NotificationCenter />
      <span class="app-header__meta">{{ userName }}</span>
      <AppButton
        variant="ghost"
        @click="handleLogout"
      >
        Вийти
      </AppButton>
    </div>
  </header>
</template>
