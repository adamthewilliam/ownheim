import { describe, expect, it } from 'bun:test';
import { currentOwner } from '@strays/runtime/currentOwner';
import { teamProcedure } from './teamProcedure.ts';
import type { TeamMiddleware } from './teamMiddleware.ts';

interface MockBuilder {
  middlewares: TeamMiddleware[];
  use(middleware: TeamMiddleware): MockBuilder;
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

describe('teamProcedure (oRPC)', () => {
  it('chains a teamMiddleware onto the builder', () => {
    const builder = makeMockBuilder();
    const tagged = teamProcedure(builder, 'Billing');

    expect(tagged.middlewares).toHaveLength(1);
  });

  it('returns the same builder reference', () => {
    const builder = makeMockBuilder();
    const tagged = teamProcedure(builder, 'Billing');

    expect(tagged).toBe(builder);
  });

  it('runs handlers inside the team scope', async () => {
    const builder = makeMockBuilder();
    const tagged = teamProcedure(builder, 'Billing');
    let observed: string | undefined;

    await tagged.run(() => {
      observed = currentOwner();
    });

    expect(observed).toBe('Billing');
  });

  it('composes with existing middlewares (inner team wins)', async () => {
    const builder = makeMockBuilder();
    teamProcedure(builder, 'Outer');
    teamProcedure(builder, 'Inner');
    let observed: string | undefined;

    await builder.run(() => {
      observed = currentOwner();
    });

    expect(observed).toBe('Inner');
  });
});
