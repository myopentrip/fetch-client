// Comprehensive Authentication Examples for @myopentrip/fetch-client

import { 
    FetchClient,
    createAuthConfig,
    createLoginCredentials,
    isTokenExpired,
    getUserFromToken,
    formatTokenTimeRemaining,
    AuthEventEmitter,
    type AuthTokens,
    type AuthConfig,
    type LoginCredentials
} from '../src/index';

// ===========================================
// BASIC AUTHENTICATION SETUP
// ===========================================

async function basicAuthSetup() {
    console.log('🔐 Basic Authentication Setup');
    console.log('==============================\n');

    // Create auth configuration
    const authConfig = createAuthConfig({
        loginUrl: '/auth/login',
        logoutUrl: '/auth/logout',
        tokenRefreshUrl: '/auth/refresh',
        storage: 'localStorage',
        autoRefresh: true,
        refreshThreshold: 300, // Refresh when token expires in 5 minutes

        // Event handlers
        onLoginSuccess: (tokens) => {
            console.log('✅ Login successful!');
            console.log(`Token expires in: ${formatTokenTimeRemaining(tokens)}`);
        },
        
        onTokenRefresh: (tokens) => {
            console.log('🔄 Token refreshed successfully');
            console.log(`New token expires in: ${formatTokenTimeRemaining(tokens)}`);
        },
        
        onTokenExpired: () => {
            console.log('⚠️ Token expired, please login again');
            // Redirect to login page or show login modal
        },
        
        onLogout: () => {
            console.log('👋 User logged out');
            // Clear user data, redirect to login
        },
        
        onAuthError: (error) => {
            console.error('❌ Authentication error:', error.message);
        }
    });

    // Create client with auth
    const client = new FetchClient({
        baseURL: 'https://api.example.com',
        debug: true,
        auth: authConfig
    });

    console.log('✅ Auth-enabled client created');
    return client;
}

// ===========================================
// LOGIN/LOGOUT FLOW
// ===========================================

async function authenticationFlow() {
    console.log('\n🚪 Authentication Flow Demo');
    console.log('============================\n');

    const client = await basicAuthSetup();

    // Example 1: Login with credentials
    console.log('1️⃣ User Login');
    
    const credentials = createLoginCredentials('user@example.com', 'password123', {
        rememberMe: true,
        deviceId: 'mobile-app-123'
    });

    try {
        const loginResponse = await client.login(credentials);
        console.log('Login response:', loginResponse.data);
        
        // Check if user is authenticated
        if (client.isAuthenticated()) {
            console.log('✅ User is now authenticated');
            
            // Get auth state
            const authState = client.getAuthState();
            console.log('Auth state:', {
                isAuthenticated: authState.isAuthenticated,
                hasTokens: !!authState.tokens,
                isRefreshing: authState.isRefreshing
            });
        }
    } catch (error) {
        console.error('❌ Login failed:', (error as Error).message);
    }

    // Example 2: Make authenticated requests
    console.log('\n2️⃣ Authenticated Requests');
    
    try {
        // These requests will automatically include the auth token
        const userProfile = await client.get('/user/profile');
        console.log('✅ User profile fetched');
        
        const userSettings = await client.get('/user/settings');
        console.log('✅ User settings fetched');
        
    } catch (error) {
        console.error('❌ Authenticated request failed:', (error as Error).message);
    }

    // Example 3: Manual token refresh
    console.log('\n3️⃣ Manual Token Refresh');
    
    try {
        const tokens = client.getTokens();
        if (tokens && isTokenExpired(tokens, 600)) { // If expires in 10 minutes
            console.log('Token will expire soon, refreshing...');
            const newTokens = await client.refreshTokens();
            console.log('✅ Tokens refreshed manually');
        }
    } catch (error) {
        console.error('❌ Token refresh failed:', (error as Error).message);
    }

    // Example 4: Logout
    console.log('\n4️⃣ User Logout');
    
    try {
        await client.logout();
        console.log('✅ User logged out successfully');
        
        // Verify authentication state
        console.log('Is authenticated:', client.isAuthenticated());
    } catch (error) {
        console.error('❌ Logout failed:', (error as Error).message);
    }
}

// ===========================================
// ADVANCED AUTH FEATURES
// ===========================================

async function advancedAuthFeatures() {
    console.log('\n🚀 Advanced Auth Features');
    console.log('=========================\n');

    // Example 5: Custom token extraction
    console.log('5️⃣ Custom Token Extraction');
    
    const customAuthConfig = createAuthConfig({
        loginUrl: '/auth/login',
        tokenRefreshUrl: '/auth/refresh',
        
        // Custom token extraction for non-standard APIs
        extractTokenFromResponse: (data) => {
            // Handle APIs that return tokens in different formats
            if (data.token && data.refresh) {
                return {
                    accessToken: data.token,
                    refreshToken: data.refresh,
                    expiresIn: data.ttl,
                    tokenType: 'Bearer'
                };
            }
            return null;
        }
    });

    // Example 6: Multiple storage strategies
    console.log('\n6️⃣ Storage Strategies');
    
    // Memory storage (doesn't persist)
    const memoryClient = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'memory',
            loginUrl: '/auth/login'
        })
    });

    // Session storage (clears on tab close)
    const sessionClient = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'sessionStorage',
            loginUrl: '/auth/login'
        })
    });

    // Custom storage implementation
    const customStorageClient = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            storage: 'custom',
            customStorage: {
                getItem: async (key) => {
                    // Could be IndexedDB, secure storage, etc.
                    return localStorage.getItem(`encrypted_${key}`);
                },
                setItem: async (key, value) => {
                    // Encrypt before storing
                    localStorage.setItem(`encrypted_${key}`, value);
                },
                removeItem: async (key) => {
                    localStorage.removeItem(`encrypted_${key}`);
                }
            }
        })
    });

    console.log('✅ Multiple storage strategies configured');

    // Example 7: JWT token inspection
    console.log('\n7️⃣ JWT Token Inspection');
    
    const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MTYyMzkwMjIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiLCJhZG1pbiJdfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
    
    const userInfo = getUserFromToken(mockJWT);
    if (userInfo) {
        console.log('User info from JWT:', {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            roles: userInfo.roles
        });
    }

    // Example 8: Auth event handling
    console.log('\n8️⃣ Auth Event Handling');
    
    const authEvents = new AuthEventEmitter();
    
    // Set up event listeners
    const unsubscribeLogin = authEvents.on('login', (tokens: AuthTokens) => {
        console.log('🎉 Login event fired');
        // Update UI, analytics, etc.
    });
    
    const unsubscribeLogout = authEvents.on('logout', () => {
        console.log('👋 Logout event fired');
        // Clean up, redirect, etc.
    });
    
    // Simulate events
    authEvents.emit('login', { accessToken: 'mock-token' } as AuthTokens);
    authEvents.emit('logout');
    
    // Clean up
    unsubscribeLogin();
    unsubscribeLogout();
    
    console.log('✅ Auth events handled');
}

// ===========================================
// REACT INTEGRATION EXAMPLE
// ===========================================

// React Auth Context example
export const createAuthContext = () => {
    // This would be used in a React app
    const useAuth = () => {
        const [authState, setAuthState] = useState({
            isAuthenticated: false,
            tokens: null,
            user: null,
            isLoading: true
        });

        const client = useMemo(() => {
            return new FetchClient({
                baseURL: process.env.NEXT_PUBLIC_API_URL,
                auth: createAuthConfig({
                    loginUrl: '/auth/login',
                    logoutUrl: '/auth/logout',
                    tokenRefreshUrl: '/auth/refresh',
                    storage: 'localStorage',
                    
                    onLoginSuccess: (tokens) => {
                        const user = getUserFromToken(tokens.accessToken);
                        setAuthState({
                            isAuthenticated: true,
                            tokens,
                            user,
                            isLoading: false
                        });
                    },
                    
                    onLogout: () => {
                        setAuthState({
                            isAuthenticated: false,
                            tokens: null,
                            user: null,
                            isLoading: false
                        });
                    },
                    
                    onTokenExpired: () => {
                        // Redirect to login or show modal
                        window.location.href = '/login';
                    }
                })
            });
        }, []);

        const login = async (credentials: LoginCredentials) => {
            setAuthState(prev => ({ ...prev, isLoading: true }));
            try {
                await client.login(credentials);
            } catch (error) {
                setAuthState(prev => ({ ...prev, isLoading: false }));
                throw error;
            }
        };

        const logout = async () => {
            await client.logout();
        };

        return {
            ...authState,
            login,
            logout,
            client
        };
    };

    return { useAuth };
};

// ===========================================
// NEXT.JS API ROUTE EXAMPLE
// ===========================================

export const nextJSAuthExample = () => {
    // This would be in a Next.js API route
    const authMiddleware = async (req: Request, res: Response, next: Function) => {
        const client = new FetchClient({
            baseURL: process.env.API_URL,
            auth: createAuthConfig({
                storage: 'memory', // Server-side doesn't persist
                tokenRefreshUrl: '/auth/refresh'
            })
        });

        // Extract token from request headers
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            
            try {
                // Validate token with auth service
                await client.setTokens({ accessToken: token });
                
                if (client.isAuthenticated()) {
                    req.user = getUserFromToken(token);
                    return next();
                }
            } catch (error) {
                console.error('Token validation failed:', error);
            }
        }

        // Return 401 if not authenticated
        return res.status(401).json({ error: 'Unauthorized' });
    };

    return { authMiddleware };
};

// ===========================================
// ERROR HANDLING EXAMPLES
// ===========================================

async function authErrorHandling() {
    console.log('\n⚠️ Auth Error Handling');
    console.log('======================\n');

    const client = new FetchClient({
        baseURL: 'https://api.example.com',
        auth: createAuthConfig({
            loginUrl: '/auth/login',
            tokenRefreshUrl: '/auth/refresh',
            
            onAuthError: (error) => {
                // Handle different types of auth errors
                switch (error.status) {
                    case 401:
                        console.log('🔒 Unauthorized - redirecting to login');
                        // window.location.href = '/login';
                        break;
                    case 403:
                        console.log('🚫 Forbidden - insufficient permissions');
                        // Show permission denied message
                        break;
                    case 429:
                        console.log('🐌 Too many requests - rate limited');
                        // Show rate limit message
                        break;
                    default:
                        console.log('❌ Auth error:', error.message);
                }
            }
        })
    });

    // Example: Handle network errors during auth
    try {
        await client.login({
            email: 'user@example.com',
            password: 'wrongpassword'
        });
    } catch (error) {
        const authError = error as any;
        
        if (authError.status === 401) {
            console.log('Invalid credentials');
        } else if (!authError.status) {
            console.log('Network error during login');
        }
    }
}

// ===========================================
// MAIN DEMO FUNCTION
// ===========================================

export async function runAuthDemo() {
    console.log('🔐 Authentication Management Demo');
    console.log('=================================\n');

    try {
        await basicAuthSetup();
        await authenticationFlow();
        await advancedAuthFeatures();
        await authErrorHandling();
        
        console.log('\n🎉 All authentication demos completed successfully!');
    } catch (error) {
        console.error('❌ Auth demo failed:', error);
    }
}

// Mock React imports for the example (these would be real imports in a React app)
const useState = (initial: any) => [initial, (setter: any) => {}];
const useMemo = (factory: () => any, deps: any[]) => factory();

// Uncomment to run the demo
// runAuthDemo().catch(console.error);