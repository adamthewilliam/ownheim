import type { OwnershipContext, ResolveOwnershipInput } from '../ownership.ts';
import { resolveOwnership } from '../ownership.ts';
import { resolveTagOptions, type TagOptions } from './resolveTagOptions.ts';

export interface OwnershipTagNames {
  readonly entrypointTeam: string;
  readonly codeTeam: string;
  readonly responderTeam: string;
}

export interface ResolveOwnershipTagsInput extends Omit<ResolveOwnershipInput, 'fallbackCodeTeam'> {
  readonly fallbackCodeTeam?: string;
  readonly tags?: TagOptions['tags'];
}

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
  const tagOptions: TagOptions = {
    ...(input.fallbackCodeTeam === undefined ? {} : { fallbackCodeTeam: input.fallbackCodeTeam }),
    ...(input.tags === undefined ? {} : { tags: input.tags }),
  };
  const { fallbackCodeTeam, tags } = resolveTagOptions(tagOptions);
  const { ownership } = resolveOwnership({
    ...(input.error === undefined ? {} : { error: input.error }),
    ...(input.frameSource === undefined ? {} : { frameSource: input.frameSource }),
    ...(input.moduleOwner === undefined ? {} : { moduleOwner: input.moduleOwner }),
    ...(input.registry === undefined ? {} : { registry: input.registry }),
    fallbackCodeTeam,
  });
  return ownershipContextToTags(ownership, tags);
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
