enum LogLevel {
  Debug = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
}

const LogMethods: Record<LogLevel, (message: string, ...args: unknown[]) => void> = {
  [LogLevel.Debug]: console.debug,
  [LogLevel.Info]: console.info,
  [LogLevel.Warning]: console.warn,
  [LogLevel.Error]: console.error,
};

function getLogLevel(level: LogLevel): string {
  switch (level) {
    case LogLevel.Debug:
      return 'DEBUG';
    case LogLevel.Info:
      return 'INFO';
    case LogLevel.Warning:
      return 'WARN';
    case LogLevel.Error:
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

function internalLog(level: LogLevel, source: string, message: string, ...args: unknown[]): void {
  LogMethods[level](new Date().toISOString(), getLogLevel(level), source, message, ...args);
}

export function logDebug(source: string, message: string, ...args: unknown[]): void {
  internalLog(LogLevel.Debug, source, message, ...args);
}

export function logInfo(source: string, message: string, ...args: unknown[]): void {
  internalLog(LogLevel.Info, source, message, ...args);
}

export function logWarn(source: string, message: string, ...args: unknown[]): void {
  internalLog(LogLevel.Warning, source, message, ...args);
}

export function logError(source: string, message: string, ...args: unknown[]): void {
  internalLog(LogLevel.Error, source, message, ...args);
}

export class Logger {
  constructor(private readonly source: string) {}

  static create(source: string): Logger {
    return new Logger(source);
  }

  debug(message: string, ...args: unknown[]): void {
    logDebug(this.source, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    logInfo(this.source, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    logWarn(this.source, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    logError(this.source, message, ...args);
  }

  // *** Aliases ***
  ctor(...args: unknown[]): void {
    logDebug(this.source, 'ctor', ...args);
  }

  onInit(): void {
    logDebug(this.source, 'ngOnInit');
  }
}
