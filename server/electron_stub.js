const crypto = require("crypto");
const path = require("path");

class IpcMainStub {
  constructor() {
    this._handlers = new Map();
    this._listeners = new Map();
  }

  handle(channel, listener) {
    this._handlers.set(channel, listener);
  }

  on(channel, listener) {
    const listeners = this._listeners.get(channel) ?? new Set();
    listeners.add(listener);
    this._listeners.set(channel, listeners);
  }

  removeListener(channel, listener) {
    const listeners = this._listeners.get(channel);
    if (!listeners) return;
    listeners.delete(listener);
  }

  removeHandler(channel) {
    this._handlers.delete(channel);
  }

  async invoke(channel, event, ...args) {
    const handler = this._handlers.get(channel);
    if (!handler) {
      throw new Error(`No IPC handler registered for ${channel}`);
    }
    return handler(event, ...args);
  }

  _getHandler(channel) {
    return this._handlers.get(channel);
  }
}

const ipcMain = new IpcMainStub();

function getUserDataPath() {
  return (
    process.env.DYAD_USER_DATA_PATH ||
    path.resolve(process.cwd(), "userData")
  );
}

let cachedVersion = null;

function getAppVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = require(path.resolve(process.cwd(), "package.json"));
    cachedVersion = pkg?.version || "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion;
}

const app = {
  isPackaged: false,
  getAppPath() {
    return process.cwd();
  },
  getPath(name) {
    if (name === "userData") return getUserDataPath();
    if (name === "sessionData")
      return path.join(getUserDataPath(), "sessionData");
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

const dialog = {
  async showOpenDialog() {
    return { canceled: true, filePaths: [] };
  },
  async showMessageBox() {
    return { response: 1 };
  },
};

const shell = {
  openExternal() {},
  showItemInFolder() {},
};

const clipboard = {
  writeImage() {},
};

const session = {
  defaultSession: {
    async clearStorageData() {},
  },
};

function getBroadcastSender() {
  const broadcaster = globalThis.__dyad_broadcast;
  if (typeof broadcaster === "function") {
    return {
      send: (channel, ...args) => broadcaster(channel, ...args),
      isDestroyed: () => false,
    };
  }
  return globalThis.__dyad_last_sender || null;
}

class BrowserWindowStub {
  constructor(sender) {
    this.webContents = sender;
  }

  static getAllWindows() {
    const sender = getBroadcastSender();
    if (!sender) return [];
    return [new BrowserWindowStub(sender)];
  }

  static getFocusedWindow() {
    return null;
  }

  static fromWebContents() {
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

const safeStorage = {
  isEncryptionAvailable() {
    return Boolean(getEncryptionKey());
  },
  encryptString(plainText) {
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
  decryptString(buffer) {
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

module.exports = {
  ipcMain,
  app,
  dialog,
  shell,
  clipboard,
  session,
  BrowserWindow: BrowserWindowStub,
  safeStorage,
};
