import crypto from "node:crypto";
import path from "node:path";
import { getUserDataPath } from "../paths/paths";

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;
type Listener = (...args: unknown[]) => void;

export type WebContents = {
  send: (channel: string, ...args: unknown[]) => void;
  isDestroyed: () => boolean;
};

export type IpcMainInvokeEvent = {
  sender: WebContents;
};

class IpcMainStub {
  private handlers = new Map<string, IpcHandler>();
  private listeners = new Map<string, Set<Listener>>();

  handle(channel: string, listener: IpcHandler) {
    this.handlers.set(channel, listener);
  }

  on(channel: string, listener: Listener) {
    const listeners = this.listeners.get(channel) ?? new Set();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
  }

  removeListener(channel: string, listener: Listener) {
    const listeners = this.listeners.get(channel);
    if (!listeners) return;
    listeners.delete(listener);
  }

  removeHandler(channel: string) {
    this.handlers.delete(channel);
  }

  _getHandler(channel: string) {
    return this.handlers.get(channel);
  }
}

export const ipcMain = new IpcMainStub();

let cachedVersion: string | undefined;

function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.resolve(process.cwd(), "package.json"));
    cachedVersion = pkg?.version || "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion ?? "0.0.0";
}

export const app = {
  isPackaged: false,
  getAppPath() {
    return process.cwd();
  },
  getPath(name: string) {
    if (name === "userData") return getUserDataPath();
    if (name === "sessionData") {
      return path.join(getUserDataPath(), "sessionData");
    }
    return process.cwd();
  },
  getVersion() {
    return getAppVersion();
  },
  relaunch() {},
  quit() {},
  setAsDefaultProtocolClient() {
    return false;
  },
  isInApplicationsFolder() {
    return true;
  },
  moveToApplicationsFolder() {
    return false;
  },
  requestSingleInstanceLock() {
    return true;
  },
  on() {},
  whenReady() {
    return Promise.resolve();
  },
};

export const dialog = {
  async showOpenDialog(_options?: unknown) {
    return { canceled: true, filePaths: [] as string[] };
  },
  async showMessageBox(_options?: unknown) {
    return { response: 1 };
  },
};

export const shell = {
  async openExternal(_url?: string) {},
  showItemInFolder(_path?: string) {},
};

export const clipboard = {
  writeImage(_image?: unknown) {},
};

export const session = {
  defaultSession: {
    async clearStorageData(_options?: unknown) {},
  },
};

function getBroadcastSender(): WebContents | null {
  const broadcaster = (globalThis as any).__dyad_broadcast;
  if (typeof broadcaster === "function") {
    return {
      send: (channel: string, ...args: unknown[]) => broadcaster(channel, ...args),
      isDestroyed: () => false,
    };
  }
  return (globalThis as any).__dyad_last_sender || null;
}

export class BrowserWindow {
  webContents: WebContents;

  constructor(sender: WebContents) {
    this.webContents = sender;
  }

  static getAllWindows(): BrowserWindow[] {
    const sender = getBroadcastSender();
    if (!sender) return [];
    return [new BrowserWindow(sender)];
  }

  static getFocusedWindow(): BrowserWindow | null {
    return null;
  }

  static fromWebContents(_contents?: WebContents): BrowserWindow | null {
    return null;
  }

  minimize() {}
  maximize() {}
  restore() {}
  close() {}
  isMaximized() {
    return false;
  }
  async capturePage() {
    return {
      isEmpty() {
        return true;
      },
    };
  }
}

function getEncryptionKey() {
  const key = process.env.DYAD_SERVER_ENCRYPTION_KEY;
  if (!key) return null;
  return crypto.createHash("sha256").update(key).digest();
}

export const safeStorage = {
  isEncryptionAvailable() {
    return Boolean(getEncryptionKey());
  },
  encryptString(plainText: string) {
    const key = getEncryptionKey();
    if (!key) {
      return Buffer.from(plainText, "utf8");
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  },
  decryptString(buffer: Buffer) {
    const key = getEncryptionKey();
    if (!key) {
      return buffer.toString("utf8");
    }
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  },
};
