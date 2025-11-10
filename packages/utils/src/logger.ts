/**
 * Centralized logger utility for the application
 * Prevents development logs from appearing in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enabled: this.shouldEnableLogging(),
      minLevel: this.getMinLogLevel(),
      prefix: config?.prefix,
    };
  }

  /**
   * Determine if logging should be enabled based on environment
   * Only enable in development, test, or when explicitly configured
   */
  private shouldEnableLogging(): boolean {
    // Node.js environment (server-side, Cloud Functions)
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      return nodeEnv === 'development' || nodeEnv === 'test';
    }

    // Browser environment (client-side)
    if (typeof window !== 'undefined') {
      // Never log in production builds
      // Check for Next.js public env vars that indicate dev mode
      const isDevMode = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

      return isDevMode;
    }

    // Default to disabled if environment cannot be determined
    return false;
  }

  /**
   * Get minimum log level from environment
   */
  private getMinLogLevel(): LogLevel {
    if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
      const level = process.env.LOG_LEVEL.toLowerCase();
      if (level in LOG_LEVELS) {
        return level as LogLevel;
      }
    }
    return 'info'; // Default minimum level
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Format log message with optional prefix
   */
  private formatMessage(message: string): string {
    return this.config.prefix ? `[${this.config.prefix}] ${message}` : message;
  }

  /**
   * Debug level logging - detailed information for debugging
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  /**
   * Info level logging - general informational messages
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  /**
   * Warning level logging - potentially harmful situations
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  /**
   * Error level logging - error events that might still allow the app to continue
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), error, ...args);

      // TODO: In production, send errors to monitoring service (Sentry, LogRocket, etc.)
      // if (process.env.NODE_ENV === 'production') {
      //   sendToErrorTracking(message, error);
      // }
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;

    return new Logger({
      prefix: childPrefix,
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with a specific context/prefix
 * @example
 * const authLogger = createLogger('Auth');
 * authLogger.info('User logged in');
 * // Output: [Auth] User logged in
 */
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}

/**
 * Export Logger class for custom instances
 */
export { Logger };
export type { LogLevel, LoggerConfig };
