import { resolveOwner } from '@strays/core/ownership';

export interface DatadogRumLike {
  addError(error: unknown, context?: Record<string, unknown>): void;
  setGlobalContextProperty(key: string, value: unknown): void;
}

const INSTALLED = Symbol.for('strays.datadog-rum.installed');

type InstalledDatadogRumLike = DatadogRumLike & { [INSTALLED]?: true };

export function installDatadogRum(rum: DatadogRumLike, fallback = 'unowned'): void {
  const installedRum = rum as InstalledDatadogRumLike;
  if (installedRum[INSTALLED]) return;
  installedRum[INSTALLED] = true;

  const original = rum.addError.bind(rum);
  rum.addError = (error: unknown, context?: Record<string, unknown>) => {
    original(error, { ...context, team: resolveOwner({ error, fallback }) });
  };
}
