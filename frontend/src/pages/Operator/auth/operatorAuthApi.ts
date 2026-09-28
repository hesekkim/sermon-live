let csrfToken: string | null = null;

interface OperatorSessionResponse {
  authenticated: boolean;
  csrf_token?: string;
}

export function setOperatorCsrfToken(token: string | null) {
  csrfToken = token;
}

export async function fetchOperatorSession(): Promise<OperatorSessionResponse> {
  const response = await fetch('/api/v1/auth/session', {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Operator session unavailable');
  return (await response.json()) as OperatorSessionResponse;
}

export async function loginOperator(password: string): Promise<string> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'invalid-password' : 'unavailable');
    throw error;
  }
  const result = (await response.json()) as OperatorSessionResponse;
  if (!result.authenticated || !result.csrf_token) {
    throw new Error('unavailable');
  }
  return result.csrf_token;
}

export async function operatorFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { redirectOnAuthFailure?: boolean } = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  if (
    options.redirectOnAuthFailure !== false &&
    (response.status === 401 || response.status === 403)
  ) {
    window.dispatchEvent(new Event('operator-auth-expired'));
  }
  return response;
}

export async function logoutOperator(): Promise<void> {
  const response = await operatorFetch(
    '/api/v1/auth/logout',
    { method: 'POST' },
    { redirectOnAuthFailure: false }
  );
  if (!response.ok) throw new Error('Operator logout failed');
  setOperatorCsrfToken(null);
}