export type OwnerAttributes = Record<string, string | number | boolean | undefined>;

export interface ResourceLike {
  attributes: OwnerAttributes;
}

export function decorateResource(
  resource: ResourceLike,
  team: string,
  handles?: Record<string, string>,
): ResourceLike {
  resource.attributes['service.team'] = team;
  if (handles) {
    for (const [key, value] of Object.entries(handles)) {
      resource.attributes[`service.team.handle.${key}`] = value;
    }
  }
  return resource;
}
