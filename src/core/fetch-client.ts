import type {
    FetchClientConfig,
    FetchClientLike,
    FetchClientPlugin,
    RequestConfig,
    FetchResponse,
    FetchError,
    HttpMethod,
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    RetryConfig,
} from './types';

import { InterceptorManager } from './managers/interceptor-manager';
import { RequestExecutor } from './managers/request-executor';
import { RetryManager } from './managers/retry-manager';
import {
    resolveURL,
    prepareRequestBody,
    prepareRequestHeaders,
    buildRequestMeta,
} from './utils/request-helpers';

export class FetchClient implements FetchClientLike {
    private readonly config: Required<
        Pick<FetchClientConfig, 'baseURL' | 'timeout' | 'retries' | 'retryDelay' | 'enableInterceptors' | 'debug'>
    > & { headers: Record<string, string> };

    private readonly interceptorManager: InterceptorManager;
    private readonly requestExecutor: RequestExecutor;
    private readonly retryManager: RetryManager;
    private readonly plugins: FetchClientPlugin[] = [];

    constructor(config: FetchClientConfig = {}) {
        this.config = {
            baseURL: config.baseURL ?? '',
            timeout: config.timeout ?? 10000,
            headers: { ...config.headers },
            retries: config.retries ?? 0,
            retryDelay: config.retryDelay ?? 1000,
            enableInterceptors: config.enableInterceptors !== false,
            debug: config.debug ?? false,
        };

        this.interceptorManager = new InterceptorManager(
            this.config.enableInterceptors,
            this.config.debug
        );

        this.requestExecutor = new RequestExecutor(
            this.config.timeout,
            this.config.headers,
            this.config.debug
        );

        this.retryManager = new RetryManager(
            {
                maxRetries: this.config.retries,
                baseDelay: this.config.retryDelay,
                maxDelay: 30000,
                backoffFactor: 2,
                jitter: true,
                retryCondition: (error) =>
                    !error.status || (error.status >= 500 && error.status < 600),
            },
            this.config.debug
        );
    }

    get baseURL(): string {
        return this.config.baseURL;
    }

    getDefaultHeaders(): Record<string, string> {
        return { ...this.config.headers };
    }

    buildHeaders(data?: unknown, configHeaders?: HeadersInit): Record<string, string> {
        return prepareRequestHeaders(data, configHeaders, this.config.headers);
    }

    resolveURL(path: string): string {
        return resolveURL(this.config.baseURL, path);
    }

    async use(plugin: FetchClientPlugin): Promise<this> {
        await plugin.setup(this);
        this.plugins.push(plugin);
        return this;
    }

    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        return this.interceptorManager.addRequestInterceptor(interceptor);
    }

    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        return this.interceptorManager.addResponseInterceptor(interceptor);
    }

    addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
        return this.interceptorManager.addErrorInterceptor(interceptor);
    }

    removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
        return this.interceptorManager.removeRequestInterceptor(interceptor);
    }

    updateRetryConfig(config: Partial<RetryConfig>): void {
        this.retryManager.updateConfig(config);
    }

    async request<T = unknown>(
        method: HttpMethod,
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const url = this.resolveURL(path);
        const meta = buildRequestMeta(method, path, config.meta);

        return this.retryManager.executeWithRetry(
            async () => {
                const interceptedConfig = await this.interceptorManager.applyRequestInterceptors({
                    ...config,
                    method,
                    meta,
                });

                const response = await this.requestExecutor.executeRequest<T>(
                    url,
                    method,
                    path,
                    interceptedConfig
                );

                return this.interceptorManager.applyResponseInterceptors(response);
            },
            `${method} ${path}`,
            (error) => this.interceptorManager.applyErrorInterceptors(error)
        );
    }

    async get<T = unknown>(path: string, config: RequestConfig = {}): Promise<FetchResponse<T>> {
        return this.request<T>('GET', path, config);
    }

    async post<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('POST', path, {
            ...config,
            body: prepareRequestBody(data),
            headers: this.buildHeaders(data, config.headers),
        });
    }

    async put<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('PUT', path, {
            ...config,
            body: prepareRequestBody(data),
            headers: this.buildHeaders(data, config.headers),
        });
    }

    async patch<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('PATCH', path, {
            ...config,
            body: prepareRequestBody(data),
            headers: this.buildHeaders(data, config.headers),
        });
    }

    async delete<T = unknown>(path: string, config: RequestConfig = {}): Promise<FetchResponse<T>> {
        return this.request<T>('DELETE', path, config);
    }

    /** Execute POST without interceptors/retry — for plugin internal calls (e.g. token refresh) */
    async rawPost<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const url = this.resolveURL(path);
        const method: HttpMethod = 'POST';
        return this.requestExecutor.executeRequest<T>(url, method, path, {
            ...config,
            method,
            body: prepareRequestBody(data),
            headers: this.buildHeaders(data, config.headers),
            meta: buildRequestMeta(method, path, { ...config.meta, skipAuthRefresh: true }),
        });
    }
}
