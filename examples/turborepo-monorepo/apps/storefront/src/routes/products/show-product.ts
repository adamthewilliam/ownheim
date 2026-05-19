import { findProduct } from '@acme/catalog';

export function showProduct(id: string) {
  return findProduct(id);
}
