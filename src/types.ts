export interface FetchClientConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    retries?: number;
    retryDelay?: number;
    enableInterceptors?: boolean;
    debug?: boolean;
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
    response: ResponseInterceptor[];
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