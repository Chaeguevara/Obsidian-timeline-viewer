/**
 * Logger utility for Timeline Viewer plugin
 * Provides consistent logging with prefixes and log levels
 */

const PREFIX = '[Timeline Viewer]';

export const Logger = {
  /**
   * Info level - for function start/end, normal operations
   */
  info: (message: string, ...args: unknown[]) => {
    console.info(`${PREFIX} ℹ️ ${message}`, ...args);
  },

  /**
   * Debug level - for detailed debugging information
   */
  debug: (message: string, ...args: unknown[]) => {
    console.debug(`${PREFIX} 🔍 ${message}`, ...args);
  },

  /**
   * Warn level - for caught errors, unexpected but handled situations
   */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${PREFIX} ⚠️ ${message}`, ...args);
  },

  /**
   * Error level - for actual errors
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(`${PREFIX} ❌ ${message}`, ...args);
  },

  /**
   * Success level - for successful operations
   */
  success: (message: string, ...args: unknown[]) => {
    console.info(`${PREFIX} ✅ ${message}`, ...args);
  },

  /**
   * Group start - for grouping related logs
   */
  group: (label: string) => {
    console.group(`${PREFIX} ${label}`);
  },

  /**
   * Group end
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * Table - for displaying data in table format
   */
  table: (data: unknown) => {
    console.table(data);
  }
};
