// Cookie-based Authentication Examples for @myopentrip/fetch-client

import { 
    FetchClient,
    createAuthConfig,
    createCookieStorage,
    createSecureCookieStorage,
    createServerSideCookieStorage,
    CookieSession,
    areCookiesEnabled,
    type CookieOptions
} from '../src/index';

// ===========================================
// BASIC COOKIE AUTHENTICATION
// ===========================================

async function basicCookieAuth() {
    console.log('🍪 Basic Cookie Authentication');
    console.log('===============================\n');

    // Check if cookies are enabled
    if (!areCookiesEnabled()) {
        console.error('❌ Cookies are not enabled in this browser');
        return;
    }

    // Create client with cookie storage
    const client = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'cookie',
            loginUrl: '/auth/login',
            logoutUrl: '/auth/logout',
            tokenRefreshUrl: '/auth/refresh',
            
            // Cookie configuration
            cookieOptions: {
                path: '/',
                secure: true, // Only over HTTPS
                sameSite: 'strict', // CSRF protection
                maxAge: 24 * 60 * 60, // 24 hours
            },
            
            onLoginSuccess: (tokens) => {
                console.log('✅ Login successful - tokens stored in cookies');
            },
            
            onLogout: () => {
                console.log('✅ Logout successful - cookies cleared');
            }
        })
    });

    console.log('✅ Cookie-based auth client created');
    return client;
}

// ===========================================
// SECURE COOKIE AUTHENTICATION
// ===========================================

async function secureCookieAuth() {
    console.log('\n🔒 Secure Cookie Authentication');
    console.log('================================\n');

    const client = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'cookie',
            
            // Enhanced security options
            cookieOptions: {
                path: '/',
                secure: true, // HTTPS only
                sameSite: 'strict', // Strict CSRF protection
                maxAge: 60 * 60, // 1 hour (shorter for security)
                domain: '.example.com', // Allow subdomains
            },
            
            // Shorter refresh threshold for security
            refreshThreshold: 300, // 5 minutes
            autoRefresh: true
        })
    });

    console.log('✅ Secure cookie auth configured with:');
    console.log('  - HTTPS only');
    console.log('  - Strict SameSite');
    console.log('  - 1 hour expiry');
    console.log('  - Auto-refresh at 5 min warning');
}

// ===========================================
// NEXT.JS SERVER-SIDE COOKIE AUTH
// ===========================================

export function nextJSCookieAuth() {
    console.log('\n🌐 Next.js Server-Side Cookie Auth');
    console.log('===================================\n');

    // This would be used in Next.js API routes or middleware
    const createServerAuthClient = (req: any, res: any) => {
        const cookieStorage = createServerSideCookieStorage(
            () => req.headers.cookie || '',
            (name, value, options) => {
                res.setHeader('Set-Cookie', `${name}=${value}; ${formatCookieOptions(options)}`);
            },
            (name, options) => {
                res.setHeader('Set-Cookie', `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${formatCookieOptions(options)}`);
            }
        );

        return new FetchClient({
            baseURL: process.env.API_URL,
            auth: createAuthConfig({
                storage: 'custom',
                customStorage: cookieStorage,
                cookieOptions: {
                    httpOnly: true, // Server can set httpOnly
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 24 * 60 * 60 // 24 hours
                }
            })
        });
    };

    // Helper function to format cookie options
    const formatCookieOptions = (options: any = {}) => {
        const parts = [];
        if (options.path) parts.push(`Path=${options.path}`);
        if (options.domain) parts.push(`Domain=${options.domain}`);
        if (options.secure) parts.push('Secure');
        if (options.httpOnly) parts.push('HttpOnly');
        if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
        if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
        return parts.join('; ');
    };

    console.log('✅ Server-side cookie auth setup for Next.js');
    
    return { createServerAuthClient };
}

// ===========================================
// ENCRYPTED COOKIE STORAGE
// ===========================================

async function encryptedCookieAuth() {
    console.log('\n🔐 Encrypted Cookie Authentication');
    console.log('===================================\n');

    // Create encrypted cookie storage
    const encryptedStorage = createSecureCookieStorage('my-secret-key-123', {
        secure: true,
        sameSite: 'strict',
        maxAge: 12 * 60 * 60, // 12 hours
    });

    const client = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'custom',
            customStorage: encryptedStorage,
            
            onLoginSuccess: (tokens) => {
                console.log('✅ Tokens encrypted and stored in cookies');
            }
        })
    });

    console.log('✅ Encrypted cookie storage configured');
    console.log('  - Tokens are encrypted before storage');
    console.log('  - Additional layer of security');
}

// ===========================================
// COOKIE SESSION MANAGEMENT
// ===========================================

async function cookieSessionDemo() {
    console.log('\n📝 Cookie Session Management');
    console.log('=============================\n');

    // Create cookie session for user data
    const userSession = new CookieSession('user_session', {
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 // 24 hours
    });

    // Store user session data
    const userData = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        preferences: {
            theme: 'dark',
            language: 'en'
        }
    };

    userSession.set(userData);
    console.log('✅ User session stored in cookie');

    // Retrieve session data
    const retrievedData = userSession.get();
    console.log('✅ User session retrieved:', retrievedData);

    // Check if session exists
    console.log('Session exists:', userSession.exists());

    // Clear session
    // userSession.clear();
    // console.log('✅ Session cleared');
}

// ===========================================
// PRODUCTION COOKIE CONFIGURATION
// ===========================================

export function productionCookieConfig() {
    console.log('\n🏭 Production Cookie Configuration');
    console.log('===================================\n');

    const productionConfig = createAuthConfig({
        storage: 'cookie',
        
        cookieOptions: {
            // Security settings
            secure: true, // HTTPS only
            httpOnly: false, // Can't be set from client-side JS
            sameSite: 'strict', // Strict CSRF protection
            
            // Domain and path
            domain: '.yourdomain.com', // Allow all subdomains
            path: '/', // Available site-wide
            
            // Expiry
            maxAge: 8 * 60 * 60, // 8 hours for security
        },
        
        // Auth settings
        autoRefresh: true,
        refreshThreshold: 300, // 5 minutes before expiry
        
        // Event handlers for production
        onTokenExpired: () => {
            // Redirect to login
            window.location.href = '/login?expired=true';
        },
        
        onAuthError: (error) => {
            // Log to monitoring service
            console.error('Auth error:', error);
            // Could send to Sentry, DataDog, etc.
        }
    });

    console.log('✅ Production cookie config created with:');
    console.log('  - 8 hour expiry');
    console.log('  - Strict security');
    console.log('  - Auto-refresh');
    console.log('  - Error monitoring');
    
    return productionConfig;
}

// ===========================================
// COOKIE STORAGE COMPARISON
// ===========================================

async function cookieStorageComparison() {
    console.log('\n📊 Cookie vs Other Storage Comparison');
    console.log('======================================\n');

    console.log('🍪 COOKIES:');
    console.log('✅ Automatically sent with requests');
    console.log('✅ Can be httpOnly (XSS protection)');
    console.log('✅ Built-in expiry handling');
    console.log('✅ CSRF protection with SameSite');
    console.log('✅ Works with SSR/server-side');
    console.log('❌ Size limit (~4KB)');
    console.log('❌ Sent with every request');
    
    console.log('\n💾 LOCAL STORAGE:');
    console.log('✅ Larger storage limit');
    console.log('✅ Only sent when needed');
    console.log('❌ Vulnerable to XSS');
    console.log('❌ Not sent automatically');
    console.log('❌ Client-side only');
    
    console.log('\n🔒 SESSION STORAGE:');
    console.log('✅ Tab-scoped security');
    console.log('✅ Larger storage limit');
    console.log('❌ Lost on tab close');
    console.log('❌ Vulnerable to XSS');
    console.log('❌ Client-side only');
    
    console.log('\n🎯 RECOMMENDATION:');
    console.log('Use cookies for auth tokens in production');
    console.log('Use localStorage for development/testing');
    console.log('Use sessionStorage for temporary auth');
}

// ===========================================
// MIGRATION FROM LOCALSTORAGE TO COOKIES
// ===========================================

export async function migrateToeCookies() {
    console.log('\n🔄 Migration: localStorage → Cookies');
    console.log('====================================\n');

    // Check if user has existing localStorage tokens
    const existingToken = localStorage.getItem('authToken');
    const existingRefreshToken = localStorage.getItem('refreshToken');
    
    if (existingToken) {
        console.log('📦 Found existing localStorage tokens');
        
        // Create cookie-based client
        const client = new FetchClient({
            baseURL: 'https://api.example.com',
            auth: createAuthConfig({
                storage: 'cookie',
                cookieOptions: {
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 24 * 60 * 60
                }
            })
        });
        
        // Migrate tokens to cookies
        if (existingToken && existingRefreshToken) {
            await client.setTokens({
                accessToken: existingToken,
                refreshToken: existingRefreshToken
            });
            
            // Clear old localStorage tokens
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('authToken_expiresAt');
            
            console.log('✅ Tokens migrated to cookies');
            console.log('🗑️ localStorage tokens cleared');
        }
    } else {
        console.log('ℹ️ No existing tokens to migrate');
    }
}

// ===========================================
// MAIN DEMO FUNCTION
// ===========================================

export async function runCookieAuthDemo() {
    console.log('🍪 Cookie Authentication Demo');
    console.log('==============================\n');

    try {
        await basicCookieAuth();
        await secureCookieAuth();
        nextJSCookieAuth();
        await encryptedCookieAuth();
        await cookieSessionDemo();
        productionCookieConfig();
        await cookieStorageComparison();
        await migrateToeCookies();
        
        console.log('\n🎉 All cookie authentication demos completed!');
    } catch (error) {
        console.error('❌ Cookie demo failed:', error);
    }
}

// Uncomment to run the demo
// runCookieAuthDemo().catch(console.error);