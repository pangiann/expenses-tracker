import { DurableObject } from 'cloudflare:workers';

import { InvalidMessageError, parseClientMessage } from '../../shared/protocol.ts';
import { Broadcaster } from './broadcaster.ts';
import type { Household } from './household.ts';
import { MonthRepository } from './month-repository.ts';
import { routeRequest } from './router.ts';

const MAX_MESSAGE_LENGTH = 1024;

/**
 * One Durable Object per household: it stores the household's months and keeps a WebSocket
 * open to every device showing the page. worker/index.ts forwards a request here after
 * checking the sign-in:
 *
 *   - an HTTP request to an endpoint goes to the router (router.ts), which calls its handler;
 *   - a WebSocket request becomes a live connection (broadcaster.ts).
 *
 * Cloudflare runs one request at a time per Durable Object, so two people editing at the
 * same moment are applied one after the other; neither overwrites the other.
 */
export class HouseholdRoom extends DurableObject<Env> {
  readonly #household: Household;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.#household = { months: new MonthRepository(state.storage), broadcaster: new Broadcaster(state) };
    // Keepalive pings are answered by Cloudflare without waking this object (free).
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return routeRequest(request, this.#household);
    const { 0: deviceSocket, 1: serverSocket } = new WebSocketPair();
    this.#household.broadcaster.accept(serverSocket);
    return new Response(null, { status: 101, webSocket: deviceSocket });
  }

  /** The only message a device sends: which month it shows. */
  override webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): void {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_LENGTH) return;
    try {
      const message = parseClientMessage(rawMessage);
      this.#household.broadcaster.watch(socket, message.month);
    } catch (error) {
      if (!(error instanceof InvalidMessageError)) throw error;
      console.warn('Ignored a message from a device:', error.message);
    }
  }

  override webSocketClose(socket: WebSocket, code: number): void {
    try {
      socket.close(code, 'Closing');
    } catch {
      /* already closed */
    }
  }
}
