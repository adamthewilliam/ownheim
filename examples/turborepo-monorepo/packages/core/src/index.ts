export type Money = {
  readonly cents: number;
  readonly currency: 'USD';
};

export function dollars(cents: number): Money {
  return { cents, currency: 'USD' };
}

export function createRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}
