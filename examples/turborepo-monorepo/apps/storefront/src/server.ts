import { createRequestId } from '@acme/core';
import { priceCart } from '@acme/checkout';
import { findProduct } from '@acme/catalog';

export function renderProductCheckout(productId: string) {
  const requestId = createRequestId();
  const product = findProduct(productId);
  const quote = priceCart([{ sku: product.sku, cents: product.cents, quantity: 1 }]);

  return { requestId, product, quote };
}
