import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "./doctor.js";

describe("runDoctor — contexto de aplicación obligatorio", () => {
  let projectRoot: string;

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  });

  function makeProject(envTsContents: string | undefined): string {
    projectRoot = mkdtempSync(join(tmpdir(), "doctor-test-"));
    const srcDir = join(projectRoot, "src");
    mkdirSync(join(srcDir, "apps"), { recursive: true });
    mkdirSync(join(srcDir, "core/application"), { recursive: true });
    mkdirSync(join(srcDir, "infrastructure"), { recursive: true });
    writeFileSync(join(srcDir, "index.ts"), "export {};\n");
    if (envTsContents !== undefined) {
      writeFileSync(join(srcDir, "infrastructure/env.ts"), envTsContents);
    }
    return srcDir;
  }

  it("no reporta faltantes cuando env.ts declara las tres keys (vía env.appContext)", () => {
    const srcDir = makeProject(
      `import { env, loadEnv } from "@platform/env";\n` +
        `const schema = env.appContext({ PORT: env.port().default(3000) });\n` +
        `export const config = loadEnv(schema);\n`,
    );

    const report = runDoctor(srcDir, projectRoot);
    expect(report.missingAppContextKeys).toEqual([]);
  });

  it("no reporta faltantes si las tres keys aparecen a mano, sin el preset", () => {
    const srcDir = makeProject(
      `import { env, loadEnv } from "@platform/env";\n` +
        `const schema = env.object({\n` +
        `  APP_SERVICE_NAME: env.string(),\n` +
        `  APP_ENVIRONMENT: env.string(),\n` +
        `  APP_LOG_LEVEL: env.enum(["debug", "info", "warn", "error", "silent"]),\n` +
        `});\n` +
        `export const config = loadEnv(schema);\n`,
    );

    const report = runDoctor(srcDir, projectRoot);
    expect(report.missingAppContextKeys).toEqual([]);
  });

  it("reporta las keys que faltan cuando env.ts no las declara", () => {
    const srcDir = makeProject(
      `import { env, loadEnv } from "@platform/env";\n` +
        `const schema = env.object({ PORT: env.port().default(3000) });\n` +
        `export const config = loadEnv(schema);\n`,
    );

    const report = runDoctor(srcDir, projectRoot);
    expect(report.missingAppContextKeys).toEqual([
      "APP_SERVICE_NAME",
      "APP_ENVIRONMENT",
      "APP_LOG_LEVEL",
    ]);
  });

  it("no reporta nada si env.ts no existe — ya cubierto por missingRequired", () => {
    const srcDir = makeProject(undefined);

    const report = runDoctor(srcDir, projectRoot);
    expect(report.missingAppContextKeys).toEqual([]);
    expect(report.missingRequired).toContain("infrastructure/env.ts");
  });
});
