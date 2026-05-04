/**
 * The tier in `resolveOwner`'s chain that produced the owner.
 *
 * Returned by `resolveOwnerWithSource` for callers that need to audit which
 * tier resolved a given owner — most useful during rollout/migration to
 * verify telemetry is being attributed via the expected channel. The
 * Datadog/Sentry/OTel adapters can emit it as `team_source` alongside
 * `team` when `emitSource: true` is passed; off by default to keep
 * production cardinality minimal.
 */
export type OwnerSource = 'error' | 'scope' | 'frame' | 'module' | 'fallback';

export interface OwnerResolution {
  readonly owner: string;
  readonly source: OwnerSource;
}
