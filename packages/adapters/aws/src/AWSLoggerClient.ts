import { Logger as AWSLogger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";
import type { LogContext } from "@platform/core";
import { Logger } from "@platform/core";

type AWSLoggerConfig = {
  serviceName: string;
  logLevel?: LogLevel;
  sensitiveKeys?: string[];
};

export class AWSLoggerClient extends Logger {
  private readonly logger: AWSLogger;

  constructor(private readonly config: AWSLoggerConfig) {
    super(config.sensitiveKeys);
    this.logger = new AWSLogger({
      serviceName: this.config.serviceName,
      logLevel: this.config.logLevel,
    });
  }

  override info(message: string, context?: LogContext): void {
    this.logger.info(message, { extra: this.mask(context) });
  }

  override error(message: string, context?: LogContext): void {
    this.logger.error(message, { extra: this.mask(context) });
  }

  override warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { extra: this.mask(context) });
  }

  override debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { extra: this.mask(context) });
  }
}
