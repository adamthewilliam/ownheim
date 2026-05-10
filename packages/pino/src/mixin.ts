import { currentOwner, resolveOwner } from '@strays/core/ownership';

export interface OwnershipMixinOptions {
  readonly attributeKey?: string;
  readonly fallback?: string;
}

export function ownershipMixin(options: OwnershipMixinOptions = {}) {
  const key = options.attributeKey ?? 'team';
  const fallback = options.fallback ?? 'unowned';

  return (): Record<string, string> => ({
    [key]: currentOwner() ?? fallback,
  });
}

export function ownershipFromError(
  error: unknown,
  options: OwnershipMixinOptions = {},
): Record<string, string> {
  const key = options.attributeKey ?? 'team';
  const fallback = options.fallback ?? 'unowned';

  return {
    [key]: resolveOwner({ error, fallback }),
  };
}
