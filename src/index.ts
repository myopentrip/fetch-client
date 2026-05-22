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
    ErrorInterceptorContext,
    ErrorInterceptorResult,
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

export type {
    AppClient,
    AppClientSslOption,
    AppClientUploadOption,
    CreateAppClientOptions,
} from './create-app-client';

/** Thin core client — no plugins. For apps with auth/upload/SSL, prefer `createAppClient`. */
export const createFetchClient = (config?: FetchClientConfig) => new FetchClient(config);

/**
 * Default app setup: `FetchClient` + optional plugins (SSL → auth → upload).
 * Loads plugin code on first call so the core bundle stays small when unused.
 */
export async function createAppClient(
    options: import('./create-app-client').CreateAppClientOptions
): Promise<import('./create-app-client').AppClient> {
    const { createAppClient: create } = await import('./create-app-client');
    return create(options);
}
