import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import axios from 'axios';
import { authApi } from '@/features/auth/api/auth.api';
import { authStorage } from '@/features/auth/model/auth.storage';
import type {
  AuthCredentials,
  RegisterPayload,
  UserProfile,
} from '@/features/auth/model/auth.types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(authStorage.getUser());
  const accessToken = ref<string | null>(authStorage.getToken());
  const isLoading = ref(false);
  const isBootstrapping = ref(false);
  const isInitialized = ref(false);

  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value));

  async function login(payload: AuthCredentials) {
    isLoading.value = true;

    try {
      const response = await authApi.login(payload);
      accessToken.value = response.accessToken;
      user.value = response.user;
      authStorage.setToken(response.accessToken);
      authStorage.setUser(response.user);
    } finally {
      isLoading.value = false;
      isInitialized.value = true;
    }
  }

  async function register(payload: RegisterPayload) {
    isLoading.value = true;

    try {
      const response = await authApi.register(payload);
      accessToken.value = response.accessToken;
      user.value = response.user;
      authStorage.setToken(response.accessToken);
      authStorage.setUser(response.user);
    } finally {
      isLoading.value = false;
      isInitialized.value = true;
    }
  }

  async function bootstrap() {
    if (isBootstrapping.value || isInitialized.value) {
      return;
    }

    if (!accessToken.value) {
      isInitialized.value = true;
      return;
    }

    isBootstrapping.value = true;

    try {
      user.value = await authApi.getProfile();
      if (user.value) {
        authStorage.setUser(user.value);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearSession();
      }
    } finally {
      isBootstrapping.value = false;
      isInitialized.value = true;
    }
  }

  function clearSession() {
    user.value = null;
    accessToken.value = null;
    authStorage.clear();
  }

  function logout() {
    clearSession();
    isInitialized.value = true;
  }

  return {
    accessToken,
    isAuthenticated,
    isBootstrapping,
    isInitialized,
    isLoading,
    user,
    bootstrap,
    login,
    logout,
    register,
  };
});
