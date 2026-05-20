import { AsyncLocalStorage } from 'node:async_hooks';
import { callerFrameSource, findOwnedFrame, type FrameSource } from './resolution/frames.ts';
import { getDefaultRegistry } from './manifest/defaultRegistry.ts';
import type { ManifestRegistry } from './manifest/ManifestRegistry.ts';
import { walkResponderTeamChain } from './resolution/walkOwnedErrorChain.ts';

const entrypointOwnerStore = new AsyncLocalStorage<string>();

export function runWithEntrypointOwner<TResult>(team: string, fn: () => TResult): TResult {
  return entrypointOwnerStore.run(team, fn);
}

export function currentEntrypointOwner(): string | undefined {
  return entrypointOwnerStore.getStore();
}

export type NextThunk = () => unknown;

export function withEntrypointOwnerScope<TArgs extends readonly unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (team: string) => (...args: TArgs) => TReturn {
  return createEntrypointOwnerAdapter(pickNext);
}

export function createEntrypointOwnerAdapter<TArgs extends readonly unknown[], TReturn = unknown>(
  pickNext: (...args: TArgs) => NextThunk,
): (team: string) => (...args: TArgs) => TReturn {
  return (team) =>
    ((...args: TArgs) => runWithEntrypointOwner(team, () => pickNext(...args)())) as (
      ...args: TArgs
    ) => TReturn;
}

export interface NextContainer<TReturn = unknown> {
  readonly next: () => TReturn;
}

export const promiseNextEntrypointOwner = withEntrypointOwnerScope<
  [NextContainer<Promise<unknown>>],
  Promise<unknown>
>(({ next }) => next);

export type CodeOwnerSource = 'module' | 'frame' | 'fallback';

export interface OwnershipContext {
  readonly entrypointTeam?: string;
  readonly codeTeam?: string;
  readonly responderTeam?: string;
}

export interface OwnershipSources {
  readonly entrypointTeam?: 'scope';
  readonly codeTeam?: CodeOwnerSource;
  readonly responderTeam?: 'error';
}

export interface OwnershipResolution {
  readonly ownership: OwnershipContext;
  readonly sources: OwnershipSources;
}

export interface ResolveOwnershipInput {
  readonly error?: unknown;
  readonly frameSource?: FrameSource | undefined;
  readonly moduleOwner?: string | undefined;
  readonly registry?: ManifestRegistry | undefined;
  readonly fallbackCodeTeam?: string | undefined;
}

export function resolveOwnership(input: ResolveOwnershipInput = {}): OwnershipResolution {
  const ownership: Record<string, string> = {};
  const sources: Record<string, string> = {};

  const entrypointTeam = entrypointOwnerStore.getStore();
  if (entrypointTeam !== undefined) {
    ownership.entrypointTeam = entrypointTeam;
    sources.entrypointTeam = 'scope';
  }

  const code = resolveCodeTeam(input);
  ownership.codeTeam = code.team;
  sources.codeTeam = code.source;

  if (input.error !== undefined) {
    const responderTeam = walkResponderTeamChain(input.error);
    if (responderTeam !== undefined) {
      ownership.responderTeam = responderTeam;
      sources.responderTeam = 'error';
    }
  }

  return { ownership, sources } as OwnershipResolution;
}

function resolveCodeTeam(input: ResolveOwnershipInput): { team: string; source: CodeOwnerSource } {
  if (input.moduleOwner !== undefined && input.moduleOwner !== '') {
    return { team: input.moduleOwner, source: 'module' };
  }

  const registry = input.registry ?? getDefaultRegistry();
  if (input.frameSource === undefined && registry.isEmpty()) {
    return { team: input.fallbackCodeTeam ?? 'unowned', source: 'fallback' };
  }

  const frameSource: FrameSource = input.frameSource ?? callerFrameSource(2);
  const fromFrame = findOwnedFrame(frameSource, registry);
  if (fromFrame !== undefined) return { team: fromFrame, source: 'frame' };

  return { team: input.fallbackCodeTeam ?? 'unowned', source: 'fallback' };
}
