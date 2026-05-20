import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RunBundleOptions {
  readonly sourcemap?: string;
  readonly runtime?: 'bun' | 'node';
  readonly nodeFlags?: readonly string[];
  readonly stdin?: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
}

export interface RunBundleResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

export async function runBundleInSubprocess(
  bundle: string,
  opts: RunBundleOptions = {},
): Promise<RunBundleResult> {
  const runtime = opts.runtime ?? 'bun';
  const dir = await mkdtemp(join(tmpdir(), 'ownheim-run-'));
  const scriptPath = join(dir, 'bundle.mjs');

  try {
    await writeFile(scriptPath, bundle, 'utf8');

    if (opts.sourcemap !== undefined) {
      await writeFile(`${scriptPath}.map`, opts.sourcemap, 'utf8');
    }

    const cmd =
      runtime === 'bun'
        ? ['bun', 'run', scriptPath]
        : ['node', ...(opts.nodeFlags ?? []), scriptPath];

    // Bun.spawn can run `node` too; we just hand it the right argv.
    const proc = Bun.spawn({
      cmd,
      stdin: opts.stdin === undefined ? 'ignore' : 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, ...opts.env },
    });

    if (opts.stdin !== undefined && proc.stdin) {
      // Bun's stdin handle (when stdin: 'pipe') is a FileSink with write/end.
      const sink = proc.stdin as unknown as {
        write: (data: Uint8Array) => void;
        end: () => void;
      };
      sink.write(new TextEncoder().encode(opts.stdin));
      sink.end();
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timer);

    if (timedOut) {
      throw new Error(
        `runBundleInSubprocess: ${runtime} subprocess exceeded ${String(timeoutMs)}ms timeout`,
      );
    }

    return { stdout, stderr, code: code ?? 0 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
