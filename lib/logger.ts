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

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  private formatMessage(message: string, context?: LogContext): string {
    if (!context) return message;
    return `${message} | context: ${JSON.stringify(context)}`;
  }

  info(message: string, context?: LogContext) {
    if (!this.shouldLog('info')) return;
    console.log(`[INFO] ${this.formatMessage(message, context)}`);
  }

  warn(message: string, context?: LogContext) {
    if (!this.shouldLog('warn')) return;
    console.warn(`[WARN] ${this.formatMessage(message, context)}`);
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (!this.shouldLog('error')) return;
    const errorContext = error instanceof Error 
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error };
      
    console.error(`[ERROR] ${this.formatMessage(message, errorContext)}`);
  }

  debug(message: string, context?: LogContext) {
    if (!this.shouldLog('debug')) return;
    console.debug(`[DEBUG] ${this.formatMessage(message, context)}`);
  }
}

export const logger = new Logger();
