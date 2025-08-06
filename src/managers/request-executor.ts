import type {
    RequestConfig,
    FetchResponse,
    FetchError,
    HttpMethod
} from '../types';
import { formatHTTPErrorMessage } from '../utils/formatters';

export class RequestExecutor {
    private baseURL: string;
    private timeout: number;
    private defaultHeaders: Record<string, string>;
    private debugMode: boolean;

    constructor(
        baseURL: string = '',
        timeout: number = 10000,
        defaultHeaders: Record<string, string> = {},
        debugMode: boolean = false
    ) {
        this.baseURL = baseURL;
        this.timeout = timeout;
        this.defaultHeaders = defaultHeaders;
        this.debugMode = debugMode;
    }

    /**
     * Execute a fetch request with the given configuration
     */
    async executeRequest<T>(
        url: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const {
            timeout = this.timeout,
            headers,
            signal,
            ...fetchConfig
        } = config;

        const mergedHeaders = {
            ...this.defaultHeaders,
            ...headers,
        };

        const startTime = Date.now();

        if (this.debugMode) {
            this.log('Starting request', {
                url,
                method: fetchConfig.method,
                headers: mergedHeaders
            });
        }

        // Create abort controller if no signal provided but timeout is set
        const controller = signal ? undefined : new AbortController();
        const requestSignal = signal || controller?.signal;

        // Set up timeout for abort controller if we created one
        let timeoutId: NodeJS.Timeout | undefined;
        if (controller && timeout) {
            timeoutId = setTimeout(() => {
                controller.abort();
            }, timeout);
        }

        try {
            const response = await fetch(url, {
                ...fetchConfig,
                headers: mergedHeaders,
                signal: requestSignal,
            });

            // Clear timeout if request succeeded
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

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
            };

            if (this.debugMode) {
                const duration = Date.now() - startTime;
                this.log('Request completed successfully', {
                    url,
                    status: response.status,
                    duration: `${duration}ms`
                });
            }

            return fetchResponse;

        } catch (error) {
            // Clear timeout on error
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            const fetchError = error as FetchError;

            if (this.debugMode) {
                this.log('Request failed', {
                    url,
                    error: fetchError.message,
                    status: fetchError.status
                });
            }

            throw fetchError;
        }
    }

    /**
     * Make a request with method, path, and config
     */
    async request<T = unknown>(
        method: HttpMethod,
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const url = this.createURL(path);
        return this.executeRequest<T>(url, {
            ...config,
            method,
        });
    }

    /**
     * Make a GET request
     */
    async get<T = unknown>(
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('GET', path, config);
    }

    /**
     * Make a POST request
     */
    async post<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const body = this.prepareRequestBody(data);
        const headers = this.prepareRequestHeaders(data, config.headers);

        return this.request<T>('POST', path, {
            ...config,
            headers,
            body,
        });
    }

    /**
     * Make a PUT request
     */
    async put<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const body = this.prepareRequestBody(data);
        const headers = this.prepareRequestHeaders(data, config.headers);

        return this.request<T>('PUT', path, {
            ...config,
            headers,
            body,
        });
    }

    /**
     * Make a PATCH request
     */
    async patch<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        const body = this.prepareRequestBody(data);
        const headers = this.prepareRequestHeaders(data, config.headers);

        return this.request<T>('PATCH', path, {
            ...config,
            headers,
            body,
        });
    }

    /**
     * Make a DELETE request
     */
    async delete<T = unknown>(
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('DELETE', path, config);
    }

    /**
     * Update base URL
     */
    updateBaseURL(baseURL: string): void {
        this.baseURL = baseURL;
        if (this.debugMode) {
            this.log('Base URL updated', { baseURL });
        }
    }

    /**
     * Update default timeout
     */
    updateTimeout(timeout: number): void {
        this.timeout = timeout;
        if (this.debugMode) {
            this.log('Default timeout updated', { timeout });
        }
    }

    /**
     * Update default headers
     */
    updateDefaultHeaders(headers: Record<string, string>): void {
        this.defaultHeaders = { ...headers };
        if (this.debugMode) {
            this.log('Default headers updated', { headers });
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): { baseURL: string; timeout: number; defaultHeaders: Record<string, string> } {
        return {
            baseURL: this.baseURL,
            timeout: this.timeout,
            defaultHeaders: { ...this.defaultHeaders }
        };
    }

    // Private methods

    private createURL(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        const base = this.baseURL.endsWith('/')
            ? this.baseURL.slice(0, -1)
            : this.baseURL;
        const cleanPath = path.startsWith('/') ? path : `/${path}`;

        return `${base}${cleanPath}`;
    }

    private prepareRequestBody(data?: unknown): BodyInit | undefined {
        if (!data) return undefined;

        // Don't modify FormData or other BodyInit types
        if (data instanceof FormData ||
            data instanceof Blob ||
            data instanceof ArrayBuffer ||
            data instanceof URLSearchParams ||
            typeof data === 'string') {
            return data as BodyInit;
        }

        // JSON stringify for regular objects
        return JSON.stringify(data);
    }

    private prepareRequestHeaders(data?: unknown, configHeaders?: HeadersInit): Record<string, string> {
        // Convert HeadersInit to Record<string, string>
        let headers: Record<string, string> = {};

        if (configHeaders) {
            if (configHeaders instanceof Headers) {
                configHeaders.forEach((value, key) => {
                    headers[key] = value;
                });
            } else if (Array.isArray(configHeaders)) {
                configHeaders.forEach(([key, value]) => {
                    headers[key] = value;
                });
            } else {
                headers = { ...configHeaders };
            }
        }

        // If data is FormData, remove Content-Type to let browser set it with boundary
        if (data instanceof FormData) {
            delete headers['Content-Type'];
            delete headers['content-type'];
        }

        return headers;
    }

    private async parseResponseData<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (parseError) {
                // If JSON parsing fails, fall back to text
                return (await response.text()) as unknown as T;
            }
        } else {
            return (await response.text()) as unknown as T;
        }
    }

    private log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[RequestExecutor] ${message}`, data || '');
        }
    }
}