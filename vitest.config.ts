import { defineConfig } from "vitest/config";

// Tests de contrato co-ubicados con el código que prueban (packages/*/src/**/*.test.ts) — no un
// paquete @platform/contract-tests aparte, ver CONTRIBUTING.md. "examples/" queda afuera: es
// código de demostración, no contrato de librería.
export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
