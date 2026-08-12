import { AdapterError, type ApplicationResultError } from "@platform/core";

// EventBridge no tiene equivalente a `batchItemFailures` de SQS — su único mecanismo de retry es
// reintentar la invocación completa si el handler lanza. Envuelve el error de aplicación (ya
// serializado por toApplicationFailure) para que ese retry tenga con qué diagnosticar la causa.
export class EventBridgeDispatchError extends AdapterError {
  readonly type = "EventBridgeDispatchError";

  constructor(readonly applicationError: ApplicationResultError["error"]) {
    super(
      "@platform/adapter-aws",
      `EventBridge event handling failed: ${applicationError.message}`,
    );
  }
}
