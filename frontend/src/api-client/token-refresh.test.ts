import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authFetch } from './client';
import { useAuthStore } from '../features/authentication/auth.store';

// DESC #4: refresh tokens are single-use. When several requests hit an
// expired access token at once, exactly one refresh may go to the server —
// a second refresh with the same token would look like theft and end the session.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('authFetch token refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().setSession({
      accessToken: 'expired-access',
      refreshToken: 'refresh-1',
      user: { id: 'u1', email: 'a@example.com', displayName: 'A', role: 'ADMIN', preferredLanguage: 'en', preferredTheme: 'system' },
    });
  });

  it('refreshes once for many simultaneous 401s, then retries each request with the new token', async () => {
    const refreshCalls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls.push(JSON.parse(String(init?.body)).refreshToken);
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: 'fresh-access', refreshToken: 'refresh-2', user: useAuthStore.getState().user });
      }
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return auth === 'Bearer fresh-access' ? json(200, { ok: url }) : json(401, { code: 'SESSION_ENDED' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([authFetch('/products'), authFetch('/dashboard/summary'), authFetch('/suppliers')]);

    expect(refreshCalls).toEqual(['refresh-1']);
    expect(results).toHaveLength(3);
    expect(useAuthStore.getState().refreshToken).toBe('refresh-2');
  });

  it('signs the person out when the refresh is refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/refresh') ? json(401, { code: 'INVALID_REFRESH_TOKEN' }) : json(401, { code: 'SESSION_ENDED' })));
    await expect(authFetch('/products')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
