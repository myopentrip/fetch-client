export interface FetchClientConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    retries?: number;
    retryDelay?: number;
    enableInterceptors?: boolean;
    debug?: boolean;
}

export interface RequestMeta {
    path: string;
    method: HttpMethod;
    /** Set by auth plugin on login/logout/refresh to avoid 401 refresh loops */
    skipAuthRefresh?: boolean;
    /** Internal: prevents infinite retry after token refresh */
    authRetried?: boolean;
}

export interface RequestConfig extends RequestInit {
    timeout?: number;
    signal?: AbortSignal;
    meta?: Partial<RequestMeta>;
}

export interface FetchResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
    meta: RequestMeta;
}

export interface FetchError extends Error {
    status?: number;
    statusText?: string;
    response?: Response;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RequestInterceptor = (
    config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor<T = unknown> = (
    response: FetchResponse<T>
) => FetchResponse<T> | Promise<FetchResponse<T>>;

export interface ErrorInterceptorContext {
    method: HttpMethod;
    path: string;
    config: RequestConfig;
}

/** Returning FetchResponse recovers from the error (e.g. retry after 401 refresh) */
export type ErrorInterceptorResult<T = unknown> = FetchError | FetchResponse<T>;

export type ErrorInterceptor = (
    error: FetchError,
    context?: ErrorInterceptorContext
) => ErrorInterceptorResult | Promise<ErrorInterceptorResult>;

export interface Interceptors {
    request: RequestInterceptor[];
    response: ResponseInterceptor<unknown>[];
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

/** Minimal surface plugins may depend on (implemented by FetchClient) */
export interface FetchClientLike {
    readonly baseURL: string;
    getDefaultHeaders(): Record<string, string>;
    buildHeaders(data?: unknown, configHeaders?: HeadersInit): Record<string, string>;
    resolveURL(path: string): string;
    addRequestInterceptor(interceptor: RequestInterceptor): () => void;
    addResponseInterceptor(interceptor: ResponseInterceptor): () => void;
    addErrorInterceptor(interceptor: ErrorInterceptor): () => void;
    removeRequestInterceptor(interceptor: RequestInterceptor): boolean;
    request<T>(method: HttpMethod, path: string, config?: RequestConfig): Promise<FetchResponse<T>>;
    post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>;
    /** Internal: POST without interceptors/retry (auth token refresh) */
    rawPost?<T>(path: string, data?: unknown, config?: RequestConfig): Promise<FetchResponse<T>>;
}

export interface FetchClientPlugin {
    readonly name: string;
    setup(client: FetchClientLike): void | Promise<void>;
    teardown?(): void | Promise<void>;
}
