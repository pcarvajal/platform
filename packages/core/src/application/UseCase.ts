import type { ApplicationResult } from "./ApplicationResult.js";

export interface UseCase<TCommand, TData> {
  execute(command: TCommand): Promise<ApplicationResult<TData>>;
}
