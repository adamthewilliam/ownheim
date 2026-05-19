import type { OwnershipContext } from '../ownership.ts';
import { resolveProjectedOwnershipTags, type ProjectOwnershipInput } from './projectOwnership.ts';

export interface OwnershipTagNames {
  readonly entrypointTeam: string;
  readonly codeTeam: string;
  readonly responderTeam: string;
}

export interface ResolveOwnershipTagsInput extends ProjectOwnershipInput {}

export type OwnershipTags = Record<string, string>;

export function ownershipContextToTags(
  ownership: OwnershipContext,
  tags: OwnershipTagNames,
): OwnershipTags {
  return {
    ...(ownership.entrypointTeam === undefined ? {} : { [tags.entrypointTeam]: ownership.entrypointTeam }),
    ...(ownership.codeTeam === undefined ? {} : { [tags.codeTeam]: ownership.codeTeam }),
    ...(ownership.responderTeam === undefined ? {} : { [tags.responderTeam]: ownership.responderTeam }),
  };
}

export function resolveOwnershipTags(input: ResolveOwnershipTagsInput = {}): OwnershipTags {
  return resolveProjectedOwnershipTags(input);
}

export function applyOwnershipTags<TTarget>(
  target: TTarget,
  tags: OwnershipTags,
  apply: (target: TTarget, key: string, value: string) => void,
): void {
  for (const [key, value] of Object.entries(tags)) {
    apply(target, key, value);
  }
}
