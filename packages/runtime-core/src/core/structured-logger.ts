import {
  LogEntry,
  LogLevel,
  Logger,
  LogSink
} from "../interfaces/logging.js";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class StructuredLogger implements Logger {
  constructor(
    private readonly sinks: LogSink[],
    private readonly minLevel: LogLevel = "debug",
    private readonly baseContext: Record<string, unknown> = {}
  ) {}

  child(context: Record<string, unknown>): Logger {
    return new StructuredLogger(this.sinks, this.minLevel, {
      ...this.baseContext,
      ...context
    });
  }

  async log(level: LogLevel, message: string, fields?: Record<string, unknown>): Promise<void> {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: Object.keys(this.baseContext).length ? this.baseContext : undefined,
      fields
    };

    await Promise.all(this.sinks.map((sink) => Promise.resolve(sink.write(entry))));
  }

  debug(message: string, fields?: Record<string, unknown>): Promise<void> {
    return this.log("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): Promise<void> {
    return this.log("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): Promise<void> {
    return this.log("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): Promise<void> {
    return this.log("error", message, fields);
  }
}
