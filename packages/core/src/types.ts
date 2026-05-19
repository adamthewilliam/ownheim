export interface Team {
  readonly github: string;
  readonly handles?: Record<string, string>;
  readonly owns?: readonly string[];
  readonly fallback?: boolean;
}

export type Owner = Team;

export type TeamId<TTeams extends Record<string, Team>> = Extract<keyof TTeams, string>;

export interface SharedRule<TKey extends string = string> {
  readonly glob: string;
  readonly owners: readonly TKey[];
}

export interface StraysConfig<TTeams extends Record<string, Team>> {
  readonly teams: TTeams;
  readonly shared?: readonly SharedRule<TeamId<TTeams>>[];
}

export interface ResolvedOwnership {
  readonly file: string;
  readonly teams: readonly string[];
  readonly source: 'jsdoc' | 'rule' | 'fallback';
  readonly matchedGlob?: string;
}

export type ResolvedOwner = ResolvedOwnership;
