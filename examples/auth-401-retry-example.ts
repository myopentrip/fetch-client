/**
 * Auth plugin: 401 → refresh → retry (offline demo with mocked fetch)
 * Run: pnpm run example:auth:401
 */
import { FetchClient } from '../src/index';
import { createAuthPlugin } from '../src/auth';

const originalFetch = globalThis.fetch;

async function run() {
    console.log('🔐 401 refresh + retry (mocked fetch)\n');

    let call = 0;

    globalThis.fetch = async (input) => {
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

        return new Response(JSON.stringify({ ok: true, id: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const client = new FetchClient({ baseURL: 'https://api.example.com' });
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            retryAfterRefresh: true,
        });

        await auth.setTokens({
            accessToken: 'old-token',
            refreshToken: 'refresh-token',
        });

        const response = await client.get<{ ok: boolean }>('/protected');
        console.log('✅ Retry succeeded:', response.status, response.data);
        console.log(`   fetch calls: ${call} (401 → refresh → retry)`);
        console.log(`   response.meta:`, response.meta);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

void run().catch(console.error);
