import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppClient } from '../src/index';
import { AuthPlugin } from '../src/auth';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('createAppClient', () => {
    it('creates core-only client when no plugins are requested', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const { client, auth, upload } = await createAppClient({
            baseURL: 'https://api.test',
        });

        expect(auth).toBeUndefined();
        expect(upload).toBeUndefined();

        const res = await client.get<{ ok: boolean }>('/ping');
        expect(res.data.ok).toBe(true);
    });

    it('wires ssl, auth, and upload in order', async () => {
        const order: string[] = [];

        globalThis.fetch = vi.fn(async (input, init) => {
            const headers = init?.headers as Record<string, string> | undefined;
            if (headers?.Authorization) {
                order.push('fetch-with-auth');
            }
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const { client, auth, upload } = await createAppClient({
            baseURL: 'https://api.test',
            ssl: true,
            auth: {
                tokenRefreshUrl: '/auth/refresh',
                storage: 'memory',
            },
            upload: true,
        });

        expect(auth).toBeDefined();
        expect(upload).toBeDefined();
        expect(AuthPlugin.getForClient(client)).toBe(auth);

        await auth!.setTokens({
            accessToken: 'token',
            refreshToken: 'refresh',
        });

        await client.get('/protected');
        expect(order).toContain('fetch-with-auth');
    });

    it('is available from the /app entry (static bundle)', async () => {
        const { createAppClient: createFromApp } = await import('../src/app');
        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const { client } = await createFromApp({ baseURL: 'https://api.test' });
        const res = await client.get<{ ok: boolean }>('/ping');
        expect(res.data.ok).toBe(true);
    });
});
