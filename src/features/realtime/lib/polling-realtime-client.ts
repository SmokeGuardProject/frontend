import type { RealtimeClient, RealtimeContext } from '@/features/realtime/model/realtime.types';

export function createPollingRealtimeClient(): RealtimeClient {
  let timerId: number | null = null;
  let disposed = false;
  let inFlight = false;

  async function scheduleNextTick(context: RealtimeContext) {
    if (disposed) {
      return;
    }

    timerId = window.setTimeout(async () => {
      if (disposed) {
        return;
      }

      if (document.hidden || inFlight) {
        await scheduleNextTick(context);
        return;
      }

      inFlight = true;

      try {
        await context.refresh();
      } catch {
        // Errors are handled in the store so polling can continue.
      } finally {
        inFlight = false;
        await scheduleNextTick(context);
      }
    }, context.pollingIntervalMs);
  }

  return {
    async connect(context: RealtimeContext) {
      disposed = false;
      inFlight = true;

      try {
        await context.refresh();
      } finally {
        inFlight = false;
      }

      await scheduleNextTick(context);
    },

    disconnect() {
      disposed = true;

      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}
