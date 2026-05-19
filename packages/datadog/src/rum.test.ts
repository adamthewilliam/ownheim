import { describe, expect, it } from 'bun:test';
import { OwnedError } from '@ownheim/core/OwnedError';
import { runWithEntrypointOwner } from '@ownheim/core/ownership';
import { instrumentDatadogRum, type DatadogRumLike } from './rum.ts';

function makeRum() {
  const errors: Array<{ error: unknown; context: Record<string, unknown> | undefined }> = [];
  const rum: DatadogRumLike = {
    addError(error, context) {
      errors.push({ error, context });
    },
    setGlobalContextProperty() {},
  };
  return { errors, rum };
}

describe('instrumentDatadogRum', () => {
  it('projects entrypoint, code, and responder ownership onto error context', () => {
    const { errors, rum } = makeRum();
    instrumentDatadogRum(rum);
    const error = new OwnedError('failed', { responderTeam: 'Billing' });

    runWithEntrypointOwner('Identity', () => rum.addError(error, { existing: true }));

    expect(errors[0]?.context).toEqual({
      existing: true,
      'ownheim.entrypoint_team': 'Identity',
      'ownheim.code_team': 'unowned',
      'ownheim.responder_team': 'Billing',
    });
  });

  it('uses an options object for fallback code ownership', () => {
    const { errors, rum } = makeRum();
    instrumentDatadogRum(rum, { fallbackCodeTeam: 'platform-default' });

    rum.addError(new Error('plain'));

    expect(errors[0]?.context?.['ownheim.code_team']).toBe('platform-default');
  });

  it('is idempotent', () => {
    const { errors, rum } = makeRum();
    instrumentDatadogRum(rum);
    instrumentDatadogRum(rum);

    rum.addError(new Error('plain'));

    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0]!.context!).sort()).toEqual(['ownheim.code_team']);
  });
});
