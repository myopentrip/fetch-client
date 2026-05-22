/**
 * Auth plugin examples (v3)
 */
import { FetchClient } from '../src/index';
import {
    createAuthPlugin,
    createAuthConfig,
    createLoginCredentials,
    formatTokenTimeRemaining,
    getUserFromToken,
} from '../src/auth';

async function basicAuthSetup() {
    const client = new FetchClient({ baseURL: 'https://api.example.com', debug: true });

    const auth = await createAuthPlugin(
        client,
        createAuthConfig({
            loginUrl: '/auth/login',
            logoutUrl: '/auth/logout',
            tokenRefreshUrl: '/auth/refresh',
            storage: 'localStorage',
            autoRefresh: true,
            retryAfterRefresh: true,
            onLoginSuccess: (tokens) => {
                console.log('Logged in, expires:', formatTokenTimeRemaining(tokens));
            },
            onTokenExpired: () => console.log('Session expired — redirect to login'),
        })
    );

    return { client, auth };
}

async function authenticationFlow() {
    const { client, auth } = await basicAuthSetup();

    try {
        await auth.login(
            createLoginCredentials('user@example.com', 'password123', { rememberMe: true })
        );
        console.log('Auth state:', auth.getAuthState());

        await client.get('/user/profile');

        if (auth.isTokenExpired()) {
            await auth.refreshTokens();
        }

        await auth.logout();
    } catch (error) {
        console.error('Auth flow error:', (error as Error).message);
    }
}

async function manualTokens() {
    const client = new FetchClient({ baseURL: 'https://api.example.com' });
    const auth = await createAuthPlugin(client, createAuthConfig({ storage: 'memory' }));

    await auth.setTokens({
        accessToken: 'your-access-token',
        refreshToken: 'your-refresh-token',
        expiresIn: 3600,
    });

    const user = getUserFromToken(auth.getTokens()!.accessToken);
    console.log('User from JWT:', user);
}

export { basicAuthSetup, authenticationFlow, manualTokens };

// authenticationFlow().catch(console.error);
