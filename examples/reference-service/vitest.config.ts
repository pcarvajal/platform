import { defineConfig } from "vitest/config";

// Config propia de este proyecto — vitest.config.ts de la raíz del monorepo excluye examples/ a
// propósito (es código de demostración, no contrato de librería, ver ese archivo). Un proyecto
// consumidor real trae su propia suite de tests y su propio runner, esto es exactamente eso.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
