import * as fs from 'fs';
import * as path from 'path';
import { createLogger, format, transports, Logger } from 'winston';

function mapLogLevelFromEnv(): string {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();

  switch (raw) {
    case 'all':
      return 'silly';
    case 'info':
      return 'info';
    case 'warning':
      return 'warn';
    case 'error':
      return 'error';
    case 'debug':
    default:
      return 'debug';
  }
}

const rootDir = process.cwd();
const logsRoot = path.join(rootDir, 'logs');
if (!fs.existsSync(logsRoot)) {
  fs.mkdirSync(logsRoot, { recursive: true });
}


const runDir = path.join(logsRoot);
if (!fs.existsSync(runDir)) {
  fs.mkdirSync(runDir, { recursive: true });
}

const logFilePath = path.join(runDir, 'execution.log');

const level = mapLogLevelFromEnv();

const levelShort = (lvl: string) => {
  const upper = lvl.toUpperCase();
  if (upper.startsWith('INFO')) return 'INF';
  if (upper.startsWith('WARN')) return 'WRN';
  if (upper.startsWith('ERROR')) return 'ERR';
  if (upper.startsWith('DEBUG')) return 'DBG';
  if (upper.startsWith('SILLY')) return 'ALL';
  return upper.slice(0, 3);
};

export const logger: Logger = createLogger({
  level,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.printf((info) => {
      const lvl = levelShort(info.level);
      const msg = info.message;
      const meta = { ...info };
      delete (meta as any).level;
      delete (meta as any).message;
      delete (meta as any).timestamp;

      const metaString =
        Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

      return `${info.timestamp} | ${lvl} | ${msg}${metaString}`;
    })
  ),
  transports: [
    new transports.File({ filename: logFilePath,level,handleExceptions: true }),
    new transports.Console()
  ],
  exitOnError: false
});

export const Log = {
  info: (msg: string, meta?: unknown) => logger.info(msg, meta),
  debug: (msg: string, meta?: unknown) => logger.debug(msg, meta),
  warn: (msg: string, meta?: unknown) => logger.warn(msg, meta),
  error: (msg: string, meta?: unknown) => logger.error(msg, meta)
};

logger.info('Logger initialized', { logFilePath, level });
