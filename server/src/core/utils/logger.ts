/**
 * Winston-compatible logger built on top of Pino for high-performance logging
 * Provides multiple output streams (file, console) with level-based filtering
 */
import pino from "pino";
import { config } from "../../config/environment";
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = "logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Pretty printing configuration for development console output
const prettyConfig = {
  colorize: true,
  translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
  ignore: "pid,hostname",
  messageFormat: "{msg}",
  levelFirst: true,
  crlf: false,
  errorLikeObjectKeys: ["err", "error"],
};

/**
 * Winston-compatible interface for seamless migration from Winston
 */
interface WinstonCompatibleLogger {
  error(message: any, meta?: any): void;
  warn(message: any, meta?: any): void;
  info(message: any, meta?: any): void;
  debug(message: any, meta?: any): void;
  log(level: string, message: any, meta?: any): void;
}

type WinstonLevel = "error" | "warn" | "info" | "debug" | "verbose" | "silly";
type PinoLevel = "error" | "warn" | "info" | "debug" | "trace";

// Maps Winston log levels to Pino log levels
const levelMapping: Record<WinstonLevel, PinoLevel> = {
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
  verbose: "trace",
  silly: "trace",
} as const;

const pinoLevel: PinoLevel =
  levelMapping[config.logging.level as WinstonLevel] || "info";

// Configure multiple output streams for different log levels
const streams = [
  {
    level: "error",
    stream: pino.destination({
      dest: path.join(logsDir, "error.log"),
      sync: false,
      mkdir: true,
    }),
  },
  {
    level: pinoLevel,
    stream: pino.destination({
      dest: path.join(logsDir, "combined.log"),
      sync: false,
      mkdir: true,
    }),
  },
];

// Add console output stream
streams.push({
  level: pinoLevel,
  stream: pino.destination(1),
});

const baseLogger = pino(
  {
    level: pinoLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
  pino.multistream(streams),
);

/**
 * Winston-compatible logger instance with enhanced error handling
 * Supports objects, errors, and string messages with metadata
 */
const logger: WinstonCompatibleLogger = {
  error: (message: any, meta: any = {}): void => {
    if (typeof message === "object" && message instanceof Error) {
      baseLogger.error({ err: message, ...meta });
    } else if (typeof message === "object") {
      baseLogger.error({ ...message, ...meta });
    } else {
      baseLogger.error({ ...meta }, String(message));
    }
  },

  warn: (message: any, meta: any = {}): void => {
    if (typeof message === "object" && message instanceof Error) {
      baseLogger.warn({ err: message, ...meta });
    } else if (typeof message === "object") {
      baseLogger.warn({ ...message, ...meta });
    } else {
      baseLogger.warn({ ...meta }, String(message));
    }
  },

  info: (message: any, meta: any = {}): void => {
    if (typeof message === "object" && message instanceof Error) {
      baseLogger.info({ err: message, ...meta });
    } else if (typeof message === "object") {
      baseLogger.info({ ...message, ...meta });
    } else {
      baseLogger.info({ ...meta }, String(message));
    }
  },

  debug: (message: any, meta: any = {}): void => {
    if (typeof message === "object" && message instanceof Error) {
      baseLogger.debug({ err: message, ...meta });
    } else if (typeof message === "object") {
      baseLogger.debug({ ...message, ...meta });
    } else {
      baseLogger.debug({ ...meta }, String(message));
    }
  },

  log: (level: string, message: any, meta: any = {}): void => {
    const pinoMethod = levelMapping[level as WinstonLevel] || level;
    const logMethod = logger[pinoMethod as keyof WinstonCompatibleLogger];
    if (typeof logMethod === "function") {
      (logMethod as any)(message, meta);
    }
  },
};

export { logger };
