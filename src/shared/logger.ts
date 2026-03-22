/**
 * Logger
 * 
 * Centralized logging for the curator pipeline.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

class Logger {
  private context: Record<string, unknown> = {};

  setContext(context: Record<string, unknown>): void {
    this.context = context;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context }
    };

    // Output to console
    const output = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case "error":
        console.error(output, context || "");
        break;
      case "warn":
        console.warn(output, context || "");
        break;
      default:
        console.log(output, context || "");
    }
  }
}

export const logger = new Logger();