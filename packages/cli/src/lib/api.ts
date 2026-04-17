import { getToken, getRelayUrl, loadConfig, saveConfig } from './config.js';

interface ApiOptions {
  method?: string;
  body?: unknown;
  requireAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, requireAuth = true } = options;
  const relayUrl = getRelayUrl();
  const url = `${relayUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated. Run `gp auth` first.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const refreshedToken = response.headers.get('X-GP-Refreshed-Token');
  if (refreshedToken) {
    const config = loadConfig();
    if (config.auth) {
      config.auth.token = refreshedToken;
      const payload = JSON.parse(
        Buffer.from(refreshedToken.split('.')[1], 'base64').toString()
      );
      config.auth.expires_at = new Date(payload.exp * 1000).toISOString();
      saveConfig(config);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((error as { error: string }).error || `HTTP ${response.status}`);
  }

  if (response.headers.get('content-type')?.includes('text/plain')) {
    return (await response.text()) as unknown as T;
  }

  return response.json() as Promise<T>;
}
