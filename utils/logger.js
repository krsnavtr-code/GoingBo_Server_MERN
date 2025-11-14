import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'winston';
import 'winston-daily-rotate-file';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',  
  format: logFormat,
  defaultMeta: { service: 'tbo-flight-api' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    // File transport for all logs
    new winston.transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    }),
    // Error log file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error' 
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export default logger;
