import type { MonthResponse } from '../../shared/api/endpoints.ts';
import { encodeServerMessage } from '../../shared/live-update-messages.ts';

/** What the Durable Object remembers about each open WebSocket, even while it sleeps. */
interface LiveUpdateConnectionAttachment {
  /** the month this device shows, or null before it said */
  monthShownOnDevice: string | null;
}

/**
 * Keeps the live-update WebSockets of one household: one per device that has the page open.
 * Each device says which month it shows; after every save, the new month goes to every
 * device showing it. Sending is free on Cloudflare.
 */
export class LiveUpdateConnectionManager {
  constructor(private readonly durableObjectState: DurableObjectState) {}

  /** Accepts a new device connection. The Durable Object can sleep without closing it. */
  acceptConnection(socket: WebSocket): void {
    this.durableObjectState.acceptWebSocket(socket);
    this.#attach(socket, { monthShownOnDevice: null });
  }

  /** Remembers that this device now shows the month (the device's "watchMonth" message). */
  rememberMonthShownOnDevice(socket: WebSocket, monthKey: string): void {
    this.#attach(socket, { monthShownOnDevice: monthKey });
  }

  /** The month this device shows, or null. */
  monthShownOnDevice(socket: WebSocket): string | null {
    return (socket.deserializeAttachment() as LiveUpdateConnectionAttachment | null)?.monthShownOnDevice ?? null;
  }

  /** Sends the month to every device showing it. */
  sendMonthToDevicesWatchingIt({ month, monthKeys, revision }: MonthResponse): void {
    const message = encodeServerMessage({ type: 'month', month, monthKeys, revision });
    for (const socket of this.durableObjectState.getWebSockets()) {
      if (this.monthShownOnDevice(socket) !== month.month) continue;
      try {
        socket.send(message);
      } catch {
        /* the socket is closing; Cloudflare drops it */
      }
    }
  }

  #attach(socket: WebSocket, attachment: LiveUpdateConnectionAttachment): void {
    socket.serializeAttachment(attachment);
  }
}
