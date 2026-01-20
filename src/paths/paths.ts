import path from "node:path";
import os from "node:os";
import { IS_TEST_BUILD } from "../ipc/utils/test_utils";

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Gets the base dyad-apps directory path (without a specific app subdirectory)
 */
export function getDyadAppsBaseDirectory(): string {
  if (process.env.DYAD_APPS_PATH) {
    return process.env.DYAD_APPS_PATH;
  }
  if (IS_TEST_BUILD || isServerless()) {
    return path.join(getUserDataPath(), "dyad-apps");
  }
  return path.join(os.homedir(), "dyad-apps");
}

export function getDyadAppPath(appPath: string): string {
  // If appPath is already absolute, use it as-is
  if (path.isAbsolute(appPath)) {
    return appPath;
  }
  // Otherwise, use the default base path
  return path.join(getDyadAppsBaseDirectory(), appPath);
}

export function getTypeScriptCachePath(): string {
  return path.join(getUserDataPath(), "typescript-cache");
}

/**
 * Gets the user data path for the current runtime.
 * Prefers DYAD_USER_DATA_PATH, falls back to /tmp in serverless,
 * and finally to ./userData in local environments.
 */

export function getUserDataPath(): string {
  if (process.env.DYAD_USER_DATA_PATH) {
    return process.env.DYAD_USER_DATA_PATH;
  }
  if (isServerless()) {
    return path.join(os.tmpdir(), "dyad-userData");
  }
  return path.resolve("./userData");
}
