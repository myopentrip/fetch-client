import type { FetchResponse, FetchError, RequestInterceptor, RequestConfig } from '../../core/types';
import { mergeHeaders } from '../../core/utils/request-helpers';
import { createCookieStorage } from './utils/cookies';
import type {
    AuthConfig,
    AuthTokens,
    AuthState,
    AuthRefreshRequestFn,
} from './types';

type StorageAdapter = {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
};

export class AuthManager {
    private readonly authConfig: AuthConfig;
    private readonly debugMode: boolean;
    private authState: AuthState;
    private refreshPromise: Promise<AuthTokens> | null = null;
    /** Single in-memory store per manager instance (fixes v2 bug) */
    private memoryStorage = new Map<string, string>();

    constructor(authConfig: AuthConfig, debugMode: boolean = false) {
        this.authConfig = authConfig;
        this.debugMode = debugMode;
        this.authState = {
            isAuthenticated: false,
            tokens: null,
            isRefreshing: false,
        };
    }

    async initialize(): Promise<void> {
        await this.loadTokensFromStorage();
        if (this.authState.tokens) {
            this.authState.isAuthenticated = true;
        }
        if (this.debugMode) this.log('Authentication initialized');
    }

    async setTokens(tokens: AuthTokens): Promise<void> {
        if (tokens.expiresIn && !tokens.expiresAt) {
            tokens.expiresAt = Date.now() + tokens.expiresIn * 1000;
        }

        this.authState.tokens = tokens;
        this.authState.isAuthenticated = true;
        await this.saveTokensToStorage(tokens);
        if (this.debugMode) this.log('Tokens set');
    }

    getTokens(): AuthTokens | null {
        return this.authState.tokens;
    }

    async clearTokens(): Promise<void> {
        this.authState.tokens = null;
        this.authState.isAuthenticated = false;
        this.authState.user = undefined;
        await this.removeTokensFromStorage();
        if (this.debugMode) this.log('Tokens cleared');
    }

    isAuthenticated(): boolean {
        return this.authState.isAuthenticated && !!this.authState.tokens;
    }

    /** True when token is past expiry or within refreshThreshold seconds of expiring */
    isTokenExpired(threshold?: number): boolean {
        const tokens = this.authState.tokens;
        if (!tokens?.expiresAt) return false;

        const refreshThreshold = (threshold ?? this.authConfig.refreshThreshold ?? 300) * 1000;
        return tokens.expiresAt <= Date.now() + refreshThreshold;
    }

    async refreshTokens(requestFn: AuthRefreshRequestFn): Promise<AuthTokens> {
        if (!this.authConfig.tokenRefreshUrl) {
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

    getAuthState(): AuthState {
        return { ...this.authState };
    }

    setUser(user: unknown): void {
        this.authState.user = user;
    }

    getUser(): unknown {
        return this.authState.user;
    }

    /**
     * On 401: attempt refresh when refreshToken exists (no longer requires expiresAt).
     */
    async handleUnauthorized(requestFn: AuthRefreshRequestFn): Promise<void> {
        if (this.authState.isRefreshing) return;

        const refreshToken = this.authState.tokens?.refreshToken;

        if (refreshToken && this.authConfig.tokenRefreshUrl) {
            try {
                await this.refreshTokens(requestFn);
                return;
            } catch {
                this.authConfig.onTokenExpired?.();
                await this.clearTokens();
                return;
            }
        }

        this.authConfig.onTokenExpired?.();
        await this.clearTokens();
    }

    extractTokensFromResponse(response: FetchResponse): AuthTokens | null {
        if (this.authConfig.extractTokenFromResponse) {
            return this.authConfig.extractTokenFromResponse(response.data);
        }

        const data = response.data as Record<string, unknown>;
        if (data.accessToken || data.access_token) {
            return {
                accessToken: (data.accessToken ?? data.access_token) as string,
                refreshToken: (data.refreshToken ?? data.refresh_token) as string | undefined,
                expiresIn: (data.expiresIn ?? data.expires_in) as number | undefined,
                tokenType: (data.tokenType ?? data.token_type ?? 'Bearer') as string,
            };
        }

        return null;
    }

    createAuthInterceptor(): RequestInterceptor {
        return async (config: RequestConfig) => {
            const tokens = this.authState.tokens;
            if (!tokens) return config;

            const prefix = this.authConfig.tokenPrefix ?? tokens.tokenType ?? 'Bearer';
            config.headers = mergeHeaders(config.headers, {
                Authorization: `${prefix} ${tokens.accessToken}`,
            });
            return config;
        };
    }

    async processLoginResponse(response: FetchResponse): Promise<void> {
        const tokens = this.extractTokensFromResponse(response);
        if (tokens) {
            await this.setTokens(tokens);
            await this.authConfig.onLoginSuccess?.(tokens);
        }
    }

    handleLoginError(error: FetchError): void {
        this.authConfig.onAuthError?.(error);
    }

    handleLogout(): void {
        this.authConfig.onLogout?.();
    }

    private async performTokenRefresh(requestFn: AuthRefreshRequestFn): Promise<AuthTokens> {
        const currentTokens = this.authState.tokens;
        if (!currentTokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        this.authState.isRefreshing = true;

        try {
            const response = await requestFn(this.authConfig.tokenRefreshUrl!, {
                refreshToken: currentTokens.refreshToken,
            });

            const newTokens = this.extractTokensFromResponse(response);
            if (!newTokens) {
                throw new Error('Failed to extract tokens from refresh response');
            }

            await this.setTokens(newTokens);
            this.authState.lastRefresh = Date.now();
            await this.authConfig.onTokenRefresh?.(newTokens);
            if (this.debugMode) this.log('Tokens refreshed');
            return newTokens;
        } catch (error) {
            if (this.debugMode) this.log('Token refresh failed', error);
            this.authConfig.onTokenExpired?.();
            await this.clearTokens();
            throw error;
        } finally {
            this.authState.isRefreshing = false;
        }
    }

    private async loadTokensFromStorage(): Promise<void> {
        try {
            const storage = this.getStorage();
            const tokenKey = this.authConfig.tokenKey ?? 'authToken';
            const refreshKey = this.authConfig.refreshTokenKey ?? 'refreshToken';

            const accessToken = await storage.getItem(tokenKey);
            const refreshToken = await storage.getItem(refreshKey);
            const expiresAt = await storage.getItem(`${tokenKey}_expiresAt`);

            if (accessToken) {
                this.authState.tokens = {
                    accessToken,
                    refreshToken: refreshToken ?? undefined,
                    expiresAt: expiresAt ? parseInt(expiresAt, 10) : undefined,
                };
            }
        } catch (error) {
            if (this.debugMode) this.log('Failed to load tokens', error);
        }
    }

    private async saveTokensToStorage(tokens: AuthTokens): Promise<void> {
        const storage = this.getStorage();
        const tokenKey = this.authConfig.tokenKey ?? 'authToken';
        const refreshKey = this.authConfig.refreshTokenKey ?? 'refreshToken';

        await storage.setItem(tokenKey, tokens.accessToken);
        if (tokens.refreshToken) {
            await storage.setItem(refreshKey, tokens.refreshToken);
        }
        if (tokens.expiresAt) {
            await storage.setItem(`${tokenKey}_expiresAt`, tokens.expiresAt.toString());
        }
    }

    private async removeTokensFromStorage(): Promise<void> {
        const storage = this.getStorage();
        const tokenKey = this.authConfig.tokenKey ?? 'authToken';
        const refreshKey = this.authConfig.refreshTokenKey ?? 'refreshToken';

        await storage.removeItem(tokenKey);
        await storage.removeItem(refreshKey);
        await storage.removeItem(`${tokenKey}_expiresAt`);
    }

    private getStorage(): StorageAdapter {
        const strategy = this.authConfig.storage ?? 'localStorage';

        switch (strategy) {
            case 'localStorage':
                return {
                    getItem: (key) => localStorage.getItem(key),
                    setItem: (key, value) => localStorage.setItem(key, value),
                    removeItem: (key) => localStorage.removeItem(key),
                };
            case 'sessionStorage':
                return {
                    getItem: (key) => sessionStorage.getItem(key),
                    setItem: (key, value) => sessionStorage.setItem(key, value),
                    removeItem: (key) => sessionStorage.removeItem(key),
                };
            case 'memory':
                return {
                    getItem: (key) => this.memoryStorage.get(key) ?? null,
                    setItem: (key, value) => {
                        this.memoryStorage.set(key, value);
                    },
                    removeItem: (key) => {
                        this.memoryStorage.delete(key);
                    },
                };
            case 'cookie':
                return createCookieStorage(this.authConfig.cookieOptions ?? {});
            case 'custom':
                if (!this.authConfig.customStorage) {
                    throw new Error('Custom storage implementation required');
                }
                return this.authConfig.customStorage;
            default:
                throw new Error(`Unsupported storage strategy: ${strategy}`);
        }
    }

    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            console.log(`[AuthManager] ${message}`, data ?? '');
        }
    }
}
