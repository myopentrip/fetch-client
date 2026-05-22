import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    FetchClient,
    createAuthInterceptor,
    formatHTTPErrorMessage,
    getHTTPStatusDescription,
    type FetchError,
} from '../src/index';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('FetchClient', () => {
    it('resolveURL joins base and path', () => {
        const client = new FetchClient({ baseURL: 'https://api.test/' });
        expect(client.resolveURL('/users')).toBe('https://api.test/users');
        expect(client.resolveURL('https://other.test/x')).toBe('https://other.test/x');
    });

    it('parses JSON responses', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ hello: 'world' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        const res = await client.get<{ hello: string }>('/hello');

        expect(res.status).toBe(200);
        expect(res.data.hello).toBe('world');
    });

    it('request interceptors can add headers', async () => {
        let headersSent: Record<string, string> | undefined;

        globalThis.fetch = vi.fn(async (_input, init) => {
            headersSent = init?.headers as Record<string, string>;
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        client.addRequestInterceptor(createAuthInterceptor(() => 'token-abc'));
        client.addRequestInterceptor((config) => {
            config.headers = { ...config.headers, 'X-Correlation-ID': 'req-1' };
            return config;
        });

        await client.get('/posts/1');

        expect(headersSent?.['X-Correlation-ID']).toBe('req-1');
        expect(headersSent?.Authorization).toBe('Bearer token-abc');
    });

    it('passes an aborted signal to fetch', async () => {
        globalThis.fetch = vi.fn(async (_input, init) => {
            expect(init?.signal?.aborted).toBe(true);
            const err = new DOMException('The operation was aborted', 'AbortError');
            throw err;
        });

        const client = new FetchClient({ baseURL: 'https://api.test', timeout: 0 });
        const controller = new AbortController();
        controller.abort();

        await expect(client.get('/slow', { signal: controller.signal })).rejects.toThrow();
    });

    it('retries when retryCondition matches', async () => {
        let attempts = 0;

        globalThis.fetch = vi.fn(async () => {
            attempts++;
            if (attempts < 3) {
                return new Response('error', { status: 500, statusText: 'Internal Server Error' });
            }
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test', retries: 0 });
        client.updateRetryConfig({
            maxRetries: 2,
            baseDelay: 1,
            backoffFactor: 1,
            jitter: false,
            retryCondition: (error: FetchError) => error.status === 500,
        });

        const res = await client.get<{ ok: boolean }>('/flaky');
        expect(res.status).toBe(200);
        expect(attempts).toBe(3);
    });
});

describe('HTTP formatters', () => {
    it('maps status codes to descriptions', () => {
        expect(getHTTPStatusDescription(404)).toBe('Not Found');
        expect(formatHTTPErrorMessage(401, 'Unauthorized')).toContain('401');
    });
});
