import { priceCart } from '@acme/checkout';
import { findProduct } from '@acme/catalog';

export function buyNow(productId: string) {
  const product = findProduct(productId);
  return priceCart([{ sku: product.sku, cents: product.cents, quantity: 1 }]);
}
