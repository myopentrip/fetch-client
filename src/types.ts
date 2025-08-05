export interface FetchClientConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    retries?: number;
    retryDelay?: number;
    enableInterceptors?: boolean;
    debug?: boolean;
    auth?: AuthConfig;
}

export interface RequestConfig extends RequestInit {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    signal?: AbortSignal;
}

export interface FetchResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
}

export interface FetchError extends Error {
    status?: number;
    statusText?: string;
    response?: Response;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor<T = unknown> = (response: FetchResponse<T>) => FetchResponse<T> | Promise<FetchResponse<T>>;
export type ErrorInterceptor = (error: FetchError) => FetchError | Promise<FetchError>;

export interface Interceptors {
    request: RequestInterceptor[];
    response: ResponseInterceptor<any>[];
    error: ErrorInterceptor[];
}

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
    jitter: boolean;
    retryCondition?: (error: FetchError, attempt: number) => boolean;
}

// File Upload Types
export interface UploadProgressEvent {
    loaded: number;
    total: number;
    percentage: number;
    speed?: number; // bytes per second
    estimatedTime?: number; // estimated time remaining in seconds
}

export interface FileUploadConfig extends Omit<RequestConfig, 'body'> {
    onProgress?: (progress: UploadProgressEvent) => void;
    onUploadStart?: () => void;
    onUploadComplete?: () => void;
    onUploadError?: (error: Error) => void;
    chunkSize?: number; // for future chunked upload support
}

export interface FileUploadData {
    file: File | File[];
    fieldName?: string;
    additionalFields?: Record<string, string | number | boolean>;
    fileName?: string; // override filename
}

export interface MultipartFormData {
    [key: string]: string | number | boolean | File | File[];
}

// Authentication Types
export interface AuthConfig {
    tokenKey?: string; // Key for token storage (default: 'authToken')
    refreshTokenKey?: string; // Key for refresh token storage (default: 'refreshToken')
    storage?: 'localStorage' | 'sessionStorage' | 'memory' | 'cookie' | 'custom';
    cookieOptions?: CookieOptions; // Cookie configuration for cookie storage
    customStorage?: {
        getItem: (key: string) => string | null | Promise<string | null>;
        setItem: (key: string, value: string) => void | Promise<void>;
        removeItem: (key: string) => void | Promise<void>;
    };
    tokenRefreshUrl?: string; // Endpoint for refreshing tokens
    loginUrl?: string; // Login endpoint
    logoutUrl?: string; // Logout endpoint
    tokenPrefix?: string; // Token prefix (default: 'Bearer')
    autoRefresh?: boolean; // Auto-refresh on 401 (default: true)
    refreshThreshold?: number; // Refresh token when expires in X seconds (default: 300)
    onTokenRefresh?: (tokens: AuthTokens) => void | Promise<void>;
    onTokenExpired?: () => void | Promise<void>;
    onLoginSuccess?: (tokens: AuthTokens) => void | Promise<void>;
    onLogout?: () => void | Promise<void>;
    onAuthError?: (error: FetchError) => void | Promise<void>;
    extractTokenFromResponse?: (response: any) => AuthTokens | null;
    extractErrorFromResponse?: (response: any) => string | null;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number; // Expiry time in seconds
    expiresAt?: number; // Absolute expiry timestamp
    tokenType?: string; // Token type (default: 'Bearer')
}

export interface LoginCredentials {
    username?: string;
    email?: string;
    password: string;
    [key: string]: any; // Additional login fields
}

export interface AuthState {
    isAuthenticated: boolean;
    tokens: AuthTokens | null;
    user?: any; // User information
    isRefreshing: boolean;
    lastRefresh?: number;
}

export interface AuthEvents {
    onLogin: (tokens: AuthTokens) => void | Promise<void>;
    onLogout: () => void | Promise<void>;
    onTokenRefresh: (tokens: AuthTokens) => void | Promise<void>;
    onTokenExpired: () => void | Promise<void>;
    onAuthError: (error: FetchError) => void | Promise<void>;
}

export type AuthStorageStrategy = 'localStorage' | 'sessionStorage' | 'memory' | 'cookie' | 'custom';

export interface CookieOptions {
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number; // in seconds
    expires?: Date;
}