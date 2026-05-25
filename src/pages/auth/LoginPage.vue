<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import { useAuthStore } from '@/features/auth/model/use-auth-store';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({
  email: '',
  password: '',
});

const errorMessage = ref('');

async function submitForm() {
  errorMessage.value = '';

  try {
    await authStore.login(form);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.push(redirect);
  } catch {
    errorMessage.value = 'Не вдалося виконати вхід. Перевірте email і пароль.';
  }
}
</script>

<template>
  <section class="auth-card">
    <div class="auth-card__header">
      <span class="auth-card__eyebrow">Authorized access</span>
      <h2>Вхід до операторської панелі</h2>
    </div>

    <form
      class="auth-form"
      @submit.prevent="submitForm"
    >
      <AppInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="operator@smokeguard.com"
        autocomplete="email"
        required
      />

      <AppInput
        v-model="form.password"
        label="Пароль"
        type="password"
        placeholder="Введіть пароль"
        autocomplete="current-password"
        required
      />

      <p
        v-if="errorMessage"
        class="form-message form-message--error"
        role="alert"
        aria-live="assertive"
      >
        {{ errorMessage }}
      </p>

      <AppButton
        type="submit"
        :loading="authStore.isLoading"
        full-width
      >
        Увійти
      </AppButton>
    </form>

    <p class="auth-card__footer">
      Немає акаунта?
      <RouterLink to="/register">
        Створити профіль
      </RouterLink>
    </p>
  </section>
</template>
