import { describe, test, expect } from 'bun:test';
import { ownershipMixin, ownershipFromError } from './mixin.ts';
import { runWithOwner, OwnedError } from '@strays/core';

describe('ownershipMixin', () => {
  test('returns fallback when no owner in scope', () => {
    const mixin = ownershipMixin();
    expect(mixin()).toEqual({ team: 'unowned' });
  });

  test('returns current owner from scope', () => {
    const mixin = ownershipMixin();
    runWithOwner('Billing', () => {
      expect(mixin()).toEqual({ team: 'Billing' });
    });
  });

  test('respects custom attribute key', () => {
    const mixin = ownershipMixin({ attributeKey: 'owner' });
    runWithOwner('Billing', () => {
      expect(mixin()).toEqual({ owner: 'Billing' });
    });
  });

  test('respects custom fallback', () => {
    const mixin = ownershipMixin({ fallback: 'platform' });
    expect(mixin()).toEqual({ team: 'platform' });
  });
});

describe('ownershipFromError', () => {
  test('extracts owner from OwnedError', () => {
    const err = new OwnedError('Payment failed', 'Billing');
    expect(ownershipFromError(err)).toEqual({ team: 'Billing' });
  });

  test('falls back when error has no owner', () => {
    const err = new Error('Generic error');
    expect(ownershipFromError(err)).toEqual({ team: 'unowned' });
  });
});
