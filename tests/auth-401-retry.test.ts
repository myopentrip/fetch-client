import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchClient } from '../src/index';
import { AuthPlugin, createAuthPlugin } from '../src/auth';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('auth plugin 401 retry', () => {
    it('retries protected request after token refresh', async () => {
        let call = 0;

        globalThis.fetch = vi.fn(async (input) => {
            call++;
            const url = String(input);

            if (url.includes('/auth/refresh')) {
                return new Response(
                    JSON.stringify({
                        accessToken: 'new-access-token',
                        refreshToken: 'refresh-token',
                        expiresIn: 3600,
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }

            if (call === 1) {
                return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
            }

            return new Response(JSON.stringify({ id: 1, ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            autoRefresh: true,
            retryAfterRefresh: true,
        });

        await auth.setTokens({
            accessToken: 'old-token',
            refreshToken: 'refresh-token',
        });

        const response = await client.get<{ id: number; ok: boolean }>('/protected');

        expect(response.status).toBe(200);
        expect(response.data.ok).toBe(true);
        expect(call).toBeGreaterThanOrEqual(3);
    });

    it('does not retry when retryAfterRefresh is false', async () => {
        let call = 0;

        globalThis.fetch = vi.fn(async () => {
            call++;
            if (call === 1) {
                return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
            }
            return new Response(JSON.stringify({ accessToken: 'new', refreshToken: 'r' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            retryAfterRefresh: false,
        });

        await auth.setTokens({ accessToken: 'old', refreshToken: 'refresh-token' });

        await expect(client.get('/protected')).rejects.toMatchObject({ status: 401 });
    });

    it('reuses AuthPlugin instance until teardown', async () => {
        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth1 = await createAuthPlugin(client, { storage: 'memory' });
        const auth2 = await createAuthPlugin(client, { storage: 'memory' });

        expect(auth2).toBe(auth1);
        expect(AuthPlugin.getForClient(client)).toBe(auth1);

        auth1.teardown();

        const auth3 = await createAuthPlugin(client, { storage: 'memory' });
        expect(auth3).not.toBe(auth1);
        auth3.teardown();
    });

    it('coalesces parallel 401 into a single refresh wave', async () => {
        let refreshCalls = 0;
        let protectedCalls = 0;

        globalThis.fetch = vi.fn(async (input) => {
            const url = String(input);

            if (url.includes('/auth/refresh')) {
                refreshCalls++;
                return new Response(
                    JSON.stringify({
                        accessToken: 'new-token',
                        refreshToken: 'refresh-token',
                        expiresIn: 3600,
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }

            protectedCalls++;
            if (protectedCalls <= 3) {
                return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
            }

            return new Response(JSON.stringify({ ok: true, path: url }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            retryAfterRefresh: true,
        });

        await auth.setTokens({
            accessToken: 'old',
            refreshToken: 'refresh-token',
        });

        const [a, b, c] = await Promise.all([
            client.get<{ ok: boolean }>('/protected/a'),
            client.get<{ ok: boolean }>('/protected/b'),
            client.get<{ ok: boolean }>('/protected/c'),
        ]);

        expect(a.data.ok && b.data.ok && c.data.ok).toBe(true);
        expect(refreshCalls).toBe(1);
        expect(protectedCalls).toBe(6);
    });
});
