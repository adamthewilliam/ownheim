import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const packages = await readdirPackages();
const packDir = await mkdtemp(join(tmpdir(), 'ownheim-pack-'));
let failed = false;

try {
  for (const name of packages) {
    const pkgPath = `packages/${name}/package.json`;
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    if (pkg.private) {
      console.log(`\n## ${pkg.name} (private; skipped)`);
      continue;
    }

    console.log(`\n## ${pkg.name}`);

    if (pkg.publishConfig?.access !== 'public') {
      console.error(`${pkg.name} is publishable but missing publishConfig.access = "public"`);
      failed = true;
      continue;
    }

    if (!checkPackedManifest(name)) failed = true;

    const publint = spawnSync('bunx', ['publint', `packages/${name}`], { stdio: 'inherit' });
    if (publint.status !== 0) failed = true;
  }
} finally {
  await rm(packDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);

async function readdirPackages() {
  const { readdir } = await import('node:fs/promises');
  return (await readdir('packages')).sort();
}

function checkPackedManifest(name) {
  const pack = spawnSync(
    'npm',
    ['pack', `./packages/${name}`, '--pack-destination', packDir, '--json', '--ignore-scripts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );

  if (pack.status !== 0) return false;

  const tarballPath = parsePackedTarballPath(pack.stdout);
  if (!tarballPath) {
    console.error('Could not determine npm pack tarball path.');
    return false;
  }

  const manifest = spawnSync('tar', ['-xOzf', tarballPath, 'package/package.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (manifest.status !== 0) return false;

  const packedPkg = JSON.parse(manifest.stdout);
  const workspaceDeps = findWorkspaceDependencies(packedPkg);
  if (workspaceDeps.length > 0) {
    console.error('Packed package.json contains workspace: dependency specs:');
    for (const dep of workspaceDeps) console.error(`  ${dep}`);
    return false;
  }

  return true;
}

function parsePackedTarballPath(stdout) {
  try {
    const packed = JSON.parse(stdout);
    const filename = packed?.[0]?.filename;
    return typeof filename === 'string' ? join(packDir, filename) : undefined;
  } catch {
    return undefined;
  }
}

function findWorkspaceDependencies(pkg) {
  const found = [];
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) {
        found.push(`${field}.${name} = ${spec}`);
      }
    }
  }
  return found;
}
