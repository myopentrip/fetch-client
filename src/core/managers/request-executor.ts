import type { RequestConfig, FetchResponse, FetchError, HttpMethod, RequestMeta } from '../types';
import { mergeHeaders, buildRequestMeta } from '../utils/request-helpers';
import { formatHTTPErrorMessage } from '../utils/formatters';

export class RequestExecutor {
    private timeout: number;
    private defaultHeaders: Record<string, string>;
    private debugMode: boolean;

    constructor(
        timeout: number = 10000,
        defaultHeaders: Record<string, string> = {},
        debugMode: boolean = false
    ) {
        this.timeout = timeout;
        this.defaultHeaders = defaultHeaders;
        this.debugMode = debugMode;
    }

    async executeRequest<T>(
        url: string,
        method: HttpMethod,
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const { timeout = this.timeout, headers, signal, meta: configMeta, ...fetchConfig } = config;

        const mergedHeaders = mergeHeaders(this.defaultHeaders, headers);
        const meta: RequestMeta = buildRequestMeta(method, path, configMeta);

        const controller = signal ? undefined : new AbortController();
        const requestSignal = signal ?? controller?.signal;

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (controller && timeout > 0) {
            timeoutId = setTimeout(() => controller.abort(), timeout);
        }

        const startTime = Date.now();

        if (this.debugMode) {
            this.log('Starting request', { url, method, headers: mergedHeaders });
        }

        try {
            const response = await fetch(url, {
                ...fetchConfig,
                method,
                headers: mergedHeaders,
                signal: requestSignal,
            });

            if (timeoutId) clearTimeout(timeoutId);

            if (!response.ok) {
                const errorMessage = formatHTTPErrorMessage(response.status, response.statusText);
                const error: FetchError = new Error(errorMessage);
                error.status = response.status;
                error.statusText = response.statusText;
                error.response = response;
                throw error;
            }

            const data = await this.parseResponseData<T>(response);
            const fetchResponse: FetchResponse<T> = {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                meta,
            };

            if (this.debugMode) {
                this.log('Request completed', {
                    url,
                    status: response.status,
                    duration: `${Date.now() - startTime}ms`,
                });
            }

            return fetchResponse;
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);

            if (this.debugMode) {
                const fetchError = error as FetchError;
                this.log('Request failed', { url, error: fetchError.message, status: fetchError.status });
            }

            throw error;
        }
    }

    updateTimeout(timeout: number): void {
        this.timeout = timeout;
    }

    updateDefaultHeaders(headers: Record<string, string>): void {
        this.defaultHeaders = { ...headers };
    }

    private async parseResponseData<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            try {
                return await response.json();
            } catch {
                return (await response.text()) as unknown as T;
            }
        }

        return (await response.text()) as unknown as T;
    }

    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            console.log(`[RequestExecutor] ${message}`, data ?? '');
        }
    }
}
