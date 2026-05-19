import { describe, expect, it } from 'bun:test';
import { currentEntrypointOwner } from '@strays/core/ownership';
import { entrypointProcedure } from './ownedProcedure.ts';
import type { EntrypointOwnerMiddleware } from './ownerMiddleware.ts';

interface MockBuilder {
  middlewares: EntrypointOwnerMiddleware[];
  use(middleware: EntrypointOwnerMiddleware): MockBuilder;
  run(handler: () => unknown): Promise<unknown>;
}

function makeMockBuilder(): MockBuilder {
  const builder: MockBuilder = {
    middlewares: [],
    use(middleware) {
      this.middlewares.push(middleware);
      return this;
    },
    async run(handler) {
      const chain = [...this.middlewares].reverse().reduce<() => Promise<unknown>>(
        (next, middleware) => () => middleware({ next }),
        async () => handler(),
      );
      return chain();
    },
  };
  return builder;
}

describe('entrypointProcedure (oRPC)', () => {
  it('chains an entrypointOwner onto the builder', () => {
    const builder = makeMockBuilder();
    const tagged = entrypointProcedure(builder, 'Billing');

    expect(tagged.middlewares).toHaveLength(1);
  });

  it('returns the same builder reference', () => {
    const builder = makeMockBuilder();
    const tagged = entrypointProcedure(builder, 'Billing');

    expect(tagged).toBe(builder);
  });

  it('runs handlers inside the owner scope', async () => {
    const builder = makeMockBuilder();
    const tagged = entrypointProcedure(builder, 'Billing');
    let observed: string | undefined;

    await tagged.run(() => {
      observed = currentEntrypointOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('composes with existing middlewares (inner owner wins)', async () => {
    const builder = makeMockBuilder();
    entrypointProcedure(builder, 'Outer');
    entrypointProcedure(builder, 'Inner');
    let observed: string | undefined;

    await builder.run(() => {
      observed = currentEntrypointOwner();
    });

    expect(observed).toBe('Inner');
  });
});
