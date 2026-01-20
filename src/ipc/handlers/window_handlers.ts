import { BrowserWindow, ipcMain } from "@/platform/electron";
import type { IpcMainInvokeEvent } from "@/platform/electron";
import log from "@/utils/simple_logger";
import { platform } from "os";

const logger = log.scope("window-handlers");

// Handler for minimizing the window
const handleMinimize = (event: IpcMainInvokeEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    logger.error("Failed to get BrowserWindow instance for minimize command");
    return;
  }
  window.minimize();
};

// Handler for maximizing/restoring the window
const handleMaximize = (event: IpcMainInvokeEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    logger.error("Failed to get BrowserWindow instance for maximize command");
    return;
  }

  if (window.isMaximized()) {
    window.restore();
  } else {
    window.maximize();
  }
};

// Handler for closing the window
const handleClose = (event: IpcMainInvokeEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    logger.error("Failed to get BrowserWindow instance for close command");
    return;
  }
  window.close();
};

// Handler to get the current system platform
const handleGetSystemPlatform = () => {
  return platform();
};

export function registerWindowHandlers() {
  logger.debug("Registering window control handlers");
  ipcMain.handle("window:minimize", handleMinimize);
  ipcMain.handle("window:maximize", handleMaximize);
  ipcMain.handle("window:close", handleClose);
  ipcMain.handle("get-system-platform", handleGetSystemPlatform);
}


