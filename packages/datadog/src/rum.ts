import { resolveOwnership } from '@strays/core/ownership';

export interface DatadogRumLike {
  addError(error: unknown, context?: Record<string, unknown>): void;
  setGlobalContextProperty(key: string, value: unknown): void;
}

const INSTALLED = Symbol.for('strays.datadog-rum.installed');

type InstalledDatadogRumLike = DatadogRumLike & { [INSTALLED]?: true };

export function installDatadogRum(rum: DatadogRumLike, fallbackCodeTeam = 'unowned'): void {
  const installedRum = rum as InstalledDatadogRumLike;
  if (installedRum[INSTALLED]) return;
  installedRum[INSTALLED] = true;

  const original = rum.addError.bind(rum);
  rum.addError = (error: unknown, context?: Record<string, unknown>) => {
    const { ownership } = resolveOwnership({ error, fallbackCodeTeam });
    original(error, {
      ...context,
      ...(ownership.entrypointTeam === undefined ? {} : { 'strays.entrypoint_team': ownership.entrypointTeam }),
      ...(ownership.codeTeam === undefined ? {} : { 'strays.code_team': ownership.codeTeam }),
      ...(ownership.responderTeam === undefined ? {} : { 'strays.responder_team': ownership.responderTeam }),
    });
  };
}
