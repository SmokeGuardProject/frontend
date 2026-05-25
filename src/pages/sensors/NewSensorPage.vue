<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '@/shared/ui/AppButton.vue';
import AppInput from '@/shared/ui/AppInput.vue';
import { useSensorsStore } from '@/features/sensors/model/use-sensors-store';

const router = useRouter();
const sensorsStore = useSensorsStore();

const form = reactive({
  location: '',
  floor: '',
  building: '',
});

const errorMessage = ref('');

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeOptionalNumber(value: unknown) {
  const text = normalizeText(value);
  return text ? Number(text) : null;
}

function formatUserErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : sensorsStore.submitError;

  if (!rawMessage) {
    return 'Не вдалося створити сенсор. Спробуйте ще раз.';
  }

  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('trim is not a function') ||
    normalized.includes('cannot read properties') ||
    normalized.includes('undefined')
  ) {
    return 'Сталася помилка під час створення сенсора. Спробуйте ще раз.';
  }

  if (
    normalized.includes('network error') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('failed to fetch')
  ) {
    return 'Не вдалося зв’язатися із сервером. Спробуйте ще раз трохи пізніше.';
  }

  return rawMessage;
}

async function submitForm() {
  errorMessage.value = '';

  try {
    const response = await sensorsStore.createSensor({
      location: normalizeText(form.location),
      floor: normalizeOptionalNumber(form.floor),
      building: normalizeText(form.building) || undefined,
    });

    sensorsStore.setLastCreatedSensor(response);
    await router.push('/sensors');
  } catch (error) {
    errorMessage.value = formatUserErrorMessage(error);
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <span class="hero-panel__eyebrow">New sensor</span>
        <h1>Створення нового датчика</h1>
      </div>
    </div>

    <section class="auth-card form-card-wide">
      <div class="auth-card__header">
        <span class="auth-card__eyebrow">Provisioning</span>
        <h2>Конфігурація локації сенсора</h2>
      </div>

      <form
        class="auth-form"
        @submit.prevent="submitForm"
      >
        <AppInput
          v-model="form.location"
          label="Локація"
          placeholder="Room 101"
          required
        />
        <AppInput
          v-model="form.floor"
          label="Поверх"
          type="number"
          placeholder="0"
        />
        <AppInput
          v-model="form.building"
          label="Будівля"
          placeholder="Building A"
        />

        <p
          v-if="errorMessage"
          class="form-message form-message--error"
        >
          {{ errorMessage }}
        </p>

        <div class="form-actions">
          <AppButton
            variant="ghost"
            type="button"
            @click="router.push('/sensors')"
          >
            Назад
          </AppButton>
          <AppButton
            type="submit"
            :loading="sensorsStore.submitLoading"
          >
            Створити сенсор
          </AppButton>
        </div>
      </form>
    </section>
  </section>
</template>
