#!/usr/bin/env node
import { formatReport, runDoctor } from "./doctor.js";

const srcDir = process.argv[2] ?? "src";
const report = runDoctor(srcDir);

console.log(formatReport(report));

if (report.missingRequired.length > 0) {
  process.exitCode = 1;
}
