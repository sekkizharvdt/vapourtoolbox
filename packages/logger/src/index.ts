/**
 * @vapour/logger
 *
 * Structured logging utility for Vapour Toolbox
 * Provides consistent logging across web and functions
 *
 * Features:
 * - Correlation ID support for request tracing
 * - Structured metadata with JSON output
 * - Environment-aware log level filtering
 * - Child loggers for component-specific context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMetadata {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  correlationId?: string;
  metadata?: LogMetadata;
  environment?: string;
}

export interface LoggerConfig {
  context?: string;
  correlationId?: string;
  minLevel?: LogLevel;
  environment?: string;
  enabled?: boolean;
}

/**
 * Generate a unique correlation ID
 *
 * Format: timestamp-random (e.g., "1703001234567-a1b2c3d4")
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Global correlation ID storage (for async context in browsers)
 * In Node.js, AsyncLocalStorage would be preferred
 */
let globalCorrelationId: string | undefined;

/**
 * Set the global correlation ID for the current request/operation
 */
export function setCorrelationId(id: string): void {
  globalCorrelationId = id;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return globalCorrelationId;
}

/**
 * Clear the correlation ID (call at end of request)
 */
export function clearCorrelationId(): void {
  globalCorrelationId = undefined;
}

/**
 * Execute a function with a correlation ID context
 */
export async function withCorrelationId<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previousId = globalCorrelationId;
  globalCorrelationId = id;
  try {
    return await fn();
  } finally {
    globalCorrelationId = previousId;
  }
}

/**
 * Execute a function with an auto-generated correlation ID
 */
export async function withNewCorrelationId<T>(fn: () => Promise<T>): Promise<T> {
  return withCorrelationId(generateCorrelationId(), fn);
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger class for structured logging
 */
export class Logger {
  private context?: string;
  private correlationId?: string;
  private minLevel: LogLevel;
  private environment: string;
  private enabled: boolean;

  constructor(config: LoggerConfig = {}) {
    this.context = config.context;
    this.correlationId = config.correlationId;
    this.minLevel = config.minLevel || this.detectMinLevel();
    this.environment = config.environment || this.detectEnvironment();
    this.enabled = config.enabled !== false;
  }

  /**
   * Detect minimum log level based on environment
   */
  private detectMinLevel(): LogLevel {
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production') return 'info';
      if (nodeEnv === 'test') return 'error';
    }

    if (typeof window !== 'undefined') {
      // Browser environment
      const hostname = window.location?.hostname;
      if (hostname && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
        return 'info';
      }
    }

    return 'debug';
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): string {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV || 'development';
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location?.hostname;
      if (hostname && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
        return 'production';
      }
    }
    return 'development';
  }

  /**
   * Check if log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Format log entry for output
   */
  private formatLog(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp (compact)
    const time = new Date(entry.timestamp).toISOString().split('T')[1]?.replace('Z', '') || '';
    parts.push(`[${time}]`);

    // Level
    parts.push(`[${entry.level.toUpperCase()}]`);

    // Correlation ID (if present)
    if (entry.correlationId) {
      parts.push(`[${entry.correlationId}]`);
    }

    // Context
    if (entry.context) {
      parts.push(`[${entry.context}]`);
    }

    // Message
    parts.push(entry.message);

    return parts.join(' ');
  }

  /**
   * Get effective correlation ID (instance > global)
   */
  private getEffectiveCorrelationId(): string | undefined {
    return this.correlationId || getCorrelationId();
  }

  /**
   * Emit log entry
   */
  private emit(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) return;

    const correlationId = this.getEffectiveCorrelationId();

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      correlationId,
      metadata: correlationId ? { ...metadata, correlationId } : metadata,
      environment: this.environment,
    };

    const formattedMessage = this.formatLog(entry);

    // Output to console
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, metadata || '');
        break;
      case 'info':
        console.info(formattedMessage, metadata || '');
        break;
      case 'warn':
        console.warn(formattedMessage, metadata || '');
        break;
      case 'error':
        console.error(formattedMessage, metadata || '');
        break;
    }

    // Future: Send to external monitoring service (Sentry, LogRocket, etc.)
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.emit('debug', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.emit('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.emit('warn', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: LogMetadata): void {
    this.emit('error', message, metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    return new Logger({
      context: this.context ? `${this.context}:${context}` : context,
      correlationId: this.correlationId,
      minLevel: this.minLevel,
      environment: this.environment,
      enabled: this.enabled,
    });
  }

  /**
   * Create a child logger with a specific correlation ID
   */
  withCorrelationId(correlationId: string): Logger {
    return new Logger({
      context: this.context,
      correlationId,
      minLevel: this.minLevel,
      environment: this.environment,
      enabled: this.enabled,
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Export default instance
 */
export default logger;
