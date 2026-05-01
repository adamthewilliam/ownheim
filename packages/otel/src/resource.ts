export interface OwnerAttributes {
  readonly 'service.team': string;
  readonly 'service.team.tier'?: number;
  readonly 'service.team.pagerduty'?: string;
}

export interface ResourceLike {
  attributes: Record<string, string | number | boolean | undefined>;
}

export function decorateResource(
  resource: ResourceLike,
  team: string,
  extras: { tier?: number; pagerduty?: string } = {},
): ResourceLike {
  resource.attributes['service.team'] = team;
  if (extras.tier !== undefined) resource.attributes['service.team.tier'] = extras.tier;
  if (extras.pagerduty !== undefined) {
    resource.attributes['service.team.pagerduty'] = extras.pagerduty;
  }
  return resource;
}
