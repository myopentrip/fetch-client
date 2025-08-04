import type {
    AuthConfig,
    AuthTokens,
    AuthState,
    LoginCredentials,
    FetchResponse,
    FetchError,
    RequestInterceptor
} from '../types';
import { createCookieStorage } from '../utils/cookies';

export class AuthManager {
    private authConfig: AuthConfig | null;
    private authState: AuthState;
    private refreshPromise: Promise<AuthTokens> | null = null;
    private authInterceptor: RequestInterceptor | null = null;
    private debugMode: boolean;

    constructor(authConfig?: AuthConfig, debugMode: boolean = false) {
        this.authConfig = authConfig || null;
        this.debugMode = debugMode;
        this.authState = {
            isAuthenticated: false,
            tokens: null,
            isRefreshing: false,
        };
    }

    /**
     * Initialize authentication system
     */
    async initialize(): Promise<void> {
        if (!this.authConfig) return;

        // Load existing tokens from storage
        await this.loadTokensFromStorage();

        // Set authenticated state if tokens exist
        if (this.authState.tokens) {
            this.authState.isAuthenticated = true;
        }

        if (this.debugMode) {
            this.log('Authentication system initialized');
        }
    }

    /**
     * Set authentication tokens
     */
    async setTokens(tokens: AuthTokens): Promise<void> {
        // Calculate expiry timestamp if needed
        if (tokens.expiresIn && !tokens.expiresAt) {
            tokens.expiresAt = Date.now() + (tokens.expiresIn * 1000);
        }

        this.authState.tokens = tokens;
        this.authState.isAuthenticated = true;

        await this.saveTokensToStorage(tokens);

        if (this.debugMode) {
            this.log('Tokens set successfully');
        }
    }

    /**
     * Get current tokens
     */
    getTokens(): AuthTokens | null {
        return this.authState.tokens;
    }

    /**
     * Clear authentication tokens
     */
    async clearTokens(): Promise<void> {
        this.authState.tokens = null;
        this.authState.isAuthenticated = false;
        this.authState.user = undefined;

        await this.removeTokensFromStorage();

        if (this.debugMode) {
            this.log('Tokens cleared');
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.authState.isAuthenticated && !!this.authState.tokens;
    }

    /**
     * Check if token is expired or will expire soon
     */
    isTokenExpired(threshold?: number): boolean {
        const tokens = this.authState.tokens;
        if (!tokens || !tokens.expiresAt) return false;

        const now = Date.now();
        const refreshThreshold = (threshold || this.authConfig?.refreshThreshold || 300) * 1000;

        return tokens.expiresAt <= (now + refreshThreshold);
    }

    /**
     * Refresh authentication tokens
     */
    async refreshTokens(requestFn: (url: string, data: any) => Promise<FetchResponse>): Promise<AuthTokens> {
        if (!this.authConfig?.tokenRefreshUrl) {
            throw new Error('Token refresh URL not configured');
        }

        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.performTokenRefresh(requestFn);

        try {
            const tokens = await this.refreshPromise;
            this.refreshPromise = null;
            return tokens;
        } catch (error) {
            this.refreshPromise = null;
            throw error;
        }
    }

    /**
     * Get auth state
     */
    getAuthState(): AuthState {
        return { ...this.authState };
    }

    /**
     * Set user information
     */
    setUser(user: any): void {
        this.authState.user = user;
    }

    /**
     * Get current user
     */
    getUser(): any {
        return this.authState.user;
    }

    /**
     * Handle unauthorized response
     */
    async handleUnauthorized(requestFn: (url: string, data: any) => Promise<FetchResponse>): Promise<void> {
        if (this.authState.isRefreshing) return;

        if (this.isTokenExpired() && this.authState.tokens?.refreshToken) {
            try {
                await this.refreshTokens(requestFn);
            } catch (error) {
                // Token refresh failed, user needs to login again
                this.authConfig?.onTokenExpired?.();
            }
        } else {
            // No refresh token or not expired, just unauthorized
            this.authConfig?.onTokenExpired?.();
            await this.clearTokens();
        }
    }

    /**
     * Extract tokens from login/refresh response
     */
    extractTokensFromResponse(response: FetchResponse): AuthTokens | null {
        if (this.authConfig?.extractTokenFromResponse) {
            return this.authConfig.extractTokenFromResponse(response.data);
        }

        // Default token extraction
        const data = response.data as any;
        if (data.accessToken || data.access_token) {
            return {
                accessToken: data.accessToken || data.access_token,
                refreshToken: data.refreshToken || data.refresh_token,
                expiresIn: data.expiresIn || data.expires_in,
                tokenType: data.tokenType || data.token_type || 'Bearer'
            };
        }

        return null;
    }

    /**
     * Create authentication interceptor
     */
    createAuthInterceptor(): RequestInterceptor {
        return async (config) => {
            const tokens = this.authState.tokens;
            if (tokens) {
                const prefix = this.authConfig?.tokenPrefix || tokens.tokenType || 'Bearer';
                config.headers = {
                    ...config.headers,
                    'Authorization': `${prefix} ${tokens.accessToken}`
                };
            }
            return config;
        };
    }

    /**
     * Process login response and set tokens
     */
    async processLoginResponse(response: FetchResponse): Promise<void> {
        const tokens = this.extractTokensFromResponse(response);
        if (tokens) {
            await this.setTokens(tokens);
            this.authConfig?.onLoginSuccess?.(tokens);
        }
    }

    /**
     * Handle login error
     */
    handleLoginError(error: FetchError): void {
        this.authConfig?.onAuthError?.(error);
    }

    /**
     * Handle logout
     */
    handleLogout(): void {
        this.authConfig?.onLogout?.();
    }

    // Private methods

    private async performTokenRefresh(requestFn: (url: string, data: any) => Promise<FetchResponse>): Promise<AuthTokens> {
        const currentTokens = this.authState.tokens;
        if (!currentTokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        this.authState.isRefreshing = true;

        try {
            const response = await requestFn(this.authConfig!.tokenRefreshUrl!, {
                refreshToken: currentTokens.refreshToken
            });

            const newTokens = this.extractTokensFromResponse(response);
            if (!newTokens) {
                throw new Error('Failed to extract tokens from refresh response');
            }

            await this.setTokens(newTokens);
            this.authState.lastRefresh = Date.now();
            this.authConfig?.onTokenRefresh?.(newTokens);

            if (this.debugMode) {
                this.log('Tokens refreshed successfully');
            }
            return newTokens;
        } catch (error) {
            if (this.debugMode) {
                this.log('Token refresh failed', error);
            }
            this.authConfig?.onTokenExpired?.();
            await this.clearTokens();
            throw error;
        } finally {
            this.authState.isRefreshing = false;
        }
    }

    private async loadTokensFromStorage(): Promise<void> {
        try {
            const storage = this.getStorage();
            const tokenKey = this.authConfig?.tokenKey || 'authToken';
            const refreshKey = this.authConfig?.refreshTokenKey || 'refreshToken';

            const accessToken = await storage.getItem(tokenKey);
            const refreshToken = await storage.getItem(refreshKey);
            const expiresAt = await storage.getItem(`${tokenKey}_expiresAt`);

            if (accessToken) {
                const tokens: AuthTokens = {
                    accessToken,
                    refreshToken: refreshToken || undefined,
                    expiresAt: expiresAt ? parseInt(expiresAt) : undefined
                };

                this.authState.tokens = tokens;

                if (this.debugMode) {
                    this.log('Tokens loaded from storage');
                }
            }
        } catch (error) {
            if (this.debugMode) {
                this.log('Failed to load tokens from storage', error);
            }
        }
    }

    private async saveTokensToStorage(tokens: AuthTokens): Promise<void> {
        try {
            const storage = this.getStorage();
            const tokenKey = this.authConfig?.tokenKey || 'authToken';
            const refreshKey = this.authConfig?.refreshTokenKey || 'refreshToken';

            await storage.setItem(tokenKey, tokens.accessToken);

            if (tokens.refreshToken) {
                await storage.setItem(refreshKey, tokens.refreshToken);
            }

            if (tokens.expiresAt) {
                await storage.setItem(`${tokenKey}_expiresAt`, tokens.expiresAt.toString());
            }

            if (this.debugMode) {
                this.log('Tokens saved to storage');
            }
        } catch (error) {
            if (this.debugMode) {
                this.log('Failed to save tokens to storage', error);
            }
        }
    }

    private async removeTokensFromStorage(): Promise<void> {
        try {
            const storage = this.getStorage();
            const tokenKey = this.authConfig?.tokenKey || 'authToken';
            const refreshKey = this.authConfig?.refreshTokenKey || 'refreshToken';

            await storage.removeItem(tokenKey);
            await storage.removeItem(refreshKey);
            await storage.removeItem(`${tokenKey}_expiresAt`);

            if (this.debugMode) {
                this.log('Tokens removed from storage');
            }
        } catch (error) {
            if (this.debugMode) {
                this.log('Failed to remove tokens from storage', error);
            }
        }
    }

    private getStorage() {
        const strategy = this.authConfig?.storage || 'localStorage';

        switch (strategy) {
            case 'localStorage':
                return {
                    getItem: (key: string) => localStorage.getItem(key),
                    setItem: (key: string, value: string) => localStorage.setItem(key, value),
                    removeItem: (key: string) => localStorage.removeItem(key)
                };
            case 'sessionStorage':
                return {
                    getItem: (key: string) => sessionStorage.getItem(key),
                    setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
                    removeItem: (key: string) => sessionStorage.removeItem(key)
                };
            case 'memory':
                const memoryStorage = new Map<string, string>();
                return {
                    getItem: (key: string) => memoryStorage.get(key) || null,
                    setItem: (key: string, value: string) => memoryStorage.set(key, value),
                    removeItem: (key: string) => memoryStorage.delete(key)
                };
            case 'cookie':
                return createCookieStorage(this.authConfig?.cookieOptions || {});
            case 'custom':
                if (!this.authConfig?.customStorage) {
                    throw new Error('Custom storage implementation required');
                }
                return this.authConfig.customStorage;
            default:
                throw new Error(`Unsupported storage strategy: ${strategy}`);
        }
    }

    private log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[AuthManager] ${message}`, data || '');
        }
    }
}