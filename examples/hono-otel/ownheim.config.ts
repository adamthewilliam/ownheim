import { defineOwnheim } from '@ownheim/core/defineOwnheim';

export default defineOwnheim({
  fallback: 'Platform',
  teams: {
    Platform: { github: '@acme/platform', owns: ['ownheim.config.ts', 'src/server.ts'] },
    Billing: { github: '@acme/billing', owns: ['src/billing/**'] },
    Identity: { github: '@acme/identity', owns: ['src/identity/**'] },
  },
});
