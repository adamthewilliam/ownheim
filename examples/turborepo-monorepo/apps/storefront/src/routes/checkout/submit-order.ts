import { priceCart } from '@acme/checkout';

export function submitOrder() {
  return priceCart([{ sku: 'sku-1', cents: 2500, quantity: 2 }]);
}
