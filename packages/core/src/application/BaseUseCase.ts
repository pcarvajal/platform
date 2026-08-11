import type { RequestContext } from "../platform/index.js";
import {
  toApplicationFailure,
  toApplicationSuccess,
  type ApplicationResult,
} from "./ApplicationResult.js";
import type { Logger } from "./Logger.js";
import type { UseCase } from "./UseCase.js";

// Forma por defecto de un UseCase: el try/catch + toApplicationSuccess/toApplicationFailure es
// idéntico en todo caso de uso (ver SKILL.md § UseCase y ApplicationResult), así que vive acá una
// sola vez en vez de repetirse en cada `execute`. `this.constructor.name` en el mensaje de log
// evita el typo clásico de copiar/pegar un nombre de caso de uso distinto al loguear el error.
export abstract class BaseUseCase<TCommand, TData> implements UseCase<TCommand, TData> {
  constructor(protected readonly logger?: Logger) {}

  protected abstract handle(command: TCommand, context?: RequestContext): Promise<TData>;

  async execute(command: TCommand, context?: RequestContext): Promise<ApplicationResult<TData>> {
    const logger = context ? this.logger?.bind(context) : this.logger;
    try {
      return toApplicationSuccess(await this.handle(command, context));
    } catch (err) {
      logger?.error(`${this.constructor.name} failed`, { err });
      return toApplicationFailure(err);
    }
  }
}
