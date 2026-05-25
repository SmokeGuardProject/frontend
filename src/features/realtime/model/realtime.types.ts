export type RealtimeMode = 'polling' | 'socket';
export type RealtimeState = 'idle' | 'connecting' | 'active' | 'error';

export interface RealtimeContext {
  refresh: () => Promise<void>;
  pollingIntervalMs: number;
}

export interface RealtimeClient {
  connect: (_context: RealtimeContext) => Promise<void>;
  disconnect: () => void;
}
