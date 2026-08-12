#!/usr/bin/env node
// Copia el código fuente de todos los paquetes @platform/* (packages/*, packages/adapters/*) a
// shared/ en la raíz del repo, preservando la estructura de carpetas de packages/, para poder
// pegar esa carpeta directo en un proyecto de prueba sin depender de un workspace pnpm.
//
// Como el proyecto de prueba no resuelve "@platform/*" vía node_modules, cada import/export
// "from '@platform/xxx'" se reescribe a la ruta relativa del index.js del paquete copiado
// correspondiente (ver reescrituraImportsPlatform más abajo) — así los archivos copiados se
// siguen llamando entre ellos por ruta relativa, igual que ya lo hacen los imports internos de
// cada paquete (NodeNext exige extensión .js aunque la fuente sea .ts).
//
// Solo se copia código fuente: el barrel de entrada (index.ts/index.js) y el contenido de src/,
// filtrado por extensión. Se excluye todo lo que no sea fuente (dist/, node_modules/, .turbo/,
// README.md, CHANGELOG.md, package.json, tsconfig.json).
//
// Uso: node scripts/copy-to-shared.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(ROOT, "packages");
const OUTPUT_DIR = join(ROOT, "shared");

// create-app/src/scaffold.ts genera proyectos nuevos armando archivos como texto: algunas líneas
// de esas plantillas (p. ej. dentro de un template literal multilínea) son, carácter por
// carácter, indistinguibles de un import real ("import type { HttpRoute } from
// '@platform/infrastructure';" sin indentación, como continuación de un `return \`...`). Una
// reescritura basada en texto no puede diferenciar eso de un import genuino, así que reescribirlo
// corrompería en silencio el generador. Se excluye a propósito — si hace falta copiarlo, sacarlo
// de esta lista y revisar scaffold.ts a mano después.
const EXCLUDED_PACKAGES = new Set(["create-app", "eslint-config"]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".turbo"]);

// Solo reescribe "@platform/xxx" en líneas que, después del indent, arrancan con import/export o
// con el "}" de cierre de un import/export multilínea ("} from '@platform/core';") — así se
// ignoran ocurrencias de "@platform/xxx" en comentarios o en valores de string (p. ej.
// `origin = "@platform/infrastructure"`), que no son specifiers de módulo.
const IMPORT_LINE_START_RE = /^[ \t]*(import\b|export\b|\})/;
const PLATFORM_SPECIFIER_RE = /(["'])@platform\/([a-z0-9-]+)\1/g;

function discoverPackages() {
  const found = [];

  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = join(PACKAGES_DIR, entry.name);

    if (existsSync(join(abs, "package.json"))) {
      found.push({ relPath: entry.name, dir: abs });
      continue;
    }

    // packages/adapters/{node,aws,redis} son paquetes propios anidados un nivel más adentro (ver
    // pnpm-workspace.yaml). packages/skills/company-platform no tiene package.json (es
    // documentación, no código) y queda afuera naturalmente.
    if (entry.name === "adapters") {
      for (const adapter of readdirSync(abs, { withFileTypes: true })) {
        if (!adapter.isDirectory()) continue;
        const adapterAbs = join(abs, adapter.name);
        if (existsSync(join(adapterAbs, "package.json"))) {
          found.push({ relPath: join("adapters", adapter.name), dir: adapterAbs });
        }
      }
    }
  }

  return found
    .filter((pkg) => !EXCLUDED_PACKAGES.has(pkg.relPath.split(sep).pop()))
    .map((pkg) => ({
      ...pkg,
      name: JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf8")).name,
      destDir: join(OUTPUT_DIR, pkg.relPath),
    }));
}

function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(abs));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      results.push(abs);
    }
  }
  return results;
}

function sourceFilesFor(pkg) {
  const files = [];
  for (const entryFile of ["index.ts", "index.js"]) {
    const abs = join(pkg.dir, entryFile);
    if (existsSync(abs)) files.push(abs);
  }
  const srcDir = join(pkg.dir, "src");
  if (existsSync(srcDir)) files.push(...collectSourceFiles(srcDir));
  return files;
}

function toRelativeSpecifier(fromFile, absoluteTarget) {
  const rel = relative(dirname(fromFile), absoluteTarget).split(sep).join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function rewritePlatformImports(content, destFile, destDirByPackageName) {
  return content
    .split("\n")
    .map((line) => {
      if (!IMPORT_LINE_START_RE.test(line)) return line;
      return line.replace(PLATFORM_SPECIFIER_RE, (match, quote, suffix) => {
        const targetDir = destDirByPackageName.get(`@platform/${suffix}`);
        if (!targetDir) return match; // paquete que no copiamos (p. ej. excluido a propósito)
        const specifier = toRelativeSpecifier(destFile, join(targetDir, "index.js"));
        return `${quote}${specifier}${quote}`;
      });
    })
    .join("\n");
}

function main() {
  const packages = discoverPackages();
  const destDirByPackageName = new Map(packages.map((pkg) => [pkg.name, pkg.destDir]));

  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true, force: true });

  for (const pkg of packages) {
    let fileCount = 0;
    for (const srcFile of sourceFilesFor(pkg)) {
      const destFile = join(pkg.destDir, relative(pkg.dir, srcFile));
      const rewritten = rewritePlatformImports(
        readFileSync(srcFile, "utf8"),
        destFile,
        destDirByPackageName,
      );
      mkdirSync(dirname(destFile), { recursive: true });
      writeFileSync(destFile, rewritten);
      fileCount += 1;
    }
    console.log(`${pkg.name} -> shared/${pkg.relPath} (${fileCount} archivos)`);
  }

  console.log(`\nListo: ${relative(ROOT, OUTPUT_DIR)}/ generado con ${packages.length} paquetes.`);
}

main();
