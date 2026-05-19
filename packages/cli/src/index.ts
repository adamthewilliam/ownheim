#!/usr/bin/env bun
import { resolve } from 'node:path';
import { runCheck } from './commands/check.ts';
import { runCoverage } from './commands/coverage.ts';
import { runGenerate } from './commands/generate.ts';
import { runTrace } from './commands/trace.ts';
import { loadConfig } from './loadConfig.ts';

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const projectRoot = resolve(process.cwd());

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return command ? 0 : 1;
  }

  switch (command) {
    case 'generate':
      return await cmdGenerate(projectRoot);
    case 'check':
      return await cmdCheck(projectRoot);
    case 'coverage':
      return await cmdCoverage(projectRoot);
    case 'trace':
      return await cmdTrace(projectRoot, args[0]);
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      return 1;
  }
}

async function cmdGenerate(projectRoot: string): Promise<number> {
  const loaded = await loadConfig(projectRoot);
  const result = await runGenerate(loaded);
  console.log(`Wrote ${result.codeownersPath}`);
  console.log(`Wrote ${result.manifestPath}`);
  console.log(`Ownheim detected: ${result.ownheimCount}`);
  return result.ownheimCount > 0 ? 1 : 0;
}

async function cmdCheck(projectRoot: string): Promise<number> {
  const loaded = await loadConfig(projectRoot);
  const result = await runCheck(loaded);

  if (result.drift) {
    console.error('CODEOWNERS is out of date. Run `ownheim generate` to update.');
    if (result.diff) console.error('\n' + result.diff);
  }

  if (result.ownheimCount > 0) {
    console.error(`\nOwnheim detected (${result.ownheimCount}):`);
    for (const file of result.ownheimFiles.slice(0, 20)) console.error(`  ${file}`);
    if (result.ownheimFiles.length > 20) {
      console.error(`  ... and ${result.ownheimFiles.length - 20} more`);
    }
  }

  return result.drift || result.ownheimCount > 0 ? 1 : 0;
}

async function cmdCoverage(projectRoot: string): Promise<number> {
  const loaded = await loadConfig(projectRoot);
  const result = await runCoverage(loaded);

  console.log(`Files: ${result.total}`);
  console.log(`Explicit owners: ${result.explicit} (${result.percent}%)`);
  console.log(`Fallback: ${result.fallback}`);
  console.log(`Unowned: ${result.unowned}`);

  return result.unowned > 0 ? 1 : 0;
}

async function cmdTrace(projectRoot: string, file: string | undefined): Promise<number> {
  if (!file) {
    console.error('Usage: ownheim trace <file>');
    return 1;
  }
  const loaded = await loadConfig(projectRoot);
  const result = await runTrace(loaded, file);
  console.log(result.explanation);
  return 0;
}

function printUsage(): void {
  console.log(`ownheim - find a home for every line of code

Usage:
  ownheim generate           Regenerate CODEOWNERS + manifest from ownheim.config.ts
  ownheim check              Fail if generated CODEOWNERS differs from committed
  ownheim coverage           Report % of files with explicit (non-fallback) owner
  ownheim trace <file>       Show resolved owner for a path with rule trace
`);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
