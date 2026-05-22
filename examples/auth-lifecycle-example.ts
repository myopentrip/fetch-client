/**
 * Auth plugin lifecycle: singleton per client, getForClient, teardown (offline)
 * Run: pnpm run example:auth:lifecycle
 */
import { FetchClient } from '../src/index';
import { AuthPlugin, createAuthPlugin } from '../src/auth';

async function run() {
    console.log('🔐 Auth plugin lifecycle\n');

    const client = new FetchClient({ baseURL: 'https://api.example.com' });

    const auth1 = await createAuthPlugin(client, { storage: 'memory' });
    const auth2 = await createAuthPlugin(client, { storage: 'memory' });

    console.log('1️⃣ Same client → same plugin instance:', auth1 === auth2);
    console.log('2️⃣ getForClient:', AuthPlugin.getForClient(client) === auth1);

    auth1.teardown();
    console.log('3️⃣ After teardown, getForClient:', AuthPlugin.getForClient(client) ?? '(none)');

    const auth3 = await createAuthPlugin(client, { storage: 'memory' });
    console.log('4️⃣ New plugin after teardown:', auth3 !== auth1);

    auth3.teardown();

    console.log('\n💡 401 refresh + retry narrative: pnpm run example:auth:401');
    console.log('💡 Login/logout against a real API: auth-examples.ts (authenticationFlow)');
}

void run().catch(console.error);
