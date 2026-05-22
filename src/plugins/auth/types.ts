import type { FetchError, FetchResponse } from '../../core/types';

export interface AuthConfig {
    debug?: boolean;
    tokenKey?: string;
    refreshTokenKey?: string;
    storage?: 'localStorage' | 'sessionStorage' | 'memory' | 'cookie' | 'custom';
    cookieOptions?: CookieOptions;
    customStorage?: {
        getItem: (key: string) => string | null | Promise<string | null>;
        setItem: (key: string, value: string) => void | Promise<void>;
        removeItem: (key: string) => void | Promise<void>;
    };
    tokenRefreshUrl?: string;
    loginUrl?: string;
    logoutUrl?: string;
    tokenPrefix?: string;
    autoRefresh?: boolean;
    /** Retry the original request once after a successful token refresh on 401 (default: true) */
    retryAfterRefresh?: boolean;
    refreshThreshold?: number;
    onTokenRefresh?: (tokens: AuthTokens) => void | Promise<void>;
    onTokenExpired?: () => void | Promise<void>;
    onLoginSuccess?: (tokens: AuthTokens) => void | Promise<void>;
    onLogout?: () => void | Promise<void>;
    onAuthError?: (error: FetchError) => void | Promise<void>;
    extractTokenFromResponse?: (response: unknown) => AuthTokens | null;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    expiresAt?: number;
    tokenType?: string;
}

export interface LoginCredentials {
    username?: string;
    email?: string;
    password: string;
    [key: string]: unknown;
}

export interface AuthState {
    isAuthenticated: boolean;
    tokens: AuthTokens | null;
    user?: unknown;
    isRefreshing: boolean;
    lastRefresh?: number;
}

export interface CookieOptions {
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    expires?: Date;
}

export type AuthRefreshRequestFn = (
    url: string,
    data: { refreshToken: string }
) => Promise<FetchResponse>;
