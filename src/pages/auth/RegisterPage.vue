<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import { useAuthStore } from '@/features/auth/model/use-auth-store';

const authStore = useAuthStore();
const router = useRouter();

const form = reactive({
  fullName: '',
  email: '',
  password: '',
});

const errorMessage = ref('');

async function submitForm() {
  errorMessage.value = '';

  try {
    await authStore.register(form);
    await router.push('/dashboard');
  } catch {
    errorMessage.value = 'Не вдалося створити акаунт. Перевірте дані або спробуйте пізніше.';
  }
}
</script>

<template>
  <section class="auth-card">
    <div class="auth-card__header">
      <span class="auth-card__eyebrow">Operator setup</span>
      <h2>Створення адміністративного доступу</h2>
    </div>

    <form
      class="auth-form"
      @submit.prevent="submitForm"
    >
      <AppInput
        v-model="form.fullName"
        label="Повне ім'я"
        placeholder="Ім'я оператора"
        autocomplete="name"
        required
      />

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
        placeholder="Не менше 6 символів"
        autocomplete="new-password"
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
        Створити акаунт
      </AppButton>
    </form>

    <p class="auth-card__footer">
      Уже є акаунт?
      <RouterLink to="/login">
        Перейти до входу
      </RouterLink>
    </p>
  </section>
</template>
