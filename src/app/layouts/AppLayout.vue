<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { RouterView } from 'vue-router';
import AppHeader from '@/widgets/app-shell/AppHeader.vue';
import AppSidebar from '@/widgets/app-shell/AppSidebar.vue';
import { useAuthStore } from '@/features/auth/model/use-auth-store';
import { useRealtimeStore } from '@/features/realtime/model/use-realtime-store';
import AppAlert from '@/shared/ui/AppAlert.vue';
import AppButton from '@/shared/ui/AppButton.vue';
import AppToast from '@/shared/ui/AppToast.vue';
import SmokeEmergencyModal from '@/widgets/emergency/SmokeEmergencyModal.vue';

const authStore = useAuthStore();
const realtimeStore = useRealtimeStore();
const route = useRoute();

const pageTitle = computed(() => String(route.meta.title ?? 'SmokeGuard'));
</script>

<template>
  <div class="app-shell">
    <AppToast />
    <SmokeEmergencyModal />

    <AppSidebar />

    <div class="app-shell__main">
      <AppHeader
        :title="pageTitle"
        :user-name="authStore.user?.fullName ?? 'Operator'"
      />

      <main class="app-shell__content">
        <AppAlert
          v-if="realtimeStore.errorMessage"
          title="Оновлення даних тимчасово недоступне"
          :message="realtimeStore.errorMessage"
          tone="warning"
        >
          <AppButton
            variant="ghost"
            @click="realtimeStore.refresh()"
          >
            Спробувати знову
          </AppButton>
        </AppAlert>
        <RouterView />
      </main>
    </div>
  </div>
</template>
