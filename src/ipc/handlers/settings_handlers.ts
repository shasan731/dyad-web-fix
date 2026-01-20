import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { UserSettings } from "../../lib/schemas";
import { writeSettings } from "../../main/settings";
import { readSettings } from "../../main/settings";

export function registerSettingsHandlers() {
  // Intentionally do NOT use handle because it could log sensitive data from the return value.
  ipcMain.handle("get-user-settings", async () => {
    const settings = readSettings();
    return settings;
  });

  // Intentionally do NOT use handle because it could log sensitive data from the args.
  ipcMain.handle(
    "set-user-settings",
    async (_event: IpcMainInvokeEvent, settings: Partial<UserSettings>) => {
      writeSettings(settings);
      return readSettings();
    },
  );
}
