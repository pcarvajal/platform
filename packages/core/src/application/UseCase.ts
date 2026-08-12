import type { RequestContext } from "../platform/index.js";
import type { ApplicationResult } from "./ApplicationResult.js";

export interface UseCase<TCommand, TData> {
  // `context` es opcional y aditivo — cualquier implementación existente que solo declare
  // `execute(command: TCommand)` sigue siendo asignable a este tipo (TypeScript permite menos
  // parámetros que los declarados en la interfaz cuando el resto son opcionales).
  execute(command: TCommand, context?: RequestContext): Promise<ApplicationResult<TData>>;
}
