#!/usr/bin/env node
import { parseArgs } from "node:util";
import path from "node:path";
import { existsSync } from "node:fs";
import { buildClientlibs } from "./buildClientlibs.js";
import type { BuildMode } from "./types.js";

interface CliArgs {
  mode: BuildMode;
  configPath: string;
  outDir?: string;
}

const HELP = `Usage: aem-build [options]

Options:
  --mode <dev|prod|development|production>  Build mode (default: production)
  --config <path>                           Path to aem.config.ts (default: ./aem.config.ts)
  --out-dir <path>                          Output directory (default: ./dist)
  -h, --help                                Show this help`;

async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));
  if (!args) return;
  await buildClientlibs(args);
}

function parse(argv: string[]): CliArgs | null {
  const { values } = parseArgs({
    args: argv,
    options: {
      mode: { type: "string", short: "m", default: "production" },
      config: { type: "string", short: "c" },
      "out-dir": { type: "string", short: "o" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP);
    return null;
  }

  const mode = normaliseMode(String(values.mode));
  const configPath = path.resolve(
    String(values.config ?? defaultConfigPath()),
  );
  const outDir = values["out-dir"] ? String(values["out-dir"]) : undefined;

  return { mode, configPath, outDir };
}

function normaliseMode(value: string): BuildMode {
  if (value === "dev" || value === "development") return "development";
  if (value === "prod" || value === "production") return "production";
  throw new Error(`Unknown --mode '${value}' (expected dev|prod)`);
}

function defaultConfigPath(): string {
  const candidates = [
    "aem.config.ts",
    "aem.config.mts",
    "aem.config.mjs",
    "aem.config.js",
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(process.cwd(), candidate);
    if (existsSync(resolved)) return resolved;
  }
  return "aem.config.ts";
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
