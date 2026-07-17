import { LogEntry, LogSink } from "../interfaces/logging.js";

export class InMemoryLogSink implements LogSink {
  private readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }
}
