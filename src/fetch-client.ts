import type {
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
    UploadProgressEvent
} from './types';

export class FetchClient {
    private config: Required<FetchClientConfig>;
    private interceptors: Interceptors;
    private retryConfig: RetryConfig;

    constructor(config: FetchClientConfig = {}) {
        this.config = {
            baseURL: config.baseURL || '',
            timeout: config.timeout || 10000,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            retries: config.retries || 0,
            retryDelay: config.retryDelay || 1000,
            enableInterceptors: config.enableInterceptors !== false,
            debug: config.debug || false,
        };

        this.interceptors = {
            request: [],
            response: [],
            error: [],
        };

        this.retryConfig = {
            maxRetries: this.config.retries,
            baseDelay: this.config.retryDelay,
            maxDelay: 30000, // 30 seconds max
            backoffFactor: 2,
            jitter: true,
            retryCondition: (error: FetchError, attempt: number) => {
                // Retry on network errors or 5xx status codes
                return !error.status || (error.status >= 500 && error.status < 600);
            },
        };
    }

    // Interceptor management methods
    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        this.interceptors.request.push(interceptor);
        return () => {
            const index = this.interceptors.request.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.request.splice(index, 1);
            }
        };
    }

    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        this.interceptors.response.push(interceptor);
        return () => {
            const index = this.interceptors.response.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.response.splice(index, 1);
            }
        };
    }

    addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
        this.interceptors.error.push(interceptor);
        return () => {
            const index = this.interceptors.error.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.error.splice(index, 1);
            }
        };
    }

    updateRetryConfig(config: Partial<RetryConfig>): void {
        this.retryConfig = { ...this.retryConfig, ...config };
    }

    private createURL(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        const base = this.config.baseURL.endsWith('/')
            ? this.config.baseURL.slice(0, -1)
            : this.config.baseURL;
        const cleanPath = path.startsWith('/') ? path : `/${path}`;

        return `${base}${cleanPath}`;
    }

    private async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]);
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private calculateRetryDelay(attempt: number): number {
        let delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt);

        if (this.retryConfig.jitter) {
            // Add ±10% jitter to prevent thundering herd
            const jitterRange = delay * 0.1;
            const jitter = (Math.random() - 0.5) * 2 * jitterRange;
            delay += jitter;
        }

        return Math.min(delay, this.retryConfig.maxDelay);
    }

    private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
        if (!this.config.enableInterceptors) return config;

        let modifiedConfig = { ...config };

        for (const interceptor of this.interceptors.request) {
            try {
                modifiedConfig = await interceptor(modifiedConfig);
            } catch (error) {
                if (this.config.debug) {
                    console.warn('Request interceptor failed:', error);
                }
                throw error;
            }
        }

        return modifiedConfig;
    }

    private async applyResponseInterceptors<T>(response: FetchResponse<T>): Promise<FetchResponse<T>> {
        if (!this.config.enableInterceptors) return response;

        let modifiedResponse = { ...response };

        for (const interceptor of this.interceptors.response) {
            try {
                modifiedResponse = await (interceptor as any)(modifiedResponse);
            } catch (error) {
                if (this.config.debug) {
                    console.warn('Response interceptor failed:', error);
                }
                throw error;
            }
        }

        return modifiedResponse;
    }

    private async applyErrorInterceptors(error: FetchError): Promise<FetchError> {
        if (!this.config.enableInterceptors) return error;

        let modifiedError = { ...error };

        for (const interceptor of this.interceptors.error) {
            try {
                modifiedError = await interceptor(modifiedError);
            } catch (interceptorError) {
                if (this.config.debug) {
                    console.warn('Error interceptor failed:', interceptorError);
                }
                return error; // Return original error if interceptor fails
            }
        }

        return modifiedError;
    }

    private log(message: string, data?: any): void {
        if (this.config.debug) {
            console.log(`[FetchClient] ${message}`, data || '');
        }
    }

    private prepareRequestBody(data?: unknown): BodyInit | undefined {
        if (!data) return undefined;

        // Don't modify FormData or other BodyInit types
        if (data instanceof FormData || data instanceof Blob || data instanceof ArrayBuffer ||
            data instanceof URLSearchParams || typeof data === 'string') {
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

    private async executeRequest<T>(
        url: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        // Apply request interceptors
        const interceptedConfig = await this.applyRequestInterceptors(config);

        const {
            timeout = this.config.timeout,
            retries = this.retryConfig.maxRetries,
            headers,
            signal,
            ...fetchConfig
        } = interceptedConfig;

        const mergedHeaders = {
            ...this.config.headers,
            ...headers,
        };

        let lastError: FetchError | undefined;
        const startTime = Date.now();

        if (this.config.debug) {
            this.log('Starting request', { url, method: fetchConfig.method, headers: mergedHeaders });
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
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
                    const error: FetchError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    error.status = response.status;
                    error.statusText = response.statusText;
                    error.response = response;
                    throw error;
                }

                const contentType = response.headers.get('content-type');
                let data: T;

                if (contentType && contentType.includes('application/json')) {
                    try {
                        data = await response.json();
                    } catch (parseError) {
                        // If JSON parsing fails, fall back to text
                        data = (await response.text()) as unknown as T;
                    }
                } else {
                    data = (await response.text()) as unknown as T;
                }

                const fetchResponse: FetchResponse<T> = {
                    data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                };

                if (this.config.debug) {
                    const duration = Date.now() - startTime;
                    this.log('Request completed successfully', {
                        url,
                        status: response.status,
                        duration: `${duration}ms`,
                        attempt: attempt + 1
                    });
                }

                // Apply response interceptors
                return await this.applyResponseInterceptors(fetchResponse);

            } catch (error) {
                const fetchError = error as FetchError;

                // Check if we should retry this error
                const shouldRetry = attempt < retries &&
                    this.retryConfig.retryCondition &&
                    this.retryConfig.retryCondition(fetchError, attempt);

                if (this.config.debug) {
                    this.log(`Request failed (attempt ${attempt + 1}/${retries + 1})`, {
                        url,
                        error: fetchError.message,
                        shouldRetry
                    });
                }

                if (shouldRetry) {
                    const delay = this.calculateRetryDelay(attempt);
                    if (this.config.debug) {
                        this.log(`Retrying in ${delay}ms`, { attempt: attempt + 1, delay });
                    }
                    await this.sleep(delay);
                } else {
                    lastError = fetchError;
                    break;
                }

                lastError = fetchError;
            }
        }

        // Apply error interceptors before throwing
        if (lastError) {
            const processedError = await this.applyErrorInterceptors(lastError);
            throw processedError;
        } else {
            throw new Error('Request failed with unknown error');
        }
    }

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

    async get<T = unknown>(
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('GET', path, config);
    }

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

    async delete<T = unknown>(
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('DELETE', path, config);
    }

    // File Upload Methods

    /**
     * Upload a single file or multiple files
     */
    async uploadFile<T = unknown>(
        path: string,
        fileData: FileUploadData,
        config: FileUploadConfig = {}
    ): Promise<FetchResponse<T>> {
        const formData = this.createFormDataFromFileData(fileData);
        return this.uploadFormData<T>(path, formData, config);
    }

    /**
     * Upload multiple files
     */
    async uploadFiles<T = unknown>(
        path: string,
        files: File[],
        config: FileUploadConfig & { fieldName?: string } = {}
    ): Promise<FetchResponse<T>> {
        const { fieldName = 'files', ...uploadConfig } = config;

        const fileData: FileUploadData = {
            file: files,
            fieldName,
        };

        return this.uploadFile<T>(path, fileData, uploadConfig);
    }

    /**
     * Upload form data with files and other fields
     */
    async uploadFormData<T = unknown>(
        path: string,
        formData: FormData | MultipartFormData,
        config: FileUploadConfig = {}
    ): Promise<FetchResponse<T>> {
        const {
            onProgress,
            onUploadStart,
            onUploadComplete,
            onUploadError,
            ...requestConfig
        } = config;

        // Convert object to FormData if needed
        const finalFormData = formData instanceof FormData
            ? formData
            : this.createFormDataFromObject(formData);

        // If progress tracking is needed, use XMLHttpRequest
        if (onProgress || onUploadStart || onUploadComplete) {
            return this.uploadWithProgress<T>(path, finalFormData, config);
        }

        // For simple uploads without progress, use regular fetch
        return this.uploadWithFetch<T>(path, finalFormData, requestConfig);
    }

    private createFormDataFromFileData(fileData: FileUploadData): FormData {
        const formData = new FormData();
        const { file, fieldName = 'file', additionalFields, fileName } = fileData;

        // Add files
        if (Array.isArray(file)) {
            file.forEach((f, index) => {
                const name = fieldName.endsWith('[]') ? fieldName : `${fieldName}[${index}]`;
                formData.append(name, f, fileName || f.name);
            });
        } else {
            formData.append(fieldName, file, fileName || file.name);
        }

        // Add additional fields
        if (additionalFields) {
            Object.entries(additionalFields).forEach(([key, value]) => {
                formData.append(key, String(value));
            });
        }

        return formData;
    }

    private createFormDataFromObject(data: MultipartFormData): FormData {
        const formData = new FormData();

        Object.entries(data).forEach(([key, value]) => {
            if (value instanceof File) {
                formData.append(key, value);
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (item instanceof File) {
                        const name = key.endsWith('[]') ? key : `${key}[${index}]`;
                        formData.append(name, item);
                    } else {
                        formData.append(`${key}[${index}]`, String(item));
                    }
                });
            } else {
                formData.append(key, String(value));
            }
        });

        return formData;
    }

    private async uploadWithFetch<T>(
        path: string,
        formData: FormData,
        config: RequestConfig
    ): Promise<FetchResponse<T>> {
        // Remove Content-Type header to let browser set it with boundary
        const { headers, ...restConfig } = config;
        const cleanHeaders = this.prepareRequestHeaders(formData, headers);

        return this.request<T>('POST', path, {
            ...restConfig,
            headers: cleanHeaders,
            body: formData,
        });
    }

    private async uploadWithProgress<T>(
        path: string,
        formData: FormData,
        config: FileUploadConfig
    ): Promise<FetchResponse<T>> {
        const {
            onProgress,
            onUploadStart,
            onUploadComplete,
            onUploadError,
            timeout = this.config.timeout,
            signal,
            headers,
            ...restConfig
        } = config;

        return new Promise<FetchResponse<T>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = this.createURL(path);
            let startTime = Date.now();
            let lastLoaded = 0;
            let lastTime = startTime;

            // Set up progress tracking
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const now = Date.now();
                        const timeDiff = now - lastTime;
                        const bytesDiff = event.loaded - lastLoaded;

                        const speed = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0;
                        const estimatedTime = speed > 0 ? (event.total - event.loaded) / speed : 0;

                        const progressEvent: UploadProgressEvent = {
                            loaded: event.loaded,
                            total: event.total,
                            percentage: Math.round((event.loaded / event.total) * 100),
                            speed,
                            estimatedTime,
                        };

                        onProgress(progressEvent);

                        lastLoaded = event.loaded;
                        lastTime = now;
                    }
                });
            }

            // Set up event handlers
            xhr.upload.addEventListener('loadstart', () => {
                if (this.config.debug) {
                    this.log('Upload started');
                }
                onUploadStart?.();
            });

            xhr.upload.addEventListener('load', () => {
                if (this.config.debug) {
                    this.log('Upload completed');
                }
                onUploadComplete?.();
            });

            xhr.upload.addEventListener('error', () => {
                const error = new Error('Upload failed');
                if (this.config.debug) {
                    this.log('Upload error', error);
                }
                onUploadError?.(error);
                reject(error);
            });

            xhr.addEventListener('load', () => {
                try {
                    const response = this.createResponseFromXHR<T>(xhr);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });

            xhr.addEventListener('error', () => {
                const error = new Error('Network error during upload');
                onUploadError?.(error);
                reject(error);
            });

            xhr.addEventListener('timeout', () => {
                const error = new Error(`Upload timeout after ${timeout}ms`);
                onUploadError?.(error);
                reject(error);
            });

            // Handle cancellation
            if (signal) {
                signal.addEventListener('abort', () => {
                    xhr.abort();
                    reject(new Error('Upload cancelled'));
                });
            }

            // Set up request
            xhr.open('POST', url);
            xhr.timeout = timeout;

            // Set headers (but not Content-Type for FormData)
            const mergedHeaders: Record<string, string> = { ...this.config.headers };
            if (headers) {
                Object.assign(mergedHeaders, headers);
            }

            Object.entries(mergedHeaders).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'content-type') {
                    xhr.setRequestHeader(key, String(value));
                }
            });

            // Start upload
            xhr.send(formData);
        });
    }

    private createResponseFromXHR<T>(xhr: XMLHttpRequest): FetchResponse<T> {
        let data: T;

        try {
            const contentType = xhr.getResponseHeader('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = JSON.parse(xhr.responseText);
            } else {
                data = xhr.responseText as unknown as T;
            }
        } catch (error) {
            data = xhr.responseText as unknown as T;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
            const error: FetchError = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`);
            error.status = xhr.status;
            error.statusText = xhr.statusText;
            throw error;
        }

        // Create Headers object from XHR headers
        const headers = new Headers();
        const headerString = xhr.getAllResponseHeaders();
        headerString.split('\r\n').forEach(line => {
            const [key, value] = line.split(': ');
            if (key && value) {
                headers.append(key, value);
            }
        });

        return {
            data,
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
        };
    }
}