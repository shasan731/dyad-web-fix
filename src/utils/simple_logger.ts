// Simple logger that works in both web and Node.js environments
// Replaces electron-log for web deployment

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

function formatMessage(level: LogLevel, scope: string | null, ...args: unknown[]): string {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const scopeStr = scope ? `[${scope}] ` : '';
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  return `[${timestamp}] [${levelStr}] ${scopeStr}${message}`;
}

class ScopedLogger {
  constructor(private scopeName: string | null = null) {}

  debug(...args: unknown[]): void {
    console.debug(formatMessage('debug', this.scopeName, ...args));
  }

  info(...args: unknown[]): void {
    console.info(formatMessage('info', this.scopeName, ...args));
  }

  log(...args: unknown[]): void {
    // log() is an alias for info()
    console.info(formatMessage('info', this.scopeName, ...args));
  }

  warn(...args: unknown[]): void {
    console.warn(formatMessage('warn', this.scopeName, ...args));
  }

  error(...args: unknown[]): void {
    console.error(formatMessage('error', this.scopeName, ...args));
  }

  public scope(name: string): ScopedLogger {
    return new ScopedLogger(name);
  }

  // Properties for electron-log compatibility (in case they're used)
  public transports = {};
}

const log = new ScopedLogger();

export type { ScopedLogger };
export default log;
