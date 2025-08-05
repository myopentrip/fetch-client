export { FetchClient } from './fetch-client';

export { AuthManager } from './managers/auth-manager';
export { UploadManager } from './managers/upload-manager';
export { InterceptorManager } from './managers/interceptor-manager';
export { RequestExecutor } from './managers/request-executor';
export { RetryManager } from './managers/retry-manager';

export type {
    FetchClientConfig,
    RequestConfig,
    FetchResponse,
    FetchError,
    HttpMethod,
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    Interceptors,
    RetryConfig,
    FileUploadConfig,
    FileUploadData,
    MultipartFormData,
    UploadProgressEvent,
    AuthConfig,
    AuthTokens,
    AuthState,
    LoginCredentials,
    AuthEvents,
    AuthStorageStrategy,
    CookieOptions,
} from './types';

import { FetchClient } from './fetch-client';
import type { FetchClientConfig } from './types';

export const createFetchClient = (config?: FetchClientConfig) => {
    return new FetchClient(config);
};

export * from './utils/interceptors';
export * from './utils/formatters';
export * from './utils/uploadCreators';
export * from './utils/validators';
export * from './utils/auth';
export * from './utils/cookies';
export * from './utils/ssl-error-handler';