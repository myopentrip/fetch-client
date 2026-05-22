/**
 * Core patterns: meta, PATCH, custom timeout, request(), FetchError (mocked fetch)
 * Run: pnpm run example:core
 */
import { FetchClient, type FetchError } from '../src/index';

const originalFetch = globalThis.fetch;

async function run() {
    console.log('📘 Core patterns (offline mock)\n');

    globalThis.fetch = async (_input, init) => {
        const method = init?.method ?? 'GET';
        return new Response(
            JSON.stringify({ method, ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    };

    try {
        const client = new FetchClient({
            baseURL: 'https://api.example.com',
            timeout: 10_000,
            headers: { Accept: 'application/json' },
        });

        // 1) Typed GET + response.meta (path/method on every response)
        const list = await client.get<{ ok: boolean }>('/users');
        console.log('1️⃣ GET + meta:', list.meta.path, list.meta.method, list.data);

        // 2) PATCH partial update
        const patched = await client.patch<{ method: string }>('/users/1', { active: true });
        console.log('2️⃣ PATCH:', patched.data.method);

        // 3) Per-request timeout (overrides client default for this call only)
        await client.request<{ ok: boolean }>('GET', '/slow', { timeout: 30_000 });
        console.log('3️⃣ request() with per-call timeout: OK');

        // 4) resolveURL helper (absolute path bypasses baseURL)
        console.log('4️⃣ resolveURL:', client.resolveURL('/v1/items'));
        console.log('   absolute:', client.resolveURL('https://cdn.example.com/asset.png'));

        // 5) FetchError: HTTP vs network
        globalThis.fetch = async () => new Response('Nope', { status: 422, statusText: 'Unprocessable' });
        try {
            await client.post('/users', { name: '' });
        } catch (error) {
            const e = error as FetchError;
            console.log('5️⃣ HTTP error:', e.status, e.message);
        }

        globalThis.fetch = async () => {
            throw new TypeError('Failed to fetch');
        };
        try {
            await client.get('/users');
        } catch (error) {
            const e = error as FetchError;
            console.log('5️⃣ Network error:', e.status ?? '(no status)', e.message);
        }
    } finally {
        globalThis.fetch = originalFetch;
    }

    console.log('\n💡 Retry & interceptors: see advanced-example.ts and interceptor-examples.ts');
    console.log('💡 Cancellation: see advanced-example.ts (AbortSignal)');
}

void run().catch(console.error);
