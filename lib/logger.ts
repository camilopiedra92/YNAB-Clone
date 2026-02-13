import * as Sentry from '@sentry/nextjs';

/**
 * Structured Logger — Consistent logging across the application.
 * 
 * Standardizes log format to make it searchable and extensible.
 * Can be easily integrated with external services like Sentry, Datadog, or Axiom.
 *
 * Log Level Filtering:
 * - Set LOG_LEVEL env var to: 'debug' | 'info' | 'warn' | 'error' | 'silent'
 * - Under NEXT_TEST_BUILD=1 (E2E server), defaults to 'warn' to suppress
 *   expected [ERROR] output from 4xx responses in auth/rate-limit/isolation tests.
 * - Override anytime with LOG_LEVEL=debug to see full output.
 */

type LogContext = Record<string, unknown>;
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function getLogLevel(): LogLevel {
  const explicit = process.env.LOG_LEVEL;
  if (explicit && explicit in LOG_LEVELS) return explicit as LogLevel;
  // Suppress expected errors during E2E test server runs
  if (process.env.NEXT_TEST_BUILD) return 'warn';
  return 'debug';
}

class Logger {
  private level = LOG_LEVELS[getLogLevel()];
  private isProd = process.env.NODE_ENV === 'production';

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  /**
   * Format a log message.
   * - Production: JSON line (parseable by Coolify, Axiom, Loki, Grafana)
   * - Dev: human-readable `[LEVEL] message | context: {...}`
   */
  private formatMessage(level: string, message: string, context?: LogContext): string {
    if (this.isProd) {
      return JSON.stringify({
        level,
        msg: message,
        timestamp: new Date().toISOString(),
        ...context,
      });
    }
    if (!context) return message;
    return `${message} | context: ${JSON.stringify(context)}`;
  }

  info(message: string, context?: LogContext) {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('info', message, context);
    console.log(this.isProd ? formatted : `[INFO] ${formatted}`);

    // Breadcrumb in production — builds context trail for error debugging
    if (this.isProd) {
      Sentry.addBreadcrumb({
        category: 'log',
        message,
        level: 'info',
        data: context,
      });
    }
  }

  warn(message: string, context?: LogContext) {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('warn', message, context);
    console.warn(this.isProd ? formatted : `[WARN] ${formatted}`);

    // Warnings are always breadcrumbed — they often precede errors
    Sentry.addBreadcrumb({
      category: 'log',
      message,
      level: 'warning',
      data: context,
    });
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (!this.shouldLog('error')) return;

    // Report to Sentry with context as extra data
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: { message, ...context },
      });
    } else if (error) {
      Sentry.captureException(new Error(message), {
        extra: { originalError: error, ...context },
      });
    }

    const errorContext = error instanceof Error 
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error };
    const formatted = this.formatMessage('error', message, errorContext);
    console.error(this.isProd ? formatted : `[ERROR] ${formatted}`);
  }

  debug(message: string, context?: LogContext) {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('debug', message, context);
    console.debug(this.isProd ? formatted : `[DEBUG] ${formatted}`);
  }
}

export const logger = new Logger();
