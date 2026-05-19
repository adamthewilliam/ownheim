import { resolveOwnershipTags } from '@ownheim/core/tracing/ownershipTags';

export interface OwnershipMixinOptions {
  readonly fallbackCodeTeam?: string;
  readonly fields?: {
    readonly entrypointTeam?: string;
    readonly codeTeam?: string;
    readonly responderTeam?: string;
  };
}

const defaultFields = {
  entrypointTeam: 'ownheim_entrypoint_team',
  codeTeam: 'ownheim_code_team',
  responderTeam: 'ownheim_responder_team',
} as const;

function fieldNames(options: OwnershipMixinOptions) {
  return {
    entrypointTeam: options.fields?.entrypointTeam ?? defaultFields.entrypointTeam,
    codeTeam: options.fields?.codeTeam ?? defaultFields.codeTeam,
    responderTeam: options.fields?.responderTeam ?? defaultFields.responderTeam,
  };
}

function toTagOptions(options: OwnershipMixinOptions) {
  return {
    fallbackCodeTeam: options.fallbackCodeTeam ?? 'unowned',
    tags: fieldNames(options),
  };
}

export function ownershipMixin(options: OwnershipMixinOptions = {}) {
  const tagOptions = toTagOptions(options);

  return (): Record<string, string> => resolveOwnershipTags(tagOptions);
}

export function ownershipFromError(
  error: unknown,
  options: OwnershipMixinOptions = {},
): Record<string, string> {
  return resolveOwnershipTags({ ...toTagOptions(options), error });
}
