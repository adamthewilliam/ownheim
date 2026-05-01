export type Severity = 'error' | 'warn' | 'off';

export interface FixSuggestion {
  readonly description: string;
  readonly insertAt: number;
  readonly insertText: string;
}

export interface Diagnostic {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly fix?: FixSuggestion;
}
