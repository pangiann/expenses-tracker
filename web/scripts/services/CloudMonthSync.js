import { MonthRecord } from '../model/MonthRecord.js';
import { applyMonthChange } from '../model/monthChanges.js';
import { createUniqueId } from '../utils/ids.js';
import { SaveStatus } from './AutoSaver.js';

const LIVE_PATH = '/api/live';
const KEEPALIVE_PING = 'ping'; // answered by the server platform without waking the household
const KEEPALIVE_PONG = 'pong';
const KEEPALIVE_INTERVAL_MS = 50_000;
const RECONNECT_DELAY_MS = 2_000;

/**
 * Backend for the Cloudflare deployment, shared by several people.
 *
 * Everything travels over one WebSocket, the cheapest kind of Cloudflare request
 * (20 messages are billed as 1 request):
 *   to the server:   openMonth, change, export, import
 *   from the server: month (after every change by anyone), changeApplied, exportData, importDone, error
 *
 * Changes are applied on screen immediately and kept in a pending list until the server
 * confirms them. When the server sends a newer month, pending changes are re-applied on
 * top, so someone else's update never hides an edit that is still on its way.
 */
export class CloudMonthSync {
  /**
   * @param {object} callbacks
   * @param {(monthRecord: MonthRecord, savedMonthKeys: string[]) => void} callbacks.onMonth
   * @param {(saveStatus: string) => void} callbacks.onSaveStatus
   */
  constructor({ onMonth, onSaveStatus }) {
    this.onMonth = onMonth;
    this.onSaveStatus = onSaveStatus;
    this.socket = null;
    this.isConnected = false;
    this.shownMonthKey = null;
    /** @type {{ changeId: string, monthKey: string, change: object }[]} sent but not yet confirmed */
    this.pendingChanges = [];
    /** Requests waiting for a reply, keyed by the reply's message type. */
    this.replyWaiters = new Map();
    this.keepaliveTimer = null;
    this.#connect();
  }

  get startupErrorMessage() {
    return 'Could not connect. Check your internet connection and reload the page.';
  }

  async openMonth(monthKey) {
    this.shownMonthKey = monthKey;
    const reply = this.#waitForReply('month', (message) => message.month.month === monthKey);
    this.#send({ type: 'openMonth', month: monthKey });
    await reply;
  }

  /** The change is already applied on screen; send it to the server. */
  sendChange(monthRecord, change) {
    const pendingChange = { changeId: createUniqueId(), monthKey: monthRecord.monthKey, change };
    this.pendingChanges.push(pendingChange);
    this.onSaveStatus(SaveStatus.SAVING);
    this.#send({ type: 'change', changeId: pendingChange.changeId, month: pendingChange.monthKey, change });
  }

  /** Waits until the server has confirmed every pending change (or gives up after 3 seconds). */
  async flushPendingChanges() {
    const deadline = Date.now() + 3_000;
    while (this.pendingChanges.length > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  flushWhilePageCloses() {
    // Pending changes were sent the moment they were made; nothing extra to send.
  }

  async exportAllMonths() {
    const reply = this.#waitForReply('exportData');
    this.#send({ type: 'export' });
    return (await reply).months;
  }

  async importMonths(monthDataList) {
    const reply = this.#waitForReply('importDone');
    this.#send({ type: 'import', months: monthDataList });
    await reply;
  }

  // ----- Connection -----

  #connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}${LIVE_PATH}`);

    this.socket.addEventListener('open', () => {
      this.isConnected = true;
      this.keepaliveTimer = setInterval(() => this.socket.send(KEEPALIVE_PING), KEEPALIVE_INTERVAL_MS);
      // After a reconnect: show the latest version of the month and resend unconfirmed changes.
      if (this.shownMonthKey) this.socket.send(JSON.stringify({ type: 'openMonth', month: this.shownMonthKey }));
      for (const { changeId, monthKey, change } of this.pendingChanges) {
        this.socket.send(JSON.stringify({ type: 'change', changeId, month: monthKey, change }));
      }
      this.#reportStatus();
    });

    this.socket.addEventListener('message', (messageEvent) => this.#handleMessage(messageEvent.data));

    this.socket.addEventListener('close', () => {
      this.isConnected = false;
      clearInterval(this.keepaliveTimer);
      this.onSaveStatus(SaveStatus.OFFLINE);
      setTimeout(() => this.#connect(), RECONNECT_DELAY_MS);
    });
  }

  /** Messages sent while offline are dropped; reconnecting resends what matters. */
  #send(message) {
    if (this.isConnected) this.socket.send(JSON.stringify(message));
  }

  #handleMessage(rawMessage) {
    if (rawMessage === KEEPALIVE_PONG) return;
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === 'month') this.#handleMonth(message);
    if (message.type === 'changeApplied') {
      this.#forgetConfirmedChanges(message.changeId);
      this.#reportStatus();
    }
    if (message.type === 'error') this.#handleError(message);
    this.#resolveReplyWaiters(message);
  }

  #handleMonth({ month: monthData, monthKeys, appliedChangeId }) {
    this.#forgetConfirmedChanges(appliedChangeId);
    if (monthData.month !== this.shownMonthKey) return; // an update for a month nobody here is viewing

    const monthRecord = new MonthRecord(monthData);
    for (const pendingChange of this.pendingChanges) {
      if (pendingChange.monthKey === monthRecord.monthKey) applyMonthChange(monthRecord, pendingChange.change);
    }
    this.onMonth(monthRecord, monthKeys);
    this.#reportStatus();
  }

  /** The server rejected a change: drop it, then show the server's version of the month. */
  #handleError({ message, changeId }) {
    console.error('Server rejected a request:', message);
    this.#forgetConfirmedChanges(changeId);
    this.onSaveStatus(SaveStatus.FAILED);
    if (this.shownMonthKey) this.#send({ type: 'openMonth', month: this.shownMonthKey });
  }

  /** The server handles changes in order, so confirming one confirms every earlier one too. */
  #forgetConfirmedChanges(confirmedChangeId) {
    const position = this.pendingChanges.findIndex((pending) => pending.changeId === confirmedChangeId);
    if (position >= 0) this.pendingChanges.splice(0, position + 1);
  }

  #reportStatus() {
    if (!this.isConnected) return this.onSaveStatus(SaveStatus.OFFLINE);
    this.onSaveStatus(this.pendingChanges.length > 0 ? SaveStatus.SAVING : SaveStatus.SAVED);
  }

  // ----- Request / reply -----

  #waitForReply(replyType, matches = () => true) {
    return new Promise((resolve) => {
      const waiters = this.replyWaiters.get(replyType) ?? [];
      waiters.push({ matches, resolve });
      this.replyWaiters.set(replyType, waiters);
    });
  }

  #resolveReplyWaiters(message) {
    const waiters = this.replyWaiters.get(message.type);
    if (!waiters) return;
    const stillWaiting = waiters.filter((waiter) => {
      if (!waiter.matches(message)) return true;
      waiter.resolve(message);
      return false;
    });
    this.replyWaiters.set(message.type, stillWaiting);
  }
}
