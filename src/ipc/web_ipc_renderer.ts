import { v4 as uuidv4 } from "uuid";
import {
  VALID_INVOKE_CHANNELS,
  VALID_RECEIVE_CHANNELS,
  type ValidInvokeChannel,
  type ValidReceiveChannel,
} from "./ipc_channels";

type Listener = (...args: unknown[]) => void;

type WebIpcRendererOptions = {
  baseUrl?: string;
};

export class WebIpcRenderer {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private clientId: string;
  private baseUrl: string;
  private reconnectTimer: number | null = null;

  constructor(options: WebIpcRendererOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      // @ts-ignore
      import.meta.env?.VITE_DYAD_API_BASE_URL ||
      window.location.origin;
    this.clientId = this.getOrCreateClientId();
    this.connect();
  }

  private getOrCreateClientId(): string {
    try {
      const stored = window.localStorage.getItem("dyad-client-id");
      if (stored) return stored;
      const fresh = uuidv4();
      window.localStorage.setItem("dyad-client-id", fresh);
      return fresh;
    } catch {
      return uuidv4();
    }
  }

  private connect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    const url = new URL("/api/ipc/events", this.baseUrl);
    url.searchParams.set("clientId", this.clientId);
    const wsUrl = url.toString().replace(/^http/, "ws");
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          channel: string;
          args?: unknown[];
        };
        if (!VALID_RECEIVE_CHANNELS.includes(data.channel as any)) {
          return;
        }
        const listeners = this.listeners.get(data.channel);
        if (!listeners || listeners.size === 0) {
          return;
        }
        const args = Array.isArray(data.args) ? data.args : [];
        for (const listener of listeners) {
          listener(...args);
        }
      } catch (error) {
        console.warn("Failed to parse IPC event:", error);
      }
    };

    socket.onclose = () => {
      if (this.reconnectTimer != null) {
        window.clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
      }, 1000);
    };

    this.socket = socket;
  }

  public async invoke(channel: ValidInvokeChannel, ...args: unknown[]) {
    if (!VALID_INVOKE_CHANNELS.includes(channel as any)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    const response = await fetch(new URL("/api/ipc/invoke", this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        args,
        clientId: this.clientId,
      }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      result?: unknown;
      error?: string;
    };

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "IPC invoke failed");
    }
    return payload.result;
  }

  public on(channel: ValidReceiveChannel, listener: Listener) {
    if (!VALID_RECEIVE_CHANNELS.includes(channel as any)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    const listeners = this.listeners.get(channel) ?? new Set();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
  }

  public removeListener(channel: ValidReceiveChannel, listener: Listener) {
    const listeners = this.listeners.get(channel);
    if (!listeners) return;
    listeners.delete(listener);
  }

  public removeAllListeners(channel: ValidReceiveChannel) {
    this.listeners.delete(channel);
  }
}
