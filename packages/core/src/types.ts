export interface Owner {
  readonly id: string;
  readonly github: string;
  readonly pagerduty?: string;
  readonly tier?: number;
}

export type OwnerId<TOwners extends Record<string, Owner>> = Extract<keyof TOwners, string>;

export interface Rule<TKey extends string = string> {
  readonly glob: string;
  readonly owner: TKey | readonly TKey[];
  readonly fallback?: boolean;
}

export interface StraysConfig<TOwners extends Record<string, Owner>> {
  readonly owners: TOwners;
  readonly rules: ReadonlyArray<Rule<OwnerId<TOwners>>>;
}

export interface ResolvedOwner {
  readonly file: string;
  readonly owners: readonly string[];
  readonly source: 'jsdoc' | 'rule' | 'fallback';
  readonly matchedGlob?: string;
}
