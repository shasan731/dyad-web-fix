declare namespace Electron {
  interface WebContents {
    send: (channel: string, ...args: any[]) => void;
    isDestroyed: () => boolean;
  }

  interface IpcMainInvokeEvent {
    sender: WebContents;
  }

  interface IpcMain {
    handle: (
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: any[]) => any,
    ) => void;
    on: (channel: string, listener: (...args: any[]) => void) => void;
    removeListener: (
      channel: string,
      listener: (...args: any[]) => void,
    ) => void;
    removeHandler: (channel: string) => void;
  }

  interface IpcRenderer {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (...args: any[]) => void) => void;
    removeListener: (
      channel: string,
      listener: (...args: any[]) => void,
    ) => void;
    removeAllListeners: (channel: string) => void;
  }

  interface App {
    isPackaged: boolean;
    getAppPath: () => string;
    getPath: (name: string) => string;
    getVersion: () => string;
    relaunch: () => void;
    quit: () => void;
    setAsDefaultProtocolClient?: (...args: any[]) => boolean;
    isInApplicationsFolder?: () => boolean;
    moveToApplicationsFolder?: () => boolean;
    requestSingleInstanceLock?: () => boolean;
    on?: (...args: any[]) => void;
    whenReady?: () => Promise<void>;
  }

  interface Dialog {
    showOpenDialog: (...args: any[]) => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
    showMessageBox: (...args: any[]) => Promise<{ response: number }>;
  }

  interface Shell {
    openExternal: (url: string) => void;
    showItemInFolder: (path: string) => void;
  }

  interface Clipboard {
    writeImage: (image: any) => void;
  }

  interface Session {
    defaultSession: {
      clearStorageData: (options?: { storages?: string[] }) => Promise<void>;
    };
  }

  interface SafeStorage {
    isEncryptionAvailable: () => boolean;
    encryptString: (text: string) => Buffer;
    decryptString: (buffer: Buffer) => string;
  }
}

declare module "electron" {
  export const app: Electron.App;
  export const ipcMain: Electron.IpcMain;
  export const ipcRenderer: Electron.IpcRenderer;
  export const dialog: Electron.Dialog;
  export const shell: Electron.Shell;
  export const clipboard: Electron.Clipboard;
  export const session: Electron.Session;
  export class BrowserWindow {
    webContents: Electron.WebContents;
    static getAllWindows: () => BrowserWindow[];
    static getFocusedWindow: () => BrowserWindow | null;
    static fromWebContents: (contents: Electron.WebContents) => BrowserWindow | null;
    minimize: () => void;
    maximize: () => void;
    restore: () => void;
    close: () => void;
    isMaximized: () => boolean;
    capturePage: () => Promise<any>;
  }
  export const contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => void;
  };
  export const webFrame: {
    setZoomFactor: (factor: number) => void;
  };
  export const safeStorage: Electron.SafeStorage;
  export type IpcMainInvokeEvent = Electron.IpcMainInvokeEvent;
  export type IpcRenderer = Electron.IpcRenderer;
  export type WebContents = Electron.WebContents;
}
