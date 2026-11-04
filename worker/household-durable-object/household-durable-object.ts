import { DurableObject } from 'cloudflare:workers';

import { InvalidMessageError, parseClientMessage } from '../../shared/live-update-messages.ts';
import { routeApiRequestToOperation } from './api-request-router.ts';
import { DurableObjectMonthRepository } from './durable-object-month-repository.ts';
import { LiveUpdateConnectionManager } from './live-update-connection-manager.ts';
import type { OperationContext } from './operation-context.ts';

const MAX_MESSAGE_LENGTH = 1024;

/**
 * One Durable Object per household: it stores the household's months and keeps a WebSocket
 * open to every device showing the page. worker-entry-point.ts picks the household from the
 * signed-in email and forwards the request here. Cloudflare gives each Durable Object its
 * own storage, so everything below only ever sees this household's months:
 *
 *   - an HTTP request to an endpoint goes to the router (api-request-router.ts), which calls
 *     its operation (operations/);
 *   - a WebSocket request becomes a live-update connection (live-update-connection-manager.ts).
 *
 * Cloudflare runs one request at a time per Durable Object, so two people editing at the
 * same moment are applied one after the other; neither overwrites the other.
 */
export class HouseholdDurableObject extends DurableObject<Env> {
  readonly #operationContext: OperationContext;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.#operationContext = {
      monthRepository: new DurableObjectMonthRepository(state.storage),
      liveUpdateConnections: new LiveUpdateConnectionManager(state),
    };
    // Keepalive pings are answered by Cloudflare without waking this object (free).
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return routeApiRequestToOperation(request, this.#operationContext);
    }
    const { 0: deviceSocket, 1: serverSocket } = new WebSocketPair();
    this.#operationContext.liveUpdateConnections.acceptConnection(serverSocket);
    return new Response(null, { status: 101, webSocket: deviceSocket });
  }

  /** The only message a device sends: which month it shows. */
  override webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): void {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_LENGTH) return;
    try {
      const message = parseClientMessage(rawMessage);
      this.#operationContext.liveUpdateConnections.rememberMonthShownOnDevice(socket, message.month);
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
