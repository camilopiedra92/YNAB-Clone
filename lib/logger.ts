/**
 * Structured Logger — Consistent logging across the application.
 * 
 * Standardizes log format to make it searchable and extensible.
 * Can be easily integrated with external services like Sentry, Datadog, or Axiom.
 */

type LogContext = Record<string, unknown>;

class Logger {
  private formatMessage(message: string, context?: LogContext): string {
    if (!context) return message;
    return `${message} | context: ${JSON.stringify(context)}`;
  }

  info(message: string, context?: LogContext) {
    console.log(`[INFO] ${this.formatMessage(message, context)}`);
  }

  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${this.formatMessage(message, context)}`);
  }

  error(message: string, error?: unknown, context?: LogContext) {
    const errorContext = error instanceof Error 
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error };
      
    console.error(`[ERROR] ${this.formatMessage(message, errorContext)}`);
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${this.formatMessage(message, context)}`);
    }
  }
}

export const logger = new Logger();
