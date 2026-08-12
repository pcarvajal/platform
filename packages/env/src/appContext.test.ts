import { describe, expect, it } from "vitest";
import { appContext } from "./appContext.js";
import { loadEnv } from "./loadEnv.js";
import { string } from "./schema/primitives.js";

describe("appContext", () => {
  it("carga el contexto obligatorio junto a las vars propias del proyecto", () => {
    const config = loadEnv(appContext({ PORT: string() }), {
      APP_SERVICE_NAME: "orders-service",
      APP_ENVIRONMENT: "local",
      APP_LOG_LEVEL: "debug",
      PORT: "3000",
    });

    expect(config).toEqual({
      APP_SERVICE_NAME: "orders-service",
      APP_ENVIRONMENT: "local",
      APP_LOG_LEVEL: "debug",
      PORT: "3000",
    });
  });

  it("falla si falta cualquiera de las tres keys obligatorias", () => {
    expect(() =>
      loadEnv(appContext(), {
        APP_ENVIRONMENT: "local",
        APP_LOG_LEVEL: "debug",
      }),
    ).toThrow(/APP_SERVICE_NAME/);
  });

  it("falla si APP_LOG_LEVEL no es uno de los LogLevel válidos", () => {
    expect(() =>
      loadEnv(appContext(), {
        APP_SERVICE_NAME: "orders-service",
        APP_ENVIRONMENT: "local",
        APP_LOG_LEVEL: "verbose",
      }),
    ).toThrow(/APP_LOG_LEVEL/);
  });

  it("extra no puede pisar las tres keys fijas — siguen siendo obligatorias aunque extra las redeclare", () => {
    // Si `extra` pudiera pisarlas, APP_SERVICE_NAME quedaría opcional acá y esto no tiraría.
    const shadowed = appContext({ APP_SERVICE_NAME: string().optional() });

    expect(() =>
      loadEnv(shadowed, {
        APP_ENVIRONMENT: "local",
        APP_LOG_LEVEL: "debug",
      }),
    ).toThrow(/APP_SERVICE_NAME/);
  });

  it("sin `extra`, produce exactamente las tres keys del contexto", () => {
    const config = loadEnv(appContext(), {
      APP_SERVICE_NAME: "orders-service",
      APP_ENVIRONMENT: "production",
      APP_LOG_LEVEL: "error",
    });

    expect(config).toEqual({
      APP_SERVICE_NAME: "orders-service",
      APP_ENVIRONMENT: "production",
      APP_LOG_LEVEL: "error",
    });
  });
});
