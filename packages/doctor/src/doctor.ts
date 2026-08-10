import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type EntryKind = "dir" | "file";

interface ExpectedEntry {
  path: string;
  kind: EntryKind;
  required: boolean;
}

// SKILL.md § Estructura de carpetas. `required: false` cubre lo que SKILL.md documenta como
// explícitamente opcional (domain/, deployment/{aws,local}, clients/, persistence/, shared/) —
// doctor los reporta como informativos, no como error.
const EXPECTED: ExpectedEntry[] = [
  { path: "apps", kind: "dir", required: true },
  { path: "core", kind: "dir", required: true },
  { path: "core/application", kind: "dir", required: true },
  { path: "core/domain", kind: "dir", required: false },
  { path: "infrastructure", kind: "dir", required: true },
  { path: "infrastructure/deployment", kind: "dir", required: false },
  { path: "infrastructure/deployment/aws", kind: "dir", required: false },
  { path: "infrastructure/deployment/local", kind: "dir", required: false },
  { path: "infrastructure/clients", kind: "dir", required: false },
  { path: "infrastructure/persistence", kind: "dir", required: false },
  { path: "infrastructure/env.ts", kind: "file", required: true },
  { path: "shared", kind: "dir", required: false },
  { path: "index.ts", kind: "file", required: true },
];

// Hijos conocidos por carpeta, para detectar qué "sobra fuera de convención" (§4.1).
const KNOWN_CHILDREN: Record<string, string[]> = {
  "": ["apps", "core", "infrastructure", "shared", "index.ts"],
  core: ["application", "domain"],
  infrastructure: ["deployment", "clients", "persistence", "env.ts"],
  "infrastructure/deployment": ["aws", "local"],
};

// Señal blanda (SKILL.md § Anti-patrones, di-strategy.md §9): no bloquea, solo advierte para que
// el equipo confirme conscientemente que ya pasó el punto de dolor de la composición manual.
const DI_CONTAINER_PACKAGES = ["tsyringe", "inversify", "awilix", "reflect-metadata"];

export interface DoctorReport {
  srcDir: string;
  missingRequired: string[];
  missingOptional: string[];
  unexpected: string[];
  diContainerHints: string[];
}

export function runDoctor(srcDir: string, projectRoot: string = process.cwd()): DoctorReport {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const entry of EXPECTED) {
    const fullPath = join(srcDir, entry.path);
    if (!pathExists(fullPath, entry.kind)) {
      (entry.required ? missingRequired : missingOptional).push(entry.path);
    }
  }

  const unexpected = Object.entries(KNOWN_CHILDREN).flatMap(([relDir, known]) =>
    findUnexpectedChildren(join(srcDir, relDir), known).map((name) =>
      relDir ? `${relDir}/${name}` : name,
    ),
  );

  return {
    srcDir,
    missingRequired,
    missingOptional,
    unexpected,
    diContainerHints: findDiContainerHints(projectRoot),
  };
}

function pathExists(fullPath: string, kind: EntryKind): boolean {
  if (!existsSync(fullPath)) return false;
  const stats = statSync(fullPath);
  return kind === "dir" ? stats.isDirectory() : stats.isFile();
}

function findUnexpectedChildren(dir: string, known: string[]): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((name) => !known.includes(name));
}

function findDiContainerHints(projectRoot: string): string[] {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return [];

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  return DI_CONTAINER_PACKAGES.filter((name) => name in allDeps);
}

export function formatReport(report: DoctorReport): string {
  const lines: string[] = [
    `doctor — estructura de "${report.srcDir}" (company-platform/SKILL.md)`,
    "",
  ];

  if (report.missingRequired.length === 0) {
    lines.push(
      "✔ estructura requerida completa (apps, core/application, infrastructure, env.ts, index.ts)",
    );
  } else {
    lines.push("✘ faltan carpetas/archivos requeridos:");
    lines.push(...report.missingRequired.map((p) => `  - src/${p}`));
  }

  if (report.missingOptional.length > 0) {
    lines.push("");
    lines.push(
      "ℹ carpetas convencionales no presentes (opcionales según lo que necesite el proyecto):",
    );
    lines.push(...report.missingOptional.map((p) => `  - src/${p}`));
  }

  if (report.unexpected.length > 0) {
    lines.push("");
    lines.push("⚠ entradas fuera de la convención de SKILL.md § Estructura de carpetas:");
    lines.push(...report.unexpected.map((p) => `  - src/${p}`));
  }

  if (report.diContainerHints.length > 0) {
    lines.push("");
    lines.push(
      "⚠ dependencias de contenedor de DI detectadas — confirma que ya pasaste el punto de dolor de " +
        "la composición manual antes de usarlas (SKILL.md § Anti-patrones):",
    );
    lines.push(...report.diContainerHints.map((p) => `  - ${p}`));
  }

  return lines.join("\n");
}
