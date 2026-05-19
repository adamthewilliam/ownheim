import { auditSourceFile, createAttentionFinding } from '@ownheim/build/auditOwnership';
import type { Team, OwnheimConfig } from '@ownheim/core/types';
import type { Diagnostic } from './types.ts';

export interface ValidateOptions<TTeams extends Record<string, Team>> {
  readonly filePath: string;
  readonly sourceText: string;
  readonly config: OwnheimConfig<TTeams>;
}

export function validateFileOwnership<TTeams extends Record<string, Team>>(
  options: ValidateOptions<TTeams>,
): Diagnostic[] {
  const audit = auditSourceFile(options.config, {
    filePath: options.filePath,
    sourceText: options.sourceText,
  });

  if (audit.status === 'explicit') return [];

  const finding = createAttentionFinding(audit);
  return [
    {
      ruleId: 'no-ownheim',
      severity: 'error',
      message: finding.message,
      line: 1,
      column: 1,
      ...(finding.fixable
        ? {
            fix: {
              description: 'Add /** @owner TODO */ JSDoc',
              insertAt: 0,
              insertText: '/** @owner TODO */\n',
            },
          }
        : {}),
    },
  ];
}
