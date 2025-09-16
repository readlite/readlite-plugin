/**
 * Logger utility for ReadLite
 * Provides consistent logging across the application with namespace support
 */

// Log levels in order of verbosity
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Current log level - can be overridden via configuration
let currentLogLevel = LogLevel.INFO;

// Whether to enable console logging (can be disabled for production)
const ENABLE_CONSOLE = process.env.NODE_ENV !== "production";

/**
 * Set the global log level
 * @param level New log level to use
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Create a namespaced logger instance
 * @param namespace The namespace for this logger (typically module name)
 * @returns Logger object with logging methods
 */
export function createLogger(namespace: string) {
  const formatMessage = (message: string, ...args: any[]): string => {
    return `[${namespace}] ${message}`;
  };

  return {
    /**
     * Log error message
     * @param message Log message
     * @param args Additional arguments to log
     */
    error(message: string, ...args: any[]): void {
      if (currentLogLevel >= LogLevel.ERROR && ENABLE_CONSOLE) {
        console.error(formatMessage(message), ...args);
      }
    },

    /**
     * Log warning message
     * @param message Log message
     * @param args Additional arguments to log
     */
    warn(message: string, ...args: any[]): void {
      if (currentLogLevel >= LogLevel.WARN && ENABLE_CONSOLE) {
        console.warn(formatMessage(message), ...args);
      }
    },

    /**
     * Log info message
     * @param message Log message
     * @param args Additional arguments to log
     */
    info(message: string, ...args: any[]): void {
      if (currentLogLevel >= LogLevel.INFO && ENABLE_CONSOLE) {
        console.info(formatMessage(message), ...args);
      }
    },

    /**
     * Log debug message
     * @param message Log message
     * @param args Additional arguments to log
     */
    debug(message: string, ...args: any[]): void {
      if (currentLogLevel >= LogLevel.DEBUG && ENABLE_CONSOLE) {
        console.debug(formatMessage(message), ...args);
      }
    },
  };
}

// Create default root logger
export const logger = createLogger("app");
