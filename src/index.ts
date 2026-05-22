export { FetchClient } from './core/fetch-client';
export { InterceptorManager } from './core/managers/interceptor-manager';
export { RequestExecutor } from './core/managers/request-executor';
export { RetryManager } from './core/managers/retry-manager';

export type {
    FetchClientConfig,
    FetchClientLike,
    FetchClientPlugin,
    RequestConfig,
    RequestMeta,
    FetchResponse,
    FetchError,
    HttpMethod,
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    Interceptors,
    RetryConfig,
} from './core/types';

export {
    resolveURL,
    prepareRequestBody,
    normalizeHeaders,
    mergeHeaders,
    prepareRequestHeaders,
} from './core/utils/request-helpers';

export {
    formatFileSize,
    formatUploadSpeed,
    formatTimeRemaining,
    formatHTTPErrorMessage,
    getHTTPStatusDescription,
} from './core/utils/formatters';

export {
    createAuthInterceptor,
    createLoggingInterceptor,
    createTimingInterceptor,
} from './core/utils/interceptors';

import { FetchClient } from './core/fetch-client';
import type { FetchClientConfig } from './core/types';

export const createFetchClient = (config?: FetchClientConfig) => new FetchClient(config);
