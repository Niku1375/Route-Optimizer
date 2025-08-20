/**
 * Centralized logging utility using Winston
 */

import * as winston from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({
    filename: 'logs/all.log',
  }),
];

// Create logger instance
const Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: logFormat,
  transports,
});

export default Logger;

// Convenience methods
export const logInfo = (message: string, meta?: any) => {
  Logger.info(message, meta);
};

export const logError = (message: string, error?: Error, meta?: any) => {
  Logger.error(message, { error: error?.stack, ...meta });
};

export const logWarn = (message: string, meta?: any) => {
  Logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  Logger.debug(message, meta);
};

export const logHttp = (message: string, meta?: any) => {
  Logger.http(message, meta);
};