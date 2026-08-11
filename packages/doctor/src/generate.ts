import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function lowerFirst(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function writeGenerated(path: string, content: string): void {
  if (existsSync(path)) {
    throw new Error(`${path} ya existe — no lo piso. Borralo primero si querés regenerarlo.`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// Genera la forma por defecto de un caso de uso (references/usecase.md) — BaseUseCase, no el
// UseCase manual, porque es el camino con menos código para el caso común.
export function generateUseCase(srcDir: string, name: string): string {
  const path = join(srcDir, "core", "application", `${name}.ts`);
  writeGenerated(
    path,
    `import { BaseUseCase, type Logger } from "@platform/core";

// TODO: completar el shape del command
export type ${name}Command = Record<string, unknown>;

export class ${name} extends BaseUseCase<${name}Command, unknown> {
  constructor(logger?: Logger) {
    super(logger);
  }

  protected async handle(_command: ${name}Command): Promise<unknown> {
    // TODO: implementar
    throw new Error("${name}.handle not implemented");
  }
}
`,
  );
  return path;
}

// Genera la forma por defecto de un endpoint HTTP de un solo caso de uso (references/usecase.md,
// references/http.md) — route(), no un controller-clase manual.
export function generateController(srcDir: string, name: string): string {
  const varName = lowerFirst(name);
  const path = join(srcDir, "apps", `${varName}Route.ts`);
  writeGenerated(
    path,
    `import { parseJsonBody, route, type HttpRoute } from "@platform/infrastructure";
import { z } from "zod";
import type { ${name} } from "../core/application/${name}.js";

const ${name}Body = z.object({
  // TODO: completar el schema — debe matchear ${name}Command
});

export const ${varName}Route = (${varName}: ${name}): HttpRoute => ({
  method: "POST",
  path: "/TODO",
  handle: route(${varName}, (request) => parseJsonBody(request, ${name}Body)),
});
`,
  );
  return path;
}

// Genera la forma por defecto de un consumer async (references/eventos.md) — MessageRoute +
// bySource, con el mismo caso de uso que generateController usaría para HTTP.
export function generateConsumer(srcDir: string, name: string): string {
  const varName = lowerFirst(name);
  const path = join(srcDir, "apps", `${varName}Route.ts`);
  writeGenerated(
    path,
    `import { bySource, type MessageRoute } from "@platform/infrastructure";
import type { ${name}, ${name}Command } from "../core/application/${name}.js";

// TODO: reemplazar por el ARN real de la cola/tópico que dispara este consumer.
const SOURCE = "TODO";

export const ${varName}Route = (${varName}: ${name}): MessageRoute => ({
  matches: bySource(SOURCE),
  handle: (envelope) => ${varName}.execute(envelope.body as ${name}Command),
});
`,
  );
  return path;
}
