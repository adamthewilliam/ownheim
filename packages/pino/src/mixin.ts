import { resolveOwnership } from '@ownheim/core/ownership';

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

export function ownershipMixin(options: OwnershipMixinOptions = {}) {
  const fields = fieldNames(options);
  const fallbackCodeTeam = options.fallbackCodeTeam ?? 'unowned';

  return (): Record<string, string> => {
    const { ownership } = resolveOwnership({ fallbackCodeTeam });
    return {
      ...(ownership.entrypointTeam === undefined ? {} : { [fields.entrypointTeam]: ownership.entrypointTeam }),
      ...(ownership.codeTeam === undefined ? {} : { [fields.codeTeam]: ownership.codeTeam }),
      ...(ownership.responderTeam === undefined ? {} : { [fields.responderTeam]: ownership.responderTeam }),
    };
  };
}

export function ownershipFromError(
  error: unknown,
  options: OwnershipMixinOptions = {},
): Record<string, string> {
  const fields = fieldNames(options);
  const { ownership } = resolveOwnership({ error, fallbackCodeTeam: options.fallbackCodeTeam ?? 'unowned' });
  return {
    ...(ownership.entrypointTeam === undefined ? {} : { [fields.entrypointTeam]: ownership.entrypointTeam }),
    ...(ownership.codeTeam === undefined ? {} : { [fields.codeTeam]: ownership.codeTeam }),
    ...(ownership.responderTeam === undefined ? {} : { [fields.responderTeam]: ownership.responderTeam }),
  };
}
