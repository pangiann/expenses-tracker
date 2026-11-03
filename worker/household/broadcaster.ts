import type { MonthResponse } from '../../shared/api/endpoints.ts';
import { encodeServerMessage } from '../../shared/protocol.ts';

/** What the household remembers about each open WebSocket, even while it sleeps. */
interface SocketAttachment {
  /** the month this device shows, or null before it said */
  monthKey: string | null;
}

/**
 * Sends live updates to the devices that have the page open. Each device keeps one
 * WebSocket to its household and says which month it shows; after every save, the new
 * month goes to every device showing it. Sending is free on Cloudflare.
 */
export class Broadcaster {
  constructor(private readonly state: DurableObjectState) {}

  /** Accepts a new device connection. The household can sleep without closing it. */
  accept(socket: WebSocket): void {
    this.state.acceptWebSocket(socket);
    this.#attach(socket, { monthKey: null });
  }

  /** Remembers that this device now shows the month. */
  watch(socket: WebSocket, monthKey: string): void {
    this.#attach(socket, { monthKey });
  }

  /** The month this device shows, or null. */
  watchedMonth(socket: WebSocket): string | null {
    return (socket.deserializeAttachment() as SocketAttachment | null)?.monthKey ?? null;
  }

  /** Sends the month to every device showing it. */
  sendMonth({ month, monthKeys, revision }: MonthResponse): void {
    const message = encodeServerMessage({ type: 'month', month, monthKeys, revision });
    for (const socket of this.state.getWebSockets()) {
      if (this.watchedMonth(socket) !== month.month) continue;
      try {
        socket.send(message);
      } catch {
        /* the socket is closing; Cloudflare drops it */
      }
    }
  }

  #attach(socket: WebSocket, attachment: SocketAttachment): void {
    socket.serializeAttachment(attachment);
  }
}
