import { defineOwnheim } from '@ownheim/core/defineOwnheim';

export default defineOwnheim({
  fallback: 'Platform',
  teams: {
    Platform: {
      github: '@acme/platform',
      handles: { slack: '#platform-oncall', pagerduty: 'platform-primary' },
      owns: ['packages/core/**', 'apps/storefront/src/platform/**'],
    },
    Checkout: {
      github: '@acme/checkout',
      handles: { slack: '#checkout-team', pagerduty: 'checkout-primary' },
      owns: ['packages/checkout/**', 'apps/storefront/src/routes/checkout/**'],
    },
    Catalog: {
      github: '@acme/catalog',
      handles: { slack: '#catalog-team', pagerduty: 'catalog-primary' },
      owns: ['packages/catalog/**', 'apps/storefront/src/routes/products/**'],
    },
  },
  shared: [
    {
      glob: 'apps/storefront/src/routes/product-checkout/**',
      owners: ['Catalog', 'Checkout'],
    },
  ],
});
