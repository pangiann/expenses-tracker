/**
 * One Durable Object per household. It stores the household's months and keeps a
 * WebSocket open to every device that has the page open.
 *
 * Cloudflare runs one message at a time per Durable Object, so two people editing at the
 * same moment are applied one after the other; neither overwrites the other.
 *
 * Messages from a device:
 *   { type: 'openMonth', month }                      show this month (created if missing)
 *   { type: 'change', changeId, month, change }       apply one change (see monthChanges.js)
 *   { type: 'export' }                                send every month
 *   { type: 'import', months }                        replace these months
 * Messages to devices:
 *   { type: 'month', month, monthKeys, appliedChangeId? }  sent to every device viewing that month
 *   { type: 'changeApplied', changeId }                    to the sender, if it no longer views that month
 *   { type: 'exportData', months } / { type: 'importDone', count } / { type: 'error', message, changeId? }
 */
import { MonthRecord } from '../web/scripts/model/MonthRecord.js';
import { InvalidChangeError, applyMonthChange } from '../web/scripts/model/monthChanges.js';
import { closestSavedMonthKey, isMonthData, isValidMonthKey } from '../web/scripts/model/monthValidation.js';

const MONTH_STORAGE_PREFIX = 'month:';
const MAX_MESSAGE_LENGTH = 5 * 1024 * 1024;
const MAX_IMPORTED_MONTHS = 1200; // 100 years
const RECENT_CHANGE_IDS_TO_REMEMBER = 500;
const MAX_KEYS_PER_STORAGE_PUT = 128; // Durable Object storage limit

export class HouseholdRoom {
  /** @param {DurableObjectState} state */
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
    /** @type {string[] | null} month keys, oldest first; null until first read */
    this.monthKeys = null;
    /** Change ids already applied, so a change resent after a reconnect is applied once. */
    this.recentChangeIds = new Set();
    // Keepalive pings are answered by Cloudflare without waking this object (free).
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** Accepts the WebSocket that index.js forwarded after checking the login. */
  async fetch() {
    const { 0: deviceSocket, 1: serverSocket } = new WebSocketPair();
    // Hibernation API: the object can sleep between messages without closing the socket.
    this.state.acceptWebSocket(serverSocket);
    serverSocket.serializeAttachment({ monthKey: null });
    return new Response(null, { status: 101, webSocket: deviceSocket });
  }

  /** @param {WebSocket} socket  @param {string} rawMessage */
  async webSocketMessage(socket, rawMessage) {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_LENGTH) {
      return this.#sendError(socket, 'Message too large');
    }
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return this.#sendError(socket, 'Message is not JSON');
    }

    try {
      switch (message?.type) {
        case 'openMonth':
          return await this.#openMonth(socket, message.month);
        case 'change':
          return await this.#applyChange(socket, message);
        case 'export':
          return await this.#exportMonths(socket);
        case 'import':
          return await this.#importMonths(socket, message.months);
        default:
          return this.#sendError(socket, `Unknown message type: ${message?.type}`);
      }
    } catch (error) {
      if (error instanceof InvalidChangeError) {
        return this.#sendError(socket, error.message, message.changeId);
      }
      console.error('HouseholdRoom failed to handle a message', error);
      return this.#sendError(socket, 'Something went wrong', message.changeId);
    }
  }

  webSocketClose(socket, code) {
    try {
      socket.close(code, 'Closing');
    } catch {
      /* already closed */
    }
  }

  webSocketError() {}

  // ----- Message handlers -----

  async #openMonth(socket, monthKey) {
    if (!isValidMonthKey(monthKey)) throw new InvalidChangeError(`Invalid month: ${monthKey}`);
    const monthRecord = (await this.#loadMonth(monthKey)) ?? (await this.#createMonth(monthKey));
    socket.serializeAttachment({ monthKey });
    socket.send(await this.#monthMessage(monthRecord));
  }

  async #applyChange(socket, { changeId, month: monthKey, change }) {
    if (typeof changeId !== 'string' || changeId.length > 64) throw new InvalidChangeError('Invalid change id');
    if (!isValidMonthKey(monthKey)) throw new InvalidChangeError(`Invalid month: ${monthKey}`);

    const monthRecord = (await this.#loadMonth(monthKey)) ?? (await this.#createMonth(monthKey));
    if (!this.recentChangeIds.has(changeId)) {
      applyMonthChange(monthRecord, change);
      await this.#saveMonth(monthRecord);
      this.#rememberChangeId(changeId);
    }
    const deliveredToSender = this.#broadcastMonth(await this.#monthMessage(monthRecord, changeId), monthKey, socket);
    // The sender may have moved to another month meanwhile; it still needs the confirmation.
    if (!deliveredToSender) socket.send(JSON.stringify({ type: 'changeApplied', changeId }));
  }

  async #exportMonths(socket) {
    const storedMonths = await this.storage.list({ prefix: MONTH_STORAGE_PREFIX });
    socket.send(JSON.stringify({ type: 'exportData', months: [...storedMonths.values()] }));
  }

  async #importMonths(socket, months) {
    if (
      !Array.isArray(months) ||
      months.length === 0 ||
      months.length > MAX_IMPORTED_MONTHS ||
      !months.every(isMonthData)
    ) {
      throw new InvalidChangeError('Not a valid list of months');
    }
    const monthRecords = months.map((monthData) => new MonthRecord(monthData));
    for (let start = 0; start < monthRecords.length; start += MAX_KEYS_PER_STORAGE_PUT) {
      const batch = monthRecords.slice(start, start + MAX_KEYS_PER_STORAGE_PUT);
      await this.storage.put(
        Object.fromEntries(batch.map((monthRecord) => [storageKey(monthRecord.monthKey), monthRecord.toJSON()])),
      );
    }
    this.monthKeys = null; // re-read on next use
    socket.send(JSON.stringify({ type: 'importDone', count: monthRecords.length }));
  }

  // ----- Storage -----

  async #loadMonth(monthKey) {
    const monthData = await this.storage.get(storageKey(monthKey));
    return monthData ? new MonthRecord(monthData) : null;
  }

  /** New months copy budgets and recurring costs from the closest saved month. */
  async #createMonth(monthKey) {
    const templateMonthKey = closestSavedMonthKey(await this.#savedMonthKeys(), monthKey);
    const templateMonth = templateMonthKey ? await this.#loadMonth(templateMonthKey) : null;
    const newMonth = templateMonth
      ? MonthRecord.createFromTemplate(templateMonth, monthKey)
      : MonthRecord.createEmpty(monthKey);
    await this.#saveMonth(newMonth);
    return newMonth;
  }

  async #saveMonth(monthRecord) {
    await this.storage.put(storageKey(monthRecord.monthKey), monthRecord.toJSON());
    const monthKeys = await this.#savedMonthKeys();
    if (!monthKeys.includes(monthRecord.monthKey)) {
      this.monthKeys = [...monthKeys, monthRecord.monthKey].sort();
    }
  }

  async #savedMonthKeys() {
    if (this.monthKeys === null) {
      const storedMonths = await this.storage.list({ prefix: MONTH_STORAGE_PREFIX });
      this.monthKeys = [...storedMonths.keys()].map((key) => key.slice(MONTH_STORAGE_PREFIX.length)).sort();
    }
    return this.monthKeys;
  }

  // ----- Sending -----

  async #monthMessage(monthRecord, appliedChangeId) {
    return JSON.stringify({
      type: 'month',
      month: monthRecord.toJSON(),
      monthKeys: await this.#savedMonthKeys(),
      appliedChangeId,
    });
  }

  /**
   * Sends to every device that is viewing this month. Outgoing messages are free.
   * @returns {boolean} whether senderSocket was one of them
   */
  #broadcastMonth(message, monthKey, senderSocket) {
    let deliveredToSender = false;
    for (const socket of this.state.getWebSockets()) {
      if (socket.deserializeAttachment()?.monthKey !== monthKey) continue;
      try {
        socket.send(message);
        if (socket === senderSocket) deliveredToSender = true;
      } catch {
        /* the socket is closing; Cloudflare drops it */
      }
    }
    return deliveredToSender;
  }

  #sendError(socket, errorMessage, changeId) {
    socket.send(JSON.stringify({ type: 'error', message: errorMessage, changeId }));
  }

  #rememberChangeId(changeId) {
    this.recentChangeIds.add(changeId);
    if (this.recentChangeIds.size > RECENT_CHANGE_IDS_TO_REMEMBER) {
      this.recentChangeIds.delete(this.recentChangeIds.values().next().value);
    }
  }
}

function storageKey(monthKey) {
  return `${MONTH_STORAGE_PREFIX}${monthKey}`;
}
