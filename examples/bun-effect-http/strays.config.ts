import { defineStrays } from '@strays/core/defineStrays';

export default defineStrays({
  owners: {
    Billing: { id: 'Billing', github: '@org/billing', pagerduty: 'billing-primary', tier: 1 },
    Identity: { id: 'Identity', github: '@org/identity', pagerduty: 'identity-primary', tier: 1 },
    Platform: { id: 'Platform', github: '@org/platform', pagerduty: 'platform-second', tier: 2 },
  },
  rules: [
    { glob: 'src/billing/**', owner: 'Billing' },
    { glob: 'src/auth/**', owner: 'Identity' },
    { glob: 'src/billing/admin/**', owner: 'Platform' },
    { glob: '**', owner: 'Platform', fallback: true },
  ],
});
