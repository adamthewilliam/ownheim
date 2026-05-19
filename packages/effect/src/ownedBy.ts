import { OWNER_TAG } from '@strays/core/symbols';

/**
 * Marks an error class as owned by a team. Sets `[OWNER_TAG]` on the prototype
 * so every instance carries it implicitly — picked up by `walkResponderTeamChain`
 * and the Datadog/Sentry/OTel adapters.
 *
 * Usage with Schema.TaggedError:
 *
 *   import { Schema } from 'effect'
 *   import { ownedBy } from '@strays/effect/ownedBy'
 *
 *   class BillingError extends Schema.TaggedError<BillingError>('BillingError')(
 *     'BillingError',
 *     { code: Schema.String },
 *   ) {}
 *   ownedBy(BillingError, 'Billing')
 *
 * Returns the same class so it can be used as an expression.
 */
export const ownedBy = <T extends abstract new (...args: never[]) => object>(
  ErrorClass: T,
  owner: string,
): T => {
  Object.defineProperty(ErrorClass.prototype, OWNER_TAG, {
    value: owner,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return ErrorClass;
};
