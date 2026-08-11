#!/usr/bin/env node
import { formatReport, runDoctor } from "./doctor.js";
import { generateConsumer, generateController, generateUseCase } from "./generate.js";

const GENERATORS: Record<string, (srcDir: string, name: string) => string> = {
  "generate:usecase": generateUseCase,
  "generate:controller": generateController,
  "generate:consumer": generateConsumer,
};

function runGenerate(command: string, name: string | undefined, srcDir: string): void {
  const generate = GENERATORS[command];
  if (!generate) {
    console.error(`Comando desconocido: ${command}`);
    console.error(`Usage: doctor ${Object.keys(GENERATORS).join("|")} <Nombre> [srcDir]`);
    process.exitCode = 1;
    return;
  }
  if (!name) {
    console.error(`Usage: doctor ${command} <Nombre> [srcDir]`);
    process.exitCode = 1;
    return;
  }

  try {
    const path = generate(srcDir, name);
    console.log(`Creado ${path}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

const [command, ...rest] = process.argv.slice(2);

if (command?.startsWith("generate:")) {
  const [name, srcDir = "src"] = rest;
  runGenerate(command, name, srcDir);
} else {
  const srcDir = command ?? "src";
  const report = runDoctor(srcDir);
  console.log(formatReport(report));
  if (report.missingRequired.length > 0) {
    process.exitCode = 1;
  }
}
