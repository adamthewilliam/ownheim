import { resolveOwner } from './resolveOwner.ts';

export interface DatadogRumLike {
  addError(error: unknown, context?: Record<string, unknown>): void;
  setGlobalContextProperty(key: string, value: unknown): void;
}

export function installDatadogRum(rum: DatadogRumLike, fallback = 'unowned'): void {
  const original = rum.addError.bind(rum);
  rum.addError = (error: unknown, context?: Record<string, unknown>) => {
    original(error, { ...context, team: resolveOwner(error, fallback) });
  };
}
