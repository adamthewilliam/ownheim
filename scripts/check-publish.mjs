import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const packages = await readdir('packages');
let failed = false;
for (const name of packages) {
  const pkgPath = `packages/${name}/package.json`;
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  if (pkg.private) {
    console.log(`\n## ${pkg.name} (private; skipped)`);
    continue;
  }
  if (pkg.publishConfig?.access !== 'public') {
    console.error(`${pkg.name} is publishable but missing publishConfig.access = "public"`);
    failed = true;
    continue;
  }
  console.log(`\n## ${pkg.name}`);
  for (const cmd of [
    ['bunx', ['publint', `packages/${name}`]],
  ]) {
    const result = spawnSync(cmd[0], cmd[1], { stdio: 'inherit' });
    if (result.status !== 0) failed = true;
  }
}
process.exit(failed ? 1 : 0);
