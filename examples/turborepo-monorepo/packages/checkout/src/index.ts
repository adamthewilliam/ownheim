import { dollars, type Money } from '@acme/core';

export type CartLine = {
  readonly sku: string;
  readonly cents: number;
  readonly quantity: number;
};

export function priceCart(lines: readonly CartLine[]): { readonly subtotal: Money; readonly tax: Money; readonly total: Money } {
  const subtotal = lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);
  const tax = Math.round(subtotal * 0.0825);

  return {
    subtotal: dollars(subtotal),
    tax: dollars(tax),
    total: dollars(subtotal + tax),
  };
}
