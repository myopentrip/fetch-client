/**
 * Cookie auth utilities + plugin config (v3)
 * Run: pnpm run example:cookie
 */
import { FetchClient } from '../src/index';
import {
    createAuthPlugin,
    createAuthConfig,
    createCookieStorage,
    setCookie,
    getCookie,
    removeCookie,
    CookieSession,
} from '../src/auth';

async function cookieStorageAuth() {
    const client = new FetchClient({ baseURL: 'https://api.example.com' });

    const auth = await createAuthPlugin(
        client,
        createAuthConfig({
            storage: 'cookie',
            loginUrl: '/auth/login',
            tokenRefreshUrl: '/auth/refresh',
            cookieOptions: {
                secure: true,
                sameSite: 'strict',
                maxAge: 8 * 60 * 60,
                path: '/',
            },
        })
    );

    await auth.setTokens({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600,
    });

    return auth;
}

async function cookieUtilities() {
    setCookie('prefs', JSON.stringify({ theme: 'dark' }), { sameSite: 'lax', maxAge: 86400 });
    console.log('Cookie:', getCookie('prefs'));
    removeCookie('prefs');

    const session = new CookieSession('app-session', { secure: true, maxAge: 3600 });
    session.set({ userId: 1 });
    console.log('Session:', session.get());
    session.clear();

    const storage = createCookieStorage({ path: '/', sameSite: 'lax' });
    storage.setItem('key', 'value');
    console.log('Storage:', storage.getItem('key'));
}

async function run() {
    console.log('Cookie utilities (browser-oriented; limited in Node)\n');
    await cookieUtilities();
}

void run().catch(console.error);

export { cookieStorageAuth, cookieUtilities };
