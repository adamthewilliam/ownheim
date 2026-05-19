export type Product = {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly cents: number;
};

const products: Record<string, Product> = {
  'coffee-mug': { id: 'coffee-mug', sku: 'sku-1', name: 'Stoneware coffee mug', cents: 2500 },
};

export function findProduct(id: string): Product {
  const product = products[id];
  if (!product) throw new Error(`Product not found: ${id}`);
  return product;
}
