import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/scope/currentOwner';
import { ownedProcedure } from './ownedProcedure.ts';
import type { OwnerMiddleware } from './ownerMiddleware.ts';

interface MockBuilder {
  middlewares: OwnerMiddleware[];
  use(middleware: OwnerMiddleware): MockBuilder;
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

describe('ownedProcedure', () => {
  it('chains an ownerMiddleware onto the builder', () => {
    const builder = makeMockBuilder();
    const tagged = ownedProcedure(builder, 'Billing');

    expect(tagged.middlewares).toHaveLength(1);
  });

  it('returns the same builder reference for chaining', () => {
    const builder = makeMockBuilder();
    const tagged = ownedProcedure(builder, 'Billing');

    expect(tagged).toBe(builder);
  });

  it('runs handlers inside the owner scope', async () => {
    const builder = makeMockBuilder();
    const tagged = ownedProcedure(builder, 'Billing');
    let observed: string | undefined;

    await tagged.run(() => {
      observed = currentOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('composes with existing middlewares (inner owner wins)', async () => {
    const builder = makeMockBuilder();
    ownedProcedure(builder, 'Outer');
    ownedProcedure(builder, 'Inner');
    let observed: string | undefined;

    await builder.run(() => {
      observed = currentOwner();
    });

    expect(observed).toBe('Inner');
  });
});
