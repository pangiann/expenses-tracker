import type { MonthResponse } from '../../../shared/api/endpoints.ts';
import { InvalidMessageError, encodeClientMessage, parseServerMessage } from '../../../shared/live-update-messages.ts';

const LIVE_PATH = '/api/live';
const STATUS_PATH = '/api/status';
const KEEPALIVE_PING = 'ping'; // answered by Cloudflare without waking the household
const KEEPALIVE_PONG = 'pong';
const KEEPALIVE_INTERVAL_MS = 50_000;
const RECONNECT_DELAY_MS = 2_000;
const REFUSED_RETRY_DELAY_MS = 20_000; // when the server refuses us, retrying fast won't help

/** Why the server refused the connection, from /api/status (see explainSignInStatus in worker/worker-entry-point.ts). */
export interface Refusal {
  problem: string;
  email?: string;
  reason?: string;
}

/**
 * The WebSocket that brings other people's edits to this page. It carries no edits of its
 * own: edits are HTTP requests (see unsaved-edits-outbox.ts). The page says which month it shows, and
 * the household sends that month after every save by anyone.
 */
export class LiveUpdateConnection {
  /** A newer version of the watched month. */
  onMonth: (answer: MonthResponse) => void = () => {};
  /** Connected again after a drop: updates may have been missed. */
  onReconnect: () => void = () => {};
  onConnectionChange: (isConnected: boolean) => void = () => {};
  /** The server refused the connection on purpose (null: no longer refused), or can't be reached. */
  onRefused: (refusal: Refusal | null) => void = () => {};
  onUnreachable: () => void = () => {};

  #socket: WebSocket | null = null;
  #isConnected = false;
  #hasConnectedBefore = false;
  #watchedMonthKey: string | null = null;
  #keepaliveTimer: ReturnType<typeof setInterval> | undefined;

  start(): void {
    this.#connect();
  }

  get isConnected(): boolean {
    return this.#isConnected;
  }

  /** From now on, send updates of this month. */
  watch(monthKey: string): void {
    this.#watchedMonthKey = monthKey;
    if (this.#isConnected) this.#socket?.send(encodeClientMessage({ type: 'watchMonth', month: monthKey }));
  }

  #connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}${LIVE_PATH}`);
    this.#socket = socket;
    let didOpen = false;

    socket.addEventListener('open', () => {
      didOpen = true;
      this.#isConnected = true;
      this.onRefused(null);
      this.#keepaliveTimer = setInterval(() => socket.send(KEEPALIVE_PING), KEEPALIVE_INTERVAL_MS);
      if (this.#watchedMonthKey) this.watch(this.#watchedMonthKey);
      this.onConnectionChange(true);
      if (this.#hasConnectedBefore) this.onReconnect();
      this.#hasConnectedBefore = true;
    });

    socket.addEventListener('message', (messageEvent: MessageEvent<string>) => this.#handleMessage(messageEvent.data));

    socket.addEventListener('close', () => {
      this.#isConnected = false;
      clearInterval(this.#keepaliveTimer);
      this.onConnectionChange(false);
      // A connection that never opened was refused: ask the server why, and retry slowly.
      void this.#explainRefusal(didOpen).then((wasRefused) => {
        setTimeout(() => this.#connect(), wasRefused ? REFUSED_RETRY_DELAY_MS : RECONNECT_DELAY_MS);
      });
    });
  }

  #handleMessage(rawMessage: string): void {
    if (rawMessage === KEEPALIVE_PONG) return;
    try {
      const { month, monthKeys, revision } = parseServerMessage(rawMessage);
      this.onMonth({ month, monthKeys, revision });
    } catch (error) {
      if (!(error instanceof InvalidMessageError)) throw error;
      console.error('Ignored a message from the server:', error.message);
    }
  }

  /** @returns true when the server refused us on purpose */
  async #explainRefusal(didOpen: boolean): Promise<boolean> {
    if (didOpen) return false;
    try {
      const response = await fetch(STATUS_PATH, { cache: 'no-store' });
      if (response.ok) return false; // signed in and a member: the drop was a network problem
      this.onRefused((await response.json()) as Refusal);
      return true;
    } catch {
      this.onUnreachable();
      return false;
    }
  }
}

/** The page's one live connection. */
export const liveUpdateConnection = new LiveUpdateConnection();
