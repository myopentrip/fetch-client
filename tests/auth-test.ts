// Auth plugin tests (v3)
import { FetchClient } from '../src/index';
import {
    createAuthPlugin,
    createAuthConfig,
    createLoginCredentials,
    isTokenExpired,
    getUserFromToken,
    formatTokenTimeRemaining,
    AuthEventEmitter,
    type AuthTokens,
} from '../src/auth';

async function testAuthFeatures() {
    console.log('🔐 Testing Auth Plugin (v3)\n');

    const client = new FetchClient({
        baseURL: 'https://httpbin.org',
        debug: true,
    });

    const authConfig = createAuthConfig({
        storage: 'memory',
        autoRefresh: true,
        refreshThreshold: 300,
        onLoginSuccess: () => console.log('✅ onLoginSuccess'),
        onTokenRefresh: () => console.log('✅ onTokenRefresh'),
        onTokenExpired: () => console.log('⚠️ onTokenExpired'),
    });

    const auth = await createAuthPlugin(client, authConfig);
    console.log('✅ Auth plugin created, authenticated:', auth.isAuthenticated());

    const mockTokens: AuthTokens = {
        accessToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MTYyMzkwMjIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXX0.QCjCgNdWDw9kWAtTJyEVGHF4gkdGN1F8zWKOvfNxUzk',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer',
    };

    await auth.setTokens(mockTokens);
    console.log('✅ Tokens set, authenticated:', auth.isAuthenticated());

    const userInfo = getUserFromToken(mockTokens.accessToken);
    console.log('✅ JWT user:', userInfo?.email ?? userInfo?.name);
    console.log('✅ Token expiry:', isTokenExpired(mockTokens) ? 'expired' : 'valid');
    console.log('✅ Time remaining:', formatTokenTimeRemaining(mockTokens));

    const credentials = createLoginCredentials('test@example.com', 'password123', {
        rememberMe: true,
    });
    console.log('✅ Credentials:', credentials.email);

    const authState = auth.getAuthState();
    console.log('✅ Auth state:', {
        isAuthenticated: authState.isAuthenticated,
        isRefreshing: authState.isRefreshing,
    });

    auth.setUser({ id: '123', name: 'John Doe' });
    console.log('✅ User:', auth.getUser());

    const authEvents = new AuthEventEmitter();
    let loginEventFired = false;
    authEvents.on('login', () => {
        loginEventFired = true;
    });
    authEvents.emit('login', mockTokens);
    console.log('✅ AuthEventEmitter login:', loginEventFired);

    await auth.clearTokens();
    console.log('✅ Cleared, authenticated:', auth.isAuthenticated());

    await auth.setTokens(mockTokens);
    try {
        const response = await client.get('/headers');
        const data = response.data as { headers?: { Authorization?: string } };
        if (data.headers?.Authorization) {
            console.log('✅ Auth header on request:', data.headers.Authorization.slice(0, 20) + '...');
        }
    } catch (error) {
        console.log('ℹ️ httpbin request:', (error as Error).message);
    }

    console.log('\n🎉 Auth plugin tests completed');
}

export { testAuthFeatures };
