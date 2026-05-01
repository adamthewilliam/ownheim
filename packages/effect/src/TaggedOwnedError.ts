import { Data } from 'effect';
import { OWNER_TAG } from '@strays/core/symbols';

export function TaggedOwnedError<TTag extends string>(tag: TTag, owner: string) {
  const Base = Data.TaggedError(tag);

  return class extends (Base<{ readonly owner: string }> as {
    new (args: { readonly owner: string } & Record<string, unknown>): InstanceType<
      ReturnType<typeof Data.TaggedError<TTag>>
    >;
  }) {
    readonly [OWNER_TAG]: string = owner;

    constructor(args: Record<string, unknown> = {}) {
      super({ owner, ...args });
    }
  };
}
