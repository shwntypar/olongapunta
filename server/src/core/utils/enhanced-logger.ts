/**
 * Enhanced Logger with Daily File Rotation
 * Separates general logs from error logs with daily file creation
 * Tracks API visits and user activities
 */
import pino from "pino";
import { config } from "../../config/environment";
import fs from "fs";
import path from "path";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  method?: string;
  url?: string;
  statusCode?: number;
  userId?: number;
  userEmail?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  requestId?: string;
  meta?: any;
}

interface ApiLogEntry extends LogEntry {
  apiEndpoint: string;
  requestBody?: any;
  responseBody?: any;
  requestHeaders?: Record<string, string>;
}

/**
 * Enhanced Logger Class with Daily Rotation
 */
export class EnhancedLogger {
  private logsDir: string;
  private currentDate: string | undefined;
  private generalLogFile!: string;
  private errorLogFile!: string;
  private apiLogFile!: string;
  private baseLogger!: pino.Logger;

  constructor() {
    this.logsDir = path.join(process.cwd(), "logs");
    this.currentDate = this.getCurrentDateString();
    this.ensureLogDirectories();
    this.updateLogFiles();
    this.initializeBaseLogger();
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getCurrentDateString(): string | undefined {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }

  /**
   * Ensure log directories exist
   */
  private ensureLogDirectories(): void {
    const directories = [
      this.logsDir,
      path.join(this.logsDir, "general"),
      path.join(this.logsDir, "errors"),
      path.join(this.logsDir, "api"),
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Update log file paths for current date
   */
  private updateLogFiles(): void {
    this.generalLogFile = path.join(
      this.logsDir,
      "general",
      `${this.currentDate}.log`,
    );
    this.errorLogFile = path.join(
      this.logsDir,
      "errors",
      `${this.currentDate}.log`,
    );
    this.apiLogFile = path.join(this.logsDir, "api", `${this.currentDate}.log`);
  }

  /**
   * Initialize base Pino logger
   */
  private initializeBaseLogger(): void {
    const prettyConfig = {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
      messageFormat: "{msg}",
      levelFirst: true,
      crlf: false,
      errorLikeObjectKeys: ["err", "error"],
    };

    const streams = [];

    // Console output for non-production
    if (config.env !== "production") {
      streams.push({
        level: "info",
        stream: pino.transport({
          target: "pino-pretty",
          options: prettyConfig,
        }),
      });
    }

    // General logs
    streams.push({
      level: "info",
      stream: pino.destination({
        dest: this.generalLogFile,
        sync: false,
        mkdir: true,
      }),
    });

    // Error logs
    streams.push({
      level: "error",
      stream: pino.destination({
        dest: this.errorLogFile,
        sync: false,
        mkdir: true,
      }),
    });

    this.baseLogger = pino(
      {
        level: "info",
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (label) => ({ level: label }),
        },
        serializers: {
          err: pino.stdSerializers.err,
          error: pino.stdSerializers.err,
        },
      },
      pino.multistream(streams),
    );
  }

  /**
   * Check if date has changed and rotate logs if needed
   */
  private checkDateRotation(): void {
    const currentDate = this.getCurrentDateString();
    if (currentDate !== this.currentDate) {
      this.currentDate = currentDate;
      this.updateLogFiles();
      this.initializeBaseLogger();
    }
  }

  /**
   * Write to specific log file
   */
  private writeToFile(filePath: string, entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + "\n";
    fs.appendFileSync(filePath, logLine, "utf8");
  }

  /**
   * Log API request/response
   */
  public logApiRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    userId?: number;
    userEmail?: string;
    ip?: string;
    userAgent?: string;
    duration: number;
    requestId?: string;
    requestBody?: any;
    responseBody?: any;
    requestHeaders?: Record<string, string>;
  }): void {
    this.checkDateRotation();

    const apiEntry: ApiLogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: `API Request: ${data.method} ${data.url} - ${data.statusCode}`,
      apiEndpoint: `${data.method} ${data.url}`,
      ...data,
    };

    // Log to general log
    this.baseLogger.info(apiEntry.message);

    // Write to API-specific log file
    this.writeToFile(this.apiLogFile, apiEntry);
  }

  /**
   * Log general information
   */
  public info(message: string, meta?: any): void {
    this.checkDateRotation();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      meta,
    };

    this.baseLogger.info(message, meta);
    this.writeToFile(this.generalLogFile, entry);
  }

  /**
   * Log warnings
   */
  public warn(message: string, meta?: any): void {
    this.checkDateRotation();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      meta,
    };

    this.baseLogger.warn(message, meta);
    this.writeToFile(this.generalLogFile, entry);
  }

  /**
   * Log errors
   */
  public error(message: string | Error, meta?: any): void {
    this.checkDateRotation();

    let errorMessage: string;
    let errorStack: string | undefined;

    if (message instanceof Error) {
      errorMessage = message.message;
      errorStack = message.stack;
    } else {
      errorMessage = message;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message: errorMessage,
      meta: {
        ...meta,
        ...(errorStack && { stack: errorStack }),
      },
    };

    this.baseLogger.error(errorMessage, entry.meta);
    this.writeToFile(this.errorLogFile, entry);
  }

  /**
   * Log debug information
   */
  public debug(message: string, meta?: any): void {
    this.checkDateRotation();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "debug",
      message,
      meta,
    };

    this.baseLogger.debug(message, meta);
    this.writeToFile(this.generalLogFile, entry);
  }

  /**
   * Log user authentication events
   */
  public logAuthEvent(
    event: "LOGIN" | "LOGOUT" | "LOGIN_FAILED" | "TOKEN_REFRESH",
    data: {
      userId?: number;
      userEmail?: string;
      ip?: string;
      userAgent?: string;
      reason?: string;
    },
  ): void {
    this.checkDateRotation();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: event === "LOGIN_FAILED" ? "warn" : "info",
      message: `Auth Event: ${event}`,
      userId: data.userId,
      userEmail: data.userEmail,
      ip: data.ip,
      userAgent: data.userAgent,
      meta: {
        event,
        reason: data.reason,
      },
    };

    if (event === "LOGIN_FAILED") {
      this.baseLogger.warn(entry.message, entry.meta);
    } else {
      this.baseLogger.info(entry.message, entry.meta);
    }

    this.writeToFile(this.generalLogFile, entry);
  }

  /**
   * Get log statistics for a specific date
   */
  public async getLogStats(date?: string): Promise<{
    date: string;
    generalLogs: number;
    errorLogs: number;
    apiLogs: number;
    totalRequests: number;
    errorRate: number;
  }> {
    const targetDate = date || this.getCurrentDateString();

    const generalLogPath = path.join(
      this.logsDir,
      "general",
      `${targetDate}.log`,
    );
    const errorLogPath = path.join(this.logsDir, "errors", `${targetDate}.log`);
    const apiLogPath = path.join(this.logsDir, "api", `${targetDate}.log`);

    let generalLogs = 0;
    let errorLogs = 0;
    let apiLogs = 0;
    let totalRequests = 0;
    let errorRequests = 0;

    // Count general logs
    if (fs.existsSync(generalLogPath)) {
      const content = fs.readFileSync(generalLogPath, "utf8");
      generalLogs = content.split("\n").filter((line) => line.trim()).length;
    }

    // Count error logs
    if (fs.existsSync(errorLogPath)) {
      const content = fs.readFileSync(errorLogPath, "utf8");
      errorLogs = content.split("\n").filter((line) => line.trim()).length;
    }

    // Count API logs and analyze status codes
    if (fs.existsSync(apiLogPath)) {
      const content = fs.readFileSync(apiLogPath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());
      apiLogs = lines.length;
      totalRequests = lines.length;

      lines.forEach((line) => {
        try {
          const entry = JSON.parse(line);
          if (entry.statusCode && entry.statusCode >= 400) {
            errorRequests++;
          }
        } catch (e) {
          // Ignore malformed lines
        }
      });
    }

    const errorRate =
      totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    return {
      date: targetDate || this.currentDate || "unknown",
      generalLogs,
      errorLogs,
      apiLogs,
      totalRequests,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Clean up old log files (older than specified days)
   */
  public cleanupOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const directories = ["general", "errors", "api"];

    directories.forEach((dir) => {
      const dirPath = path.join(this.logsDir, dir);
      if (!fs.existsSync(dirPath)) return;

      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        if (file.endsWith(".log")) {
          const fileDate = file.replace(".log", "");
          const logDate = new Date(fileDate);

          if (logDate < cutoffDate) {
            const filePath = path.join(dirPath, file);
            fs.unlinkSync(filePath);
            this.info(`Cleaned up old log file: ${filePath}`);
          }
        }
      });
    });
  }
}

// Export singleton instance
export const enhancedLogger = new EnhancedLogger();
