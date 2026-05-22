/**
 * Verifies automatic retry after 401 + token refresh (v3 auth plugin)
 */
import { FetchClient } from '../src/index';
import { AuthPlugin, createAuthPlugin } from '../src/auth';

const originalFetch = globalThis.fetch;

async function test401RetryAfterRefresh() {
    console.log('🔐 Testing 401 retry after token refresh\n');

    let call = 0;

    globalThis.fetch = async (input, init) => {
        call++;
        const url = String(input);

        if (url.includes('/auth/refresh')) {
            return new Response(
                JSON.stringify({
                    accessToken: 'new-access-token',
                    refreshToken: 'refresh-token',
                    expiresIn: 3600,
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (call === 1) {
            return new Response('Unauthorized', {
                status: 401,
                statusText: 'Unauthorized',
            });
        }

        return new Response(JSON.stringify({ id: 1, ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
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

        if (response.status !== 200 || response.data.ok !== true) {
            throw new Error(`Expected successful retry, got status ${response.status}`);
        }

        if (call < 3) {
            throw new Error(`Expected 3 fetch calls (401, refresh, retry), got ${call}`);
        }

        console.log('✅ 401 → refresh → retry succeeded');
        console.log(`   Fetch calls: ${call}`);
        console.log(`   Response:`, response.data);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function test401NoRetryWhenDisabled() {
    console.log('\n🔐 Testing 401 without retry (retryAfterRefresh: false)\n');

    let call = 0;

    globalThis.fetch = async () => {
        call++;
        if (call === 1) {
            return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        }
        return new Response(JSON.stringify({ accessToken: 'new', refreshToken: 'r' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            retryAfterRefresh: false,
        });

        await auth.setTokens({ accessToken: 'old', refreshToken: 'refresh-token' });

        try {
            await client.get('/protected');
            throw new Error('Expected request to fail');
        } catch (error) {
            const e = error as Error & { status?: number };
            if (e.status !== 401) {
                throw new Error(`Expected 401, got ${e.status ?? e.message}`);
            }
            console.log('✅ Request correctly failed with 401 after refresh (no retry)');
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function testDuplicateCreateAuthPlugin() {
    console.log('\n🔐 Testing duplicate createAuthPlugin on same client\n');

    const client = new FetchClient({ baseURL: 'https://api.test' });
    const auth1 = await createAuthPlugin(client, { storage: 'memory' });
    const auth2 = await createAuthPlugin(client, { storage: 'memory' });

    if (auth1 !== auth2) {
        throw new Error('Expected same AuthPlugin instance when createAuthPlugin is called twice');
    }

    if (AuthPlugin.getForClient(client) !== auth1) {
        throw new Error('getForClient should return the registered plugin');
    }

    auth1.teardown();

    const auth3 = await createAuthPlugin(client, { storage: 'memory' });
    if (auth3 === auth1) {
        throw new Error('Expected new instance after teardown');
    }

    auth3.teardown();
    console.log('✅ Duplicate createAuthPlugin reuses instance; teardown allows re-register');
}

async function testParallel401SingleRefreshWave() {
    console.log('\n🔐 Testing parallel 401 → one refresh wave\n');

    let refreshCalls = 0;
    let protectedCalls = 0;

    globalThis.fetch = async (input) => {
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
    };

    try {
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

        if (!a.data.ok || !b.data.ok || !c.data.ok) {
            throw new Error('All parallel retries should succeed');
        }

        if (refreshCalls !== 1) {
            throw new Error(`Expected exactly 1 refresh call, got ${refreshCalls}`);
        }

        if (protectedCalls !== 6) {
            throw new Error(`Expected 6 protected calls (3×401 + 3×retry), got ${protectedCalls}`);
        }

        console.log('✅ Parallel 401: 1 refresh, 3 retries succeeded');
        console.log(`   refreshCalls=${refreshCalls}, protectedCalls=${protectedCalls}`);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function run() {
    await test401RetryAfterRefresh();
    await test401NoRetryWhenDisabled();
    await testDuplicateCreateAuthPlugin();
    await testParallel401SingleRefreshWave();
    console.log('\n🎉 Auth 401 retry tests passed');
}

run().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
