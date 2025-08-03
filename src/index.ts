export { FetchClient } from './fetch-client';
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
} from './types';

// Create a default instance for convenience
import { FetchClient } from './fetch-client';
import type { FetchClientConfig } from './types';

export const createFetchClient = (config?: FetchClientConfig) => {
    return new FetchClient(config);
};

// Helper functions for common interceptors
export * from './utils/iterceptors';
export * from './utils/formatters';
export * from './utils/uploadCreators';
export * from './utils/validators';