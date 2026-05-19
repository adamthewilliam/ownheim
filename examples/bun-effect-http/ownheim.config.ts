import { defineOwnheim } from '@ownheim/core/defineOwnheim';

export default defineOwnheim({
  fallback: 'Platform',
  teams: {
    Billing: {
      github: '@org/billing',
      handles: { pagerduty: 'billing-primary' },
      owns: ['src/billing/**'],
    },
    Identity: {
      github: '@org/identity',
      handles: { pagerduty: 'identity-primary' },
      owns: ['src/auth/**'],
    },
    Platform: {
      github: '@org/platform',
      handles: { pagerduty: 'platform-second' },
      owns: ['src/billing/admin/**'],
    },
  },
});
