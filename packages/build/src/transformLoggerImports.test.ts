import { describe, expect, it } from 'bun:test';
import { transformLoggerImports } from './transformLoggerImports.ts';

describe('transformLoggerImports', () => {
  it('rewrites a single logger import to a createLogger factory call', () => {
    const out = transformLoggerImports(`import { logger } from '@strays/runtime';\n`);
    expect(out).toContain("import { createLogger } from '@strays/runtime/createLogger'");
    expect(out).toContain('const logger = createLogger(typeof __OWNER__');
  });

  it('rewrites tracer imports to createTracer factory calls', () => {
    const out = transformLoggerImports(`import { tracer } from '@strays/runtime';\n`);
    expect(out).toContain("import { createTracer } from '@strays/runtime/createTracer'");
    expect(out).toContain('const tracer = createTracer(typeof __OWNER__');
  });

  it('rewrites both logger and tracer in the same import', () => {
    const out = transformLoggerImports(`import { logger, tracer } from '@strays/runtime';\n`);
    expect(out).toContain('createLogger');
    expect(out).toContain('createTracer');
  });

  it('preserves unrelated named imports from the same specifier', () => {
    const out = transformLoggerImports(
      `import { logger, runWithOwner } from '@strays/runtime';\n`,
    );
    expect(out).toContain("import { runWithOwner } from '@strays/runtime'");
    expect(out).toContain('createLogger');
  });

  it('honours import aliases', () => {
    const out = transformLoggerImports(
      `import { logger as log } from '@strays/runtime';\n`,
    );
    expect(out).toContain('const log = createLogger(');
    expect(out).not.toContain('const logger =');
  });

  it('does not touch unrelated imports', () => {
    const source = `import { x } from 'other';\nimport { y } from './local.ts';\n`;
    expect(transformLoggerImports(source)).toBe(source);
  });

  it('uses double quotes when the original import uses double quotes', () => {
    const out = transformLoggerImports(`import { logger } from "@strays/runtime";\n`);
    expect(out).toContain('"@strays/runtime/createLogger"');
  });
});
