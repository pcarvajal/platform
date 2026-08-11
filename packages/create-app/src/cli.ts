#!/usr/bin/env node
import { scaffold } from "./scaffold.js";

interface Args {
  projectName: string;
  platformPath?: string;
}

function parseArgs(argv: string[]): Args {
  const [projectName, ...rest] = argv;
  if (!projectName) {
    console.error("Usage: create-app <project-name> [--platform-path <path>]");
    process.exit(1);
  }

  const platformPathIndex = rest.indexOf("--platform-path");
  const platformPath = platformPathIndex !== -1 ? rest[platformPathIndex + 1] : undefined;

  return { projectName, platformPath };
}

const { projectName, platformPath } = parseArgs(process.argv.slice(2));
scaffold({ projectName, platformPath });

console.log(`Created ${projectName}/ — see ${projectName}/README.md for next steps.`);
