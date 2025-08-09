/**
 * Simple logging utility for the MPI project
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [MPI]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('info', message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message), ...args);
  }

  error(message: string, error?: any, ...args: any[]): void {
    console.error(this.formatMessage('error', message), error, ...args);
  }

  // API-specific logging methods
  apiCall(method: string, url: string): void {
    this.info(`🔗 API Call: ${method} ${url}`);
  }

  apiSuccess(method: string, url: string, responseSize?: number): void {
    const size = responseSize ? ` (${responseSize} items)` : '';
    this.info(`✅ API Success: ${method} ${url}${size}`);
  }

  apiFailure(method: string, url: string, error: any): void {
    this.error(`❌ API Failed: ${method} ${url}`, error);
  }

  mpiCalculation(listingId: string, timeframe: number, mpi: number): void {
    this.debug(`📊 MPI Calculated: listing=${listingId}, timeframe=${timeframe}d, mpi=${mpi.toFixed(2)}`);
  }

  fallbackUsed(source: string, reason: string): void {
    this.warn(`⚠️ Fallback Used: ${source} (reason: ${reason})`);
  }

  performance(operation: string, duration: number): void {
    this.debug(`⏱️ Performance: ${operation} took ${duration}ms`);
  }
}

export const logger = new Logger();
export default logger;
