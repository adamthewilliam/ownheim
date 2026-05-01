export interface SyncCodeownersOptions {
  readonly authToken: string;
  readonly organization: string;
  readonly project: string;
  readonly codeowners: string;
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface SyncResult {
  readonly status: number;
  readonly ok: boolean;
}

export async function syncCodeowners(options: SyncCodeownersOptions): Promise<SyncResult> {
  const endpoint = options.endpoint ?? 'https://sentry.io/api/0';
  const url = `${endpoint}/projects/${options.organization}/${options.project}/codeowners/`;
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.authToken}`,
    },
    body: JSON.stringify({
      raw: options.codeowners,
      provider: 'github',
    }),
  });

  return { status: response.status, ok: response.ok };
}
