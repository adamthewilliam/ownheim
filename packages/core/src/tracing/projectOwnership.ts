import type { OwnershipContext, ResolveOwnershipInput } from '../ownership.ts';
import { resolveOwnership } from '../ownership.ts';
import { resolveTagOptions, type TagOptions } from './resolveTagOptions.ts';
import { ownershipContextToTags, type OwnershipTags } from './ownershipTags.ts';

export interface ProjectOwnershipInput extends Omit<ResolveOwnershipInput, 'fallbackCodeTeam'> {
  readonly fallbackCodeTeam?: string;
  readonly tags?: TagOptions['tags'];
}

export function projectOwnershipToTags(
  ownership: OwnershipContext,
  options: TagOptions = {},
): OwnershipTags {
  const { tags } = resolveTagOptions(options);
  return ownershipContextToTags(ownership, tags);
}

export function resolveProjectedOwnershipTags(input: ProjectOwnershipInput = {}): OwnershipTags {
  const tagOptions: TagOptions = {
    ...(input.fallbackCodeTeam === undefined ? {} : { fallbackCodeTeam: input.fallbackCodeTeam }),
    ...(input.tags === undefined ? {} : { tags: input.tags }),
  };
  const { fallbackCodeTeam } = resolveTagOptions(tagOptions);
  const { ownership } = resolveOwnership({
    ...(input.error === undefined ? {} : { error: input.error }),
    ...(input.frameSource === undefined ? {} : { frameSource: input.frameSource }),
    ...(input.moduleOwner === undefined ? {} : { moduleOwner: input.moduleOwner }),
    ...(input.registry === undefined ? {} : { registry: input.registry }),
    fallbackCodeTeam,
  });
  return projectOwnershipToTags(ownership, tagOptions);
}

export function applyProjectedOwnership<TTarget>(
  target: TTarget,
  input: ProjectOwnershipInput,
  apply: (target: TTarget, key: string, value: string) => void,
): void {
  for (const [key, value] of Object.entries(resolveProjectedOwnershipTags(input))) {
    apply(target, key, value);
  }
}
