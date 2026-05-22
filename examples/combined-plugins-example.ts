/**
 * Wiring core + auth + upload + SSL on one FetchClient (setup walkthrough, offline)
 * Run: pnpm run example:combined
 */
import { FetchClient } from '../src/index';
import { createAuthPlugin } from '../src/auth';
import { createUploadPlugin } from '../src/upload';
import { createSSLErrorPlugin } from '../src/ssl';

const originalFetch = globalThis.fetch;

async function run() {
    console.log('🧩 Combined plugins (typical app setup)\n');

    globalThis.fetch = async (input, init) => {
        const headers = init?.headers as Record<string, string> | undefined;
        console.log(`   → fetch ${init?.method ?? 'GET'} ${String(input)}`);
        if (headers?.Authorization) {
            console.log(`     Authorization: ${headers.Authorization.slice(0, 20)}…`);
        }
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const client = new FetchClient({
            baseURL: 'https://api.example.com',
            retries: 2,
            debug: false,
        });

        // 1) SSL — opt-in via client.use(); transforms certificate errors on the error path
        await client.use(
            createSSLErrorPlugin({
                includeSuggestions: true,
                includeTechnicalDetails: false,
            })
        );
        console.log('1️⃣ SSL plugin registered (error interceptor)');

        // 2) Auth — async init; adds Bearer + 401 recovery when configured
        const auth = await createAuthPlugin(client, {
            tokenRefreshUrl: '/auth/refresh',
            storage: 'memory',
            autoRefresh: true,
            retryAfterRefresh: true,
        });
        await auth.setTokens({ accessToken: 'demo-token', refreshToken: 'refresh' });
        console.log('2️⃣ Auth plugin ready, authenticated:', auth.isAuthenticated());

        // 3) Upload — separate plugin object; shares the same client
        const upload = createUploadPlugin(client);
        console.log('3️⃣ Upload plugin created (uploadFile / uploadFormData / progress)');

        await client.get('/dashboard');
        console.log('4️⃣ Protected GET uses auth request interceptor');

        console.log('\n📌 Insights:');
        console.log('   • Order: create client → use(SSL) → createAuthPlugin → createUploadPlugin');
        console.log('   • Auth & upload do not extend FetchClient — they register hooks on it');
        console.log('   • Upload WITH onProgress uses XHR (no retry/interceptors on that path)');
        console.log('   • Upload WITHOUT onProgress uses client.request() (full pipeline)');
        console.log('   • Only one auth plugin per client unless you teardown() first');

        void upload;
    } finally {
        globalThis.fetch = originalFetch;
    }

    console.log('\n💡 Live SSL: pnpm run example:ssl | Live upload: pnpm run example:upload');
}

void run().catch(console.error);
