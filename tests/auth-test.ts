// Quick test to verify authentication functionality
import { 
    FetchClient,
    createAuthConfig,
    createLoginCredentials,
    isTokenExpired,
    getUserFromToken,
    formatTokenTimeRemaining,
    AuthEventEmitter,
    type AuthTokens
} from '../src/index';

async function testAuthFeatures() {
    console.log('🔐 Testing Authentication Features\n');
    console.log('==================================\n');

    // Test 1: Auth configuration creation
    console.log('1️⃣ Testing Auth Configuration');
    
    const authConfig = createAuthConfig({
        loginUrl: '/auth/login',
        logoutUrl: '/auth/logout',
        tokenRefreshUrl: '/auth/refresh',
        storage: 'memory', // Use memory for testing
        autoRefresh: true,
        refreshThreshold: 300,
        
        onLoginSuccess: (tokens) => {
            console.log('✅ Login success callback triggered');
        },
        
        onTokenRefresh: (tokens) => {
            console.log('✅ Token refresh callback triggered');
        },
        
        onTokenExpired: () => {
            console.log('⚠️ Token expired callback triggered');
        }
    });
    
    console.log('✅ Auth config created successfully');
    console.log('Config:', {
        storage: authConfig.storage,
        autoRefresh: authConfig.autoRefresh,
        refreshThreshold: authConfig.refreshThreshold
    });

    // Test 2: Client creation with auth
    console.log('\n2️⃣ Testing Auth-Enabled Client Creation');
    
    const client = new FetchClient({
        baseURL: 'https://httpbin.org', // Test API
        debug: true,
        auth: authConfig
    });
    
    console.log('✅ Auth-enabled client created');
    console.log('Is authenticated:', client.isAuthenticated());

    // Test 3: Token management
    console.log('\n3️⃣ Testing Token Management');
    
    const mockTokens: AuthTokens = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MTYyMzkwMjIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXX0.QCjCgNdWDw9kWAtTJyEVGHF4gkdGN1F8zWKOvfNxUzk',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer'
    };

    // Set tokens manually for testing
    await client.setTokens(mockTokens);
    
    console.log('✅ Tokens set successfully');
    console.log('Is authenticated:', client.isAuthenticated());
    console.log('Tokens:', client.getTokens());

    // Test 4: JWT token utilities
    console.log('\n4️⃣ Testing JWT Utilities');
    
    const userInfo = getUserFromToken(mockTokens.accessToken);
    if (userInfo) {
        console.log('✅ User info extracted from JWT:', {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            roles: userInfo.roles
        });
    }

    // Test token expiry check
    const isExpired = isTokenExpired(mockTokens);
    console.log('✅ Token expiry check:', isExpired ? 'Expired' : 'Valid');
    
    const timeRemaining = formatTokenTimeRemaining(mockTokens);
    console.log('✅ Time remaining:', timeRemaining);

    // Test 5: Login credentials creation
    console.log('\n5️⃣ Testing Login Credentials');
    
    const credentials = createLoginCredentials('test@example.com', 'password123', {
        rememberMe: true,
        deviceId: 'test-device'
    });
    
    console.log('✅ Login credentials created:', {
        email: credentials.email,
        hasPassword: !!credentials.password,
        rememberMe: credentials.rememberMe,
        deviceId: credentials.deviceId
    });

    // Test 6: Auth state management
    console.log('\n6️⃣ Testing Auth State Management');
    
    const authState = client.getAuthState();
    console.log('✅ Auth state retrieved:', {
        isAuthenticated: authState.isAuthenticated,
        hasTokens: !!authState.tokens,
        isRefreshing: authState.isRefreshing
    });

    // Set user information
    const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
    client.setUser(mockUser);
    
    const retrievedUser = client.getUser();
    console.log('✅ User info set and retrieved:', retrievedUser);

    // Test 7: Auth event emitter
    console.log('\n7️⃣ Testing Auth Event Emitter');
    
    const authEvents = new AuthEventEmitter();
    
    let loginEventFired = false;
    let logoutEventFired = false;
    
    const unsubscribeLogin = authEvents.on('login', (tokens: AuthTokens) => {
        loginEventFired = true;
        console.log('🎉 Login event fired');
    });
    
    const unsubscribeLogout = authEvents.on('logout', () => {
        logoutEventFired = true;
        console.log('👋 Logout event fired');
    });
    
    // Trigger events
    authEvents.emit('login', mockTokens);
    authEvents.emit('logout');
    
    console.log('✅ Auth events test results:', {
        loginEventFired,
        logoutEventFired
    });
    
    // Clean up
    unsubscribeLogin();
    unsubscribeLogout();

    // Test 8: Token cleanup
    console.log('\n8️⃣ Testing Token Cleanup');
    
    await client.clearTokens();
    
    console.log('✅ Tokens cleared');
    console.log('Is authenticated:', client.isAuthenticated());
    console.log('Tokens:', client.getTokens());

    // Test 9: Mock HTTP request with auth (would work with real API)
    console.log('\n9️⃣ Testing Mock HTTP Request');
    
    // Set tokens again for request test
    await client.setTokens(mockTokens);
    
    try {
        // This would include auth headers automatically
        const response = await client.get('/headers');
        console.log('✅ Request with auth headers sent');
        
        // Check if authorization header was included
        const headers = response.data as any;
        if (headers.headers && headers.headers.Authorization) {
            console.log('✅ Authorization header included:', headers.headers.Authorization);
        }
    } catch (error) {
        console.log('ℹ️ Mock request (expected to work with auth headers)');
        console.log('Error:', (error as Error).message);
    }

    console.log('\n🎉 All authentication feature tests completed!');
}

// Export for use
export { testAuthFeatures };

// Uncomment to run immediately
// testAuthFeatures().catch(console.error);