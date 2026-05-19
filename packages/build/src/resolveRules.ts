import type { ResolvedOwnership, OwnheimConfig, Team } from '@ownheim/core/types';
import { createOwnershipResolver, type ResolveInput } from './ownershipResolver.ts';

export type { ResolveInput } from './ownershipResolver.ts';
export { createOwnershipResolver } from './ownershipResolver.ts';

export function resolveOwnerForFile<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
  input: ResolveInput,
): ResolvedOwnership | undefined {
  return createOwnershipResolver(config).resolve(input);
}

export function resolveAll<TTeams extends Record<string, Team>>(
  config: OwnheimConfig<TTeams>,
  files: readonly ResolveInput[],
): ResolvedOwnership[] {
  return createOwnershipResolver(config).resolveAll(files);
}
