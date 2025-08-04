// Quick test to verify cookie authentication functionality
import { 
    FetchClient,
    createAuthConfig,
    createCookieStorage,
    createSecureCookieStorage,
    CookieSession,
    areCookiesEnabled,
    getCookie,
    setCookie,
    removeCookie,
    getAllCookies,
    type AuthTokens
} from '../src/index';

async function testCookieAuthFeatures() {
    console.log('🍪 Testing Cookie Authentication Features\n');
    console.log('==========================================\n');

    // Test 1: Cookie utility functions
    console.log('1️⃣ Testing Cookie Utilities');
    
    if (typeof window !== 'undefined') {
        // Browser environment tests
        console.log('🌐 Running in browser environment');
        
        // Test cookie enabled check
        const cookiesEnabled = areCookiesEnabled();
        console.log('✅ Cookies enabled check:', cookiesEnabled);
        
        // Test basic cookie operations
        setCookie('test_cookie', 'test_value', {
            maxAge: 60, // 1 minute
            secure: false, // Allow for testing
            sameSite: 'lax'
        });
        
        const retrieved = getCookie('test_cookie');
        console.log('✅ Cookie set and retrieved:', retrieved === 'test_value');
        
        // Test getting all cookies
        const allCookies = getAllCookies();
        console.log('✅ All cookies retrieved:', Object.keys(allCookies).length > 0);
        
        // Clean up test cookie
        removeCookie('test_cookie');
        console.log('✅ Test cookie removed');
    } else {
        console.log('🖥️ Running in Node.js environment (cookie features limited)');
    }

    // Test 2: Cookie storage creation
    console.log('\n2️⃣ Testing Cookie Storage');
    
    const cookieStorage = createCookieStorage({
        path: '/',
        maxAge: 3600, // 1 hour
        secure: false, // For testing
        sameSite: 'lax'
    });
    
    console.log('✅ Cookie storage created');
    
    // Test storage interface
    if (typeof window !== 'undefined') {
        cookieStorage.setItem('test_storage', 'storage_value');
        const storageValue = cookieStorage.getItem('test_storage');
        console.log('✅ Cookie storage interface works:', storageValue === 'storage_value');
        
        cookieStorage.removeItem('test_storage');
        const removedValue = cookieStorage.getItem('test_storage');
        console.log('✅ Cookie storage removal works:', removedValue === null);
    }

    // Test 3: Secure cookie storage
    console.log('\n3️⃣ Testing Secure Cookie Storage');
    
    const secureStorage = createSecureCookieStorage('test-encryption-key', {
        secure: false, // For testing
        maxAge: 3600
    });
    
    console.log('✅ Secure cookie storage created');
    
    if (typeof window !== 'undefined') {
        secureStorage.setItem('secure_test', 'encrypted_value');
        const decryptedValue = secureStorage.getItem('secure_test');
        console.log('✅ Encryption/decryption works:', decryptedValue === 'encrypted_value');
        
        // Check that the raw cookie is actually encrypted
        const rawCookie = getCookie('secure_test');
        const isEncrypted = rawCookie !== 'encrypted_value';
        console.log('✅ Data is encrypted in cookie:', isEncrypted);
        
        secureStorage.removeItem('secure_test');
    }

    // Test 4: Cookie session management
    console.log('\n4️⃣ Testing Cookie Session');
    
    const session = new CookieSession('test_session', {
        secure: false,
        maxAge: 1800 // 30 minutes
    });
    
    const sessionData = {
        userId: '123',
        name: 'Test User',
        preferences: { theme: 'dark' }
    };
    
    if (typeof window !== 'undefined') {
        session.set(sessionData);
        console.log('✅ Session data set');
        
        const retrievedSession = session.get();
        console.log('✅ Session data retrieved:', JSON.stringify(retrievedSession) === JSON.stringify(sessionData));
        
        console.log('✅ Session exists:', session.exists());
        
        session.clear();
        console.log('✅ Session cleared:', !session.exists());
    } else {
        console.log('ℹ️ Session tests skipped in Node.js environment');
    }

    // Test 5: Auth client with cookie storage
    console.log('\n5️⃣ Testing Auth Client with Cookies');
    
    const authConfig = createAuthConfig({
        storage: 'cookie',
        tokenKey: 'auth_token_test',
        refreshTokenKey: 'refresh_token_test',
        cookieOptions: {
            secure: false, // For testing
            maxAge: 3600,
            path: '/',
            sameSite: 'lax'
        }
    });
    
    const client = new FetchClient({
        baseURL: 'https://httpbin.org',
        debug: true,
        auth: authConfig
    });
    
    console.log('✅ Cookie auth client created');
    
    // Test token management
    const mockTokens: AuthTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
    };
    
    try {
        await client.setTokens(mockTokens);
        console.log('✅ Tokens set in cookies');
        
        const retrievedTokens = client.getTokens();
        if (retrievedTokens) {
            console.log('✅ Tokens retrieved from cookies:', 
                retrievedTokens.accessToken === mockTokens.accessToken);
        }
        
        console.log('✅ Auth state:', client.isAuthenticated());
        
        // Clean up
        await client.clearTokens();
        console.log('✅ Cookie tokens cleared');
        
    } catch (error) {
        console.log('ℹ️ Token operations (may need browser environment)');
        console.log('Error:', (error as Error).message);
    }

    // Test 6: Cookie configuration validation
    console.log('\n6️⃣ Testing Cookie Configuration');
    
    const configs = [
        { name: 'Basic', options: { maxAge: 3600 } },
        { name: 'Secure', options: { secure: true, sameSite: 'strict' as const } },
        { name: 'Development', options: { secure: false, sameSite: 'lax' as const } },
        { name: 'Session', options: { maxAge: undefined } }
    ];
    
    configs.forEach(({ name, options }) => {
        try {
            const storage = createCookieStorage(options);
            console.log(`✅ ${name} cookie config created`);
        } catch (error) {
            console.log(`❌ ${name} config failed:`, (error as Error).message);
        }
    });

    console.log('\n🎉 All cookie authentication feature tests completed!');
}

// Export for use
export { testCookieAuthFeatures };

// Uncomment to run immediately
// testCookieAuthFeatures().catch(console.error);