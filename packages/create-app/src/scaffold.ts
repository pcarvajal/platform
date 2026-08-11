import { basename, dirname, join, resolve } from "node:path";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

export interface ScaffoldOptions {
  projectName: string;
  // Ruta al checkout de `platform` (relativa al cwd desde el que se corre el CLI, o absoluta).
  // Default: `../platform`, asumiendo que ambos repos son hermanos.
  platformPath?: string;
}

// Los paquetes que un servicio HTTP local mínimo necesita — ver company-platform/SKILL.md §
// Instalación. `adapter-aws` queda fuera del set por defecto (solo hace falta si el target de
// despliegue es AWS Lambda) — agregarlo a mano si el proyecto lo necesita.
const VENDORED_PACKAGES = [
  "core",
  "infrastructure",
  "env",
  "adapters/node",
  "testing",
  "eslint-config",
  "doctor",
];

const EXCLUDED_ENTRIES = new Set(["dist", "node_modules", ".turbo", "CHANGELOG.md"]);

/**
 * Genera un proyecto nuevo siguiendo company-platform/SKILL.md § Estructura de carpetas, y
 * *copia* (no referencia con `file:`) los paquetes `@platform/*` necesarios dentro del propio
 * workspace pnpm del proyecto generado, usando `workspace:*` — es la vía de instalación
 * documentada en SKILL.md que hoy funciona de punta a punta ("si tu proyecto ya es un workspace
 * pnpm"). El protocolo `file:` apuntando *fuera* del workspace se rompe en cuanto el paquete
 * referenciado tiene a su vez una dependencia `workspace:*` interna (p. ej.
 * `@platform/infrastructure` → `@platform/core`) — `workspace:*` solo se reescribe a un rango
 * semver real al publicar (ver `.claude/plan-implementacion-rediseno.md` Fase 0), y estos paquetes
 * todavía no se publican a ningún registro.
 */
export function scaffold(options: ScaffoldOptions): void {
  const targetDir = options.projectName;
  const platformRoot = resolve(options.platformPath ?? "../platform");

  if (!existsSync(join(platformRoot, "packages", "core"))) {
    throw new Error(
      `No encontré un checkout de platform en "${platformRoot}" (packages/core no existe). ` +
        "Pasá --platform-path apuntando a tu clon de platform.",
    );
  }

  for (const pkg of VENDORED_PACKAGES) {
    copyPackage(join(platformRoot, "packages", pkg), join(targetDir, "packages", pkg));
  }

  // Cada tsconfig.json vendorizado extiende "../../tsconfig.base.json" (o "../../../..." bajo
  // adapters/) relativo a su propia carpeta — copiar tsconfig.base.json a la misma profundidad
  // (la raíz del proyecto generado) hace que esas rutas relativas seguir resolviendo igual que
  // dentro del monorepo original, sin tener que reescribir cada tsconfig.json copiado.
  cpSync(join(platformRoot, "tsconfig.base.json"), join(targetDir, "tsconfig.base.json"));

  for (const file of projectFiles(options.projectName)) {
    write(join(targetDir, file.path), file.content);
  }
}

function copyPackage(src: string, dest: string): void {
  cpSync(src, dest, {
    recursive: true,
    filter: (source) => !EXCLUDED_ENTRIES.has(basename(source)),
  });
}

interface ProjectFile {
  path: string;
  content: string;
}

function projectFiles(projectName: string): ProjectFile[] {
  return [
    { path: "src/index.ts", content: indexTs() },
    { path: "src/apps/.gitkeep", content: "" },
    { path: "src/core/application/.gitkeep", content: "" },
    { path: "src/infrastructure/env.ts", content: envTs() },
    { path: "src/infrastructure/deployment/local/server.ts", content: serverTs() },
    { path: "package.json", content: packageJson(projectName) },
    { path: "pnpm-workspace.yaml", content: pnpmWorkspaceYaml() },
    { path: "tsconfig.json", content: tsconfigJson() },
    { path: "eslint.config.js", content: eslintConfigJs() },
    { path: ".gitignore", content: gitignore() },
    { path: "README.md", content: readmeMd(projectName) },
  ];
}

function write(fullPath: string, content: string): void {
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

function indexTs(): string {
  return `// Barrel de exports públicos de esta aplicación (tipos/símbolos que otro servicio podría
// importar). Sin lógica de arranque — eso vive en infrastructure/deployment/*. Ver
// company-platform/SKILL.md § index.ts.
export {};
`;
}

function envTs(): string {
  return `import { env, loadEnv } from "@platform/env";

const schema = env.object({
  PORT: env.port().default(3000),
});

// loadEnv valida sincrónicamente contra process.env y tira EnvValidationError si algo falta o no
// matchea — se llama una sola vez acá, al importar el módulo, para que el proceso falle al
// arrancar y no a mitad de un request. Único punto donde se lee process.env en todo el proyecto
// (ver company-platform/SKILL.md § infrastructure/env.ts).
export const config = loadEnv(schema);
`;
}

function serverTs(): string {
  return `import { NodeConsoleLoggerClient, startLocalServer } from "@platform/adapter-node";
import type { HttpRoute } from "@platform/infrastructure";
import { config } from "../../env.js";

const logger = new NodeConsoleLoggerClient();

// Agregá acá las rutas del proyecto — ver company-platform/SKILL.md § usecase.md para el patrón
// route()/controller.
const routes: HttpRoute[] = [];

logger.info(\`Starting local server on port \${config.PORT}\`);
await startLocalServer(routes, { port: config.PORT });
`;
}

function packageJson(projectName: string): string {
  return (
    JSON.stringify(
      {
        name: projectName,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          // Construye los paquetes @platform/* vendorizados, en orden de dependencia, antes que
          // este proyecto los importe — necesario porque no hay registro/publish todavía (ver
          // comentario de `scaffold`). `eslint-config` no tiene build (JS plano, sin tsc).
          postinstall:
            "for p in core env infrastructure adapters/node testing doctor; do " +
            '(cd "packages/$p" && pnpm run build); done',
          build: "tsc",
          lint: "eslint .",
          dev: "tsc && node dist/infrastructure/deployment/local/server.js",
          // Invoca el archivo compilado directo en vez de depender del symlink de bin de
          // node_modules/.bin/doctor — pnpm crea ese symlink *antes* de correr `postinstall`
          // (que es lo que compila packages/doctor/dist), así que el symlink no se resuelve bien
          // en la primera instalación.
          doctor: "node packages/doctor/dist/src/cli.js src",
        },
        dependencies: {
          "@platform/core": "workspace:*",
          "@platform/infrastructure": "workspace:*",
          "@platform/env": "workspace:*",
          "@platform/adapter-node": "workspace:*",
        },
        devDependencies: {
          "@platform/eslint-config": "workspace:*",
          "@platform/doctor": "workspace:*",
          "@platform/testing": "workspace:*",
          "@types/node": "^22.10.0",
          typescript: "^5.7.0",
          eslint: "^10.8.0",
        },
      },
      null,
      2,
    ) + "\n"
  );
}

function pnpmWorkspaceYaml(): string {
  // allowBuilds: mismo allowlist que el pnpm-workspace.yaml del propio monorepo platform — sin
  // esto, pnpm bloquea el postinstall nativo de una dependencia transitiva de eslint-config
  // (unrs-resolver) y pide `pnpm approve-builds` a mano.
  return `packages:\n  - "packages/*"\n  - "packages/adapters/*"\nallowBuilds:\n  unrs-resolver: true\n`;
}

function tsconfigJson(): string {
  return (
    JSON.stringify(
      {
        extends: "./tsconfig.base.json",
        compilerOptions: { outDir: "dist", rootDir: "src", declaration: false },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ) + "\n"
  );
}

function eslintConfigJs(): string {
  return `import platformConfig from "@platform/eslint-config";

// "packages/**" es código vendorizado de @platform/* (ver README de este proyecto) — no es
// código propio de este proyecto, así que no debe lintearse con las reglas de límites que
// aplican a un *consumidor* (esos paquetes legítimamente extienden PlatformError/AdapterError,
// por ejemplo, algo prohibido en código consumidor).
export default [{ ignores: ["packages/**"] }, ...platformConfig];
`;
}

function gitignore(): string {
  return "dist\nnode_modules\n.env\n";
}

function readmeMd(projectName: string): string {
  return `# ${projectName}

Generado con \`@platform/create-app\` siguiendo la convención de \`company-platform/SKILL.md\`.
Los paquetes \`@platform/*\` que este proyecto necesita quedaron copiados en \`packages/\` como
workspace propio (\`workspace:*\`, ver \`pnpm-workspace.yaml\`) — es la vía de instalación que hoy
funciona de punta a punta (ver el comentario en \`scaffold.ts\` de \`@platform/create-app\` para el
porqué). Cuando estos paquetes se publiquen a un registro real (\`.claude/plan-implementacion-rediseno.md\`
Fase 0), \`packages/\` deja de hacer falta y pasan a instalarse como cualquier dependencia de npm.

1. \`pnpm install\` — instala dependencias y construye los paquetes vendorizados (\`postinstall\`).
2. \`pnpm run doctor\` — confirma que \`src/\` sigue la convención de \`company-platform/SKILL.md\`
   § Estructura de carpetas.
3. \`pnpm dev\` — levanta el servidor local en el puerto de \`PORT\` (default 3000).

Si necesitás desplegar en AWS Lambda, copiá también \`packages/adapters/aws\` desde tu checkout de
\`platform\` a \`packages/adapters/aws\` acá, agregalo a \`dependencies\` como
\`"@platform/adapter-aws": "workspace:*"\`, y corré \`pnpm install\` de nuevo.
`;
}
