import { extractFromSourceText } from '@strays/build/analyzeSourceFile';
import { resolveOwnerForFile } from '@strays/build/resolveRules';
import type { Team, StraysConfig } from '@strays/core/types';
import type { Diagnostic } from './types.ts';

export interface ValidateOptions<TTeams extends Record<string, Team>> {
  readonly filePath: string;
  readonly sourceText: string;
  readonly config: StraysConfig<TTeams>;
}

export function validateFileOwnership<TTeams extends Record<string, Team>>(
  options: ValidateOptions<TTeams>,
): Diagnostic[] {
  const extraction = extractFromSourceText(options.filePath, options.sourceText);
  const resolved = resolveOwnerForFile(options.config, {
    filePath: options.filePath,
    jsdocOwner: extraction.jsdocOwner,
  });

  if (resolved === undefined) {
    return [
      {
        ruleId: 'no-strays',
        severity: 'error',
        message: `${options.filePath} has no owner: no rule matched and no fallback is configured. Add a directory rule to strays.config.ts or annotate the file with /** @owner <Team> */.`,
        line: 1,
        column: 1,
        fix: {
          description: 'Add /** @owner TODO */ JSDoc',
          insertAt: 0,
          insertText: '/** @owner TODO */\n',
        },
      },
    ];
  }

  if (resolved.source === 'fallback') {
    return [
      {
        ruleId: 'no-strays',
        severity: 'error',
        message: `${options.filePath} only matches the fallback rule (${resolved.matchedGlob ?? '**'}). Add a directory rule for this path or annotate the file with /** @owner <Team> */.`,
        line: 1,
        column: 1,
        fix: {
          description: 'Add /** @owner TODO */ JSDoc',
          insertAt: 0,
          insertText: '/** @owner TODO */\n',
        },
      },
    ];
  }

  return [];
}
