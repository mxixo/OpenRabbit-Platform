export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

export interface LogSink {
  write(entry: LogEntry): void | Promise<void>;
}

export interface Logger {
  log(level: LogLevel, message: string, fields?: Record<string, unknown>): Promise<void>;
  debug(message: string, fields?: Record<string, unknown>): Promise<void>;
  info(message: string, fields?: Record<string, unknown>): Promise<void>;
  warn(message: string, fields?: Record<string, unknown>): Promise<void>;
  error(message: string, fields?: Record<string, unknown>): Promise<void>;
  child(context: Record<string, unknown>): Logger;
}
