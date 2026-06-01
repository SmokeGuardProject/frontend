<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSmokeEmergencyStore } from '@/features/emergency/model/use-smoke-emergency-store';
import { formatDateTime, formatSensorLocation } from '@/features/sensors/lib/formatters';
import AppButton from '@/shared/ui/AppButton.vue';

const emergencyStore = useSmokeEmergencyStore();
const router = useRouter();
const route = useRoute();

const notification = computed(() => emergencyStore.activeNotification);
const event = computed(() => notification.value?.event ?? null);
const sensor = computed(() => event.value?.sensor ?? null);
const sensorId = computed(() => sensor.value?.id ?? event.value?.sensorId ?? null);
const eventTime = computed(() => event.value?.createdAt ?? notification.value?.createdAt ?? null);
const location = computed(() => {
  if (!sensor.value) {
    return 'Локація не вказана';
  }

  return formatSensorLocation(sensor.value.building, sensor.value.floor, sensor.value.location) || 'Локація не вказана';
});

const source = computed(() => (sensorId.value ? `Сенсор #${sensorId.value}` : 'Джерело не вказане'));

const instructions = [
  'Негайно організуйте евакуацію людей із зони ризику.',
  'Переконайтесь, що сигналізація активована та люди отримали оповіщення.',
  'Спрямуйте людей до безпечного виходу, не використовуйте ліфти.',
  'Уникайте зони задимлення та не допускайте повернення людей усередину.',
  'Повідомте відповідальні служби або екстрені служби згідно з внутрішнім планом реагування.',
  'Після евакуації перевірте подію, сенсор і пов’язані сигналізації.',
];

function preventDismiss(event: Event) {
  event.preventDefault();
}

async function goToAlarms() {
  emergencyStore.close();
  await router.push('/alarms');
}

watch(
  () => route.fullPath,
  () => {
    if (emergencyStore.isOpen) {
      emergencyStore.close();
    }
  },
);

onBeforeUnmount(() => {
  emergencyStore.stopEmergencySmokeAlert();
});
</script>

<template>
  <DialogRoot
    :open="emergencyStore.isOpen"
  >
    <DialogPortal>
      <DialogOverlay class="smoke-emergency">
        <DialogContent
          class="smoke-emergency__card"
          @interact-outside="preventDismiss"
          @pointer-down-outside="preventDismiss"
          @escape-key-down="preventDismiss"
        >
          <div class="smoke-emergency__header">
            <span
              class="smoke-emergency__icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M12 4 4.8 18.5h14.4L12 4Z" />
                <path d="M12 9v4" />
                <path d="M12 16.5h.01" />
              </svg>
            </span>

            <div class="smoke-emergency__heading">
              <span class="smoke-emergency__status-chip">
                Тривога
              </span>
              <DialogTitle as-child>
                <h2>Виявлено дим</h2>
              </DialogTitle>
              <DialogDescription as-child>
                <p>Система зафіксувала можливу небезпеку. Негайно запустіть реагування.</p>
              </DialogDescription>
            </div>
          </div>

          <div class="smoke-emergency__meta">
            <div>
              <span>Локація</span>
              <strong>{{ location }}</strong>
            </div>
            <div>
              <span>Джерело</span>
              <strong>{{ source }}</strong>
            </div>
            <div>
              <span>Час виявлення</span>
              <strong>{{ formatDateTime(eventTime) }}</strong>
            </div>
            <div>
              <span>Статус</span>
              <strong>Потрібне негайне реагування</strong>
            </div>
          </div>

          <section class="smoke-emergency__instructions">
            <h3>Негайні дії</h3>
            <ol>
              <li
                v-for="instruction in instructions"
                :key="instruction"
              >
                {{ instruction }}
              </li>
            </ol>
          </section>

          <div class="smoke-emergency__warning">
            Не відкладайте евакуацію для додаткової перевірки. Дим може становити небезпеку для життя.
          </div>

          <p
            v-if="emergencyStore.soundBlocked"
            class="smoke-emergency__sound-note"
          >
            Звук тривоги заблокований браузером. Натисніть будь-де на сторінці, щоб дозволити звук.
          </p>

          <div class="smoke-emergency__actions">
            <AppButton
              variant="danger"
              @click="goToAlarms"
            >
              Перейти до сигналізацій
            </AppButton>
            <AppButton
              variant="neutral"
              @click="emergencyStore.close"
            >
              Підтвердити перегляд
            </AppButton>
          </div>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.smoke-emergency {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(17, 24, 39, 0.48);
  backdrop-filter: blur(4px);
}

.smoke-emergency__card {
  width: min(100%, 760px);
  max-height: none;
  overflow: visible;
  padding: 24px;
  border: 2px solid rgba(239, 68, 68, 0.34);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(254, 242, 242, 0.98), #ffffff 34%),
    #ffffff;
  box-shadow: 0 28px 76px rgba(127, 29, 29, 0.22);
}

.smoke-emergency__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.smoke-emergency__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: #fef2f2;
  color: #dc2626;
}

.smoke-emergency__icon svg {
  width: 30px;
  height: 30px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.smoke-emergency__heading h2,
.smoke-emergency__instructions h3 {
  margin: 0;
  color: #111827;
  letter-spacing: -0.03em;
}

.smoke-emergency__heading h2 {
  font-size: 2rem;
}

.smoke-emergency__status-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  height: 30px;
  margin-bottom: 10px;
  padding: 0 12px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 999px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.smoke-emergency__heading p {
  margin: 8px 0 0;
  color: #6b7280;
  line-height: 1.55;
}

.smoke-emergency__meta {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
  padding: 16px 18px;
  border: 1px solid rgba(239, 68, 68, 0.16);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
}

.smoke-emergency__meta div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.smoke-emergency__meta span {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 700;
}

.smoke-emergency__meta strong {
  color: #111827;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.smoke-emergency__instructions {
  margin-top: 16px;
}

.smoke-emergency__instructions h3 {
  font-size: 1.18rem;
}

.smoke-emergency__instructions ol {
  display: grid;
  gap: 7px;
  margin: 11px 0 0;
  padding-left: 22px;
  color: #374151;
  line-height: 1.45;
}

.smoke-emergency__warning {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 16px;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 700;
  line-height: 1.45;
}

.smoke-emergency__sound-note {
  margin: 12px 0 0;
  color: #b45309;
  font-size: 0.94rem;
}

.smoke-emergency__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.smoke-emergency__actions :deep(.app-button) {
  width: 100%;
  min-height: 52px;
}

@media (max-width: 640px) {
  .smoke-emergency {
    padding: 14px;
  }

  .smoke-emergency__card {
    max-height: calc(100vh - 28px);
    overflow-y: auto;
    padding: 20px;
  }

  .smoke-emergency__meta,
  .smoke-emergency__actions {
    grid-template-columns: 1fr;
  }

  .smoke-emergency__heading h2 {
    font-size: 1.65rem;
  }
}

@media (min-width: 641px) and (max-width: 900px) {
  .smoke-emergency__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
