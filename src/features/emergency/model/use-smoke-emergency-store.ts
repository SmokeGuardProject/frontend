import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { NotificationItem } from '@/features/notifications/model/notification.types';

const shownEmergencyNotificationIds = new Set<number>();
const SMOKE_ALERT_SOUND_URL = '/sounds/smoke-alert.wav';
const ALERT_REPEAT_INTERVAL_MS = 2_000;

export const useSmokeEmergencyStore = defineStore('smoke-emergency', () => {
  const activeNotification = ref<NotificationItem | null>(null);
  const soundBlocked = ref(false);
  let activeAudioContexts: AudioContext[] = [];
  let activeAudios: HTMLAudioElement[] = [];
  let repeatTimer: number | null = null;
  let removeInteractionRetryListeners: (() => void) | null = null;

  const isOpen = computed(() => activeNotification.value !== null);

  function openFromNotification(notification: NotificationItem) {
    if (
      notification.read ||
      notification.event?.eventType !== 'smoke_detected' ||
      shownEmergencyNotificationIds.has(notification.id)
    ) {
      return;
    }

    shownEmergencyNotificationIds.add(notification.id);
    activeNotification.value = notification;
    startEmergencySmokeAlert();
  }

  function close() {
    activeNotification.value = null;
    stopEmergencySmokeAlert();
  }

  function startEmergencySmokeAlert() {
    if (repeatTimer !== null) {
      console.log('[smoke-audio] loop already running');
      return;
    }

    console.log('[smoke-audio] start loop');
    void playEmergencySmokeAlert();

    if (typeof window !== 'undefined') {
      repeatTimer = window.setInterval(() => {
        console.log('[smoke-audio] interval tick');

        if (!activeNotification.value) {
          stopEmergencySmokeAlert();
          return;
        }

        void playEmergencySmokeAlert();
      }, ALERT_REPEAT_INTERVAL_MS);
    }
  }

  function stopEmergencySmokeAlert() {
    console.log('[smoke-audio] stop loop');

    if (repeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(repeatTimer);
    }

    repeatTimer = null;
    stopActiveSound();
    removeInteractionRetry();
  }

  function stopActiveSound() {
    activeAudios.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudios = [];

    activeAudioContexts.forEach((audioContext) => {
      void audioContext.close().catch(() => undefined);
    });
    activeAudioContexts = [];
  }

  async function playEmergencySmokeAlert() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      console.log('[smoke-audio] play attempt');
      const audio = new Audio(SMOKE_ALERT_SOUND_URL);
      audio.volume = 1;
      audio.currentTime = 0;
      activeAudios.push(audio);

      const removeAudio = () => {
        activeAudios = activeAudios.filter((item) => item !== audio);
      };

      audio.addEventListener('ended', () => {
        removeAudio();
      });

      await audio.play().catch((error: unknown) => {
        removeAudio();
        throw error;
      });
      console.log('[smoke-audio] play success');
      soundBlocked.value = false;
      removeInteractionRetry();
      return;
    } catch (error) {
      console.warn('[smoke-audio] play failed', error);
    }

    try {
      console.log('[smoke-audio] play attempt');
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextConstructor) {
        soundBlocked.value = true;
        return;
      }

      const audioContext = new AudioContextConstructor();
      activeAudioContexts.push(audioContext);

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const now = audioContext.currentTime;
      const pattern = [
        { start: 0, frequency: 950 },
        { start: 0.18, frequency: 700 },
        { start: 0.36, frequency: 950 },
      ];

      pattern.forEach(({ start, frequency }) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startAt = now + start;
        const stopAt = startAt + 0.16;

        oscillator.type = 'square';
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(stopAt);
      });

      window.setTimeout(() => {
        activeAudioContexts = activeAudioContexts.filter((item) => item !== audioContext);
        void audioContext.close().catch(() => undefined);
      }, 1000);

      console.log('[smoke-audio] play success');
      soundBlocked.value = false;
      removeInteractionRetry();
    } catch (error) {
      console.warn('[smoke-audio] play failed', error);
      soundBlocked.value = true;
      scheduleInteractionRetry();
    }
  }

  function scheduleInteractionRetry() {
    if (typeof window === 'undefined' || removeInteractionRetryListeners) {
      return;
    }

    const retry = () => {
      removeInteractionRetry();

      if (activeNotification.value) {
        void playEmergencySmokeAlert();
      }
    };

    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
    window.addEventListener('touchstart', retry, { once: true });

    removeInteractionRetryListeners = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      window.removeEventListener('touchstart', retry);
      removeInteractionRetryListeners = null;
    };
  }

  function removeInteractionRetry() {
    removeInteractionRetryListeners?.();
  }

  return {
    activeNotification,
    isOpen,
    soundBlocked,
    close,
    openFromNotification,
    playEmergencySmokeAlert,
    stopEmergencySmokeAlert,
  };
});
