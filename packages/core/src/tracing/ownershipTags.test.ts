import { describe, expect, test } from 'bun:test';
import { OwnedError, runWithEntrypointOwner } from '../index.ts';
import { ownershipContextToTags, resolveOwnershipTags } from './ownershipTags.ts';

describe('ownershipContextToTags', () => {
  test('projects defined ownership fields to configured tag names', () => {
    expect(
      ownershipContextToTags(
        { entrypointTeam: 'Accounts', codeTeam: 'Billing', responderTeam: 'Platform' },
        { entrypointTeam: 'entry', codeTeam: 'code', responderTeam: 'responder' },
      ),
    ).toEqual({ entry: 'Accounts', code: 'Billing', responder: 'Platform' });
  });

  test('omits undefined ownership fields', () => {
    expect(
      ownershipContextToTags(
        { codeTeam: 'Billing' },
        { entrypointTeam: 'entry', codeTeam: 'code', responderTeam: 'responder' },
      ),
    ).toEqual({ code: 'Billing' });
  });
});

describe('resolveOwnershipTags', () => {
  test('resolves ownership once and projects it to tags', () => {
    const error = new OwnedError('ledger failed', { responderTeam: 'Billing' });

    const tags = runWithEntrypointOwner('Accounts', () =>
      resolveOwnershipTags({
        error,
        moduleOwner: 'Ledger',
        tags: {
          entrypointTeam: 'entry',
          codeTeam: 'code',
          responderTeam: 'responder',
        },
      }),
    );

    expect(tags).toEqual({ entry: 'Accounts', code: 'Ledger', responder: 'Billing' });
  });
});
