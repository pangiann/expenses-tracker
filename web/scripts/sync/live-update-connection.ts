import type { MonthResponse } from '../../../shared/api/endpoints.ts';
import { InvalidMessageError, encodeClientMessage, parseServerMessage } from '../../../shared/live-update-messages.ts';

const LIVE_PATH = '/api/live';
const STATUS_PATH = '/api/status';
const KEEPALIVE_PING = 'ping'; // answered by Cloudflare without waking the household
const KEEPALIVE_PONG = 'pong';
const KEEPALIVE_INTERVAL_MS = 50_000;
/**
 * How long to wait for the pong. After sleep, a Wi-Fi drop or a dead tunnel, the browser can
 * keep reporting the socket as open for a minute or more while nothing gets through, so a
 * missing pong, not the socket's state, decides that the connection is dead.
 */
const PONG_TIMEOUT_MS = 10_000;
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
  /** Stops the current socket's event handlers when it is given up. */
  #socketHandlers: AbortController | null = null;
  #isConnected = false;
  #hasConnectedBefore = false;
  #watchedMonthKey: string | null = null;
  #keepaliveTimer: ReturnType<typeof setInterval> | undefined;
  #pongDeadline: ReturnType<typeof setTimeout> | undefined;

  start(): void {
    this.#connect();
    // Coming back to the page or the network is when a socket has most likely died quietly.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.#checkAlive();
    });
    window.addEventListener('online', () => this.#checkAlive());
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
    const handlers = new AbortController();
    this.#socket = socket;
    this.#socketHandlers = handlers;
    let didOpen = false;

    socket.addEventListener(
      'open',
      () => {
        didOpen = true;
        this.#isConnected = true;
        this.onRefused(null);
        this.#keepaliveTimer = setInterval(() => this.#checkAlive(), KEEPALIVE_INTERVAL_MS);
        if (this.#watchedMonthKey) this.watch(this.#watchedMonthKey);
        this.onConnectionChange(true);
        if (this.#hasConnectedBefore) this.onReconnect();
        this.#hasConnectedBefore = true;
      },
      { signal: handlers.signal },
    );

    socket.addEventListener('message', (messageEvent: MessageEvent<string>) => this.#handleMessage(messageEvent.data), {
      signal: handlers.signal,
    });

    socket.addEventListener(
      'close',
      () => {
        this.#stopUsingSocket();
        // A connection that never opened was refused: ask the server why, and retry slowly.
        void this.#explainRefusal(didOpen).then((wasRefused) => {
          setTimeout(() => this.#connect(), wasRefused ? REFUSED_RETRY_DELAY_MS : RECONNECT_DELAY_MS);
        });
      },
      { signal: handlers.signal },
    );
  }

  /** Sends a ping; without any answer within PONG_TIMEOUT_MS, the socket is given up and replaced. */
  #checkAlive(): void {
    const socket = this.#socket;
    if (!this.#isConnected || !socket || this.#pongDeadline) return;
    this.#pongDeadline = setTimeout(() => {
      if (this.#socket !== socket) return;
      console.warn('The live connection stopped answering; reconnecting.');
      this.#stopUsingSocket();
      try {
        socket.close();
      } catch {
        /* already closing */
      }
      setTimeout(() => this.#connect(), RECONNECT_DELAY_MS);
    }, PONG_TIMEOUT_MS);
    try {
      socket.send(KEEPALIVE_PING);
    } catch {
      /* the deadline handles it */
    }
  }

  /** The current socket is closed or given up: stop its timers and handlers, and say so. */
  #stopUsingSocket(): void {
    this.#socketHandlers?.abort(); // a late "close" from a given-up socket must not reconnect twice
    this.#socketHandlers = null;
    this.#socket = null;
    clearInterval(this.#keepaliveTimer);
    clearTimeout(this.#pongDeadline);
    this.#pongDeadline = undefined;
    if (this.#isConnected) {
      this.#isConnected = false;
      this.onConnectionChange(false);
    }
  }

  #handleMessage(rawMessage: string): void {
    // Any message proves the connection is alive.
    clearTimeout(this.#pongDeadline);
    this.#pongDeadline = undefined;
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
