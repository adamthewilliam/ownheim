// Minimal in-memory span record. Wave 2's otel agent owns the adapter that
// maps `@opentelemetry/api`'s `ReadableSpan` to this shape; we deliberately
// do not depend on any OTel SDK package here so the test-utils stay
// dependency-free.
export interface RecordedSpan {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly startTimeNs: number;
  readonly endTimeNs: number;
}
