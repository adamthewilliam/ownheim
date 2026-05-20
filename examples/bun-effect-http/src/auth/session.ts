import { Effect, Schema } from 'effect';
import { annotateOwnershipSpan, ownedBy, withOwnershipLogAnnotations } from '@ownheim/effect';

export class IdentityError extends Schema.TaggedError<IdentityError>()(
  'IdentityError',
  {
    message: Schema.String,
  },
) {}
ownedBy(IdentityError, 'Identity');

export const requireSession = (
  token: string | undefined,
): Effect.Effect<string, IdentityError> =>
  Effect.gen(function* () {
    // Demonstrates direct current-span annotation for existing spans.
    yield* annotateOwnershipSpan({ moduleOwner: 'Identity' });
    yield* Effect.logInfo('requiring session');

    if (!token) {
      return yield* Effect.fail(new IdentityError({ message: 'missing session token' }));
    }

    return token;
  }).pipe(withOwnershipLogAnnotations({ moduleOwner: 'Identity' }));
