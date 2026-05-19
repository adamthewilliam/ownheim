export const DEFAULT_CODE_TEAM_FALLBACK = 'unowned';
export const DEFAULT_ENTRYPOINT_TEAM_TAG = 'ownheim.entrypoint_team';
export const DEFAULT_CODE_TEAM_TAG = 'ownheim.code_team';
export const DEFAULT_RESPONDER_TEAM_TAG = 'ownheim.responder_team';

export interface TagOptions {
  readonly fallbackCodeTeam?: string;
  readonly tags?: {
    readonly entrypointTeam?: string;
    readonly codeTeam?: string;
    readonly responderTeam?: string;
  };
}

export interface ResolvedTagOptions {
  readonly fallbackCodeTeam: string;
  readonly tags: {
    readonly entrypointTeam: string;
    readonly codeTeam: string;
    readonly responderTeam: string;
  };
}

export function resolveTagOptions(options: TagOptions): ResolvedTagOptions {
  return {
    fallbackCodeTeam: options.fallbackCodeTeam ?? DEFAULT_CODE_TEAM_FALLBACK,
    tags: {
      entrypointTeam: options.tags?.entrypointTeam ?? DEFAULT_ENTRYPOINT_TEAM_TAG,
      codeTeam: options.tags?.codeTeam ?? DEFAULT_CODE_TEAM_TAG,
      responderTeam: options.tags?.responderTeam ?? DEFAULT_RESPONDER_TEAM_TAG,
    },
  };
}
