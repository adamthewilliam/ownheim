import { resolveProjectedOwnershipTags } from '@ownheim/core/tracing/projectOwnership';

export interface DatadogRumLike {
  addError(error: unknown, context?: Record<string, unknown>): void;
  setGlobalContextProperty(key: string, value: unknown): void;
}

const INSTALLED = Symbol.for('ownheim.datadog-rum.installed');

type InstalledDatadogRumLike = DatadogRumLike & { [INSTALLED]?: true };

export interface DatadogRumOptions {
  readonly fallbackCodeTeam?: string;
}

export function instrumentDatadogRum(
  rum: DatadogRumLike,
  options: DatadogRumOptions = {},
): void {
  const installedRum = rum as InstalledDatadogRumLike;
  if (installedRum[INSTALLED]) return;
  installedRum[INSTALLED] = true;

  const original = rum.addError.bind(rum);
  rum.addError = (error: unknown, context?: Record<string, unknown>) => {
    original(error, {
      ...context,
      ...resolveProjectedOwnershipTags({
        error,
        fallbackCodeTeam: options.fallbackCodeTeam ?? 'unowned',
      }),
    });
  };
}
