import { describe, expect, test } from 'bun:test';
import { ownershipFromError, ownershipMixin } from '../src/mixin.ts';
import { OwnedError } from '@ownheim/core/OwnedError';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';

describe('ownershipMixin', () => {
  test('returns fallback code owner when no entrypoint is in scope', () => {
    const mixin = ownershipMixin();
    expect(mixin()).toEqual({ ownheim_code_team: 'unowned' });
  });

  test('returns entrypoint and code ownership', () => {
    const mixin = ownershipMixin();
    runWithEntrypointOwner('Billing', () => {
      expect(mixin()).toEqual({ ownheim_entrypoint_team: 'Billing', ownheim_code_team: 'unowned' });
    });
  });

  test('respects custom field names', () => {
    const mixin = ownershipMixin({ fields: { entrypointTeam: 'entry', codeTeam: 'code' } });
    runWithEntrypointOwner('Billing', () => {
      expect(mixin()).toEqual({ entry: 'Billing', code: 'unowned' });
    });
  });

  test('respects custom fallback code team', () => {
    const mixin = ownershipMixin({ fallbackCodeTeam: 'platform' });
    expect(mixin()).toEqual({ ownheim_code_team: 'platform' });
  });
});

describe('ownershipFromError', () => {
  test('extracts responder from OwnedError', () => {
    const err = new OwnedError('Payment failed', { responderTeam: 'Billing' });
    expect(ownershipFromError(err)).toEqual({
      ownheim_code_team: 'unowned',
      ownheim_responder_team: 'Billing',
    });
  });

  test('falls back when error has no responder', () => {
    const err = new Error('Generic error');
    expect(ownershipFromError(err)).toEqual({ ownheim_code_team: 'unowned' });
  });
});
