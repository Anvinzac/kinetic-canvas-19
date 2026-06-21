// Tiny structured logger. Swap for pino/winston later without touching callers.

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

export function createLogger(scope = "hub"): Logger {
  const emit = (level: string, msg: string, meta?: Record<string, unknown>) => {
    const line = { ts: new Date().toISOString(), level, scope, msg, ...meta };
    const out = level === "error" ? console.error : console.log;
    out(JSON.stringify(line));
  };
  return {
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}
