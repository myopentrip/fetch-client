import type {
    FileUploadConfig,
    FileUploadData,
    MultipartFormData,
    UploadProgressEvent,
    FetchResponse,
    FetchError,
    RequestConfig
} from '../types';

export class UploadManager {
    private debugMode: boolean;
    private defaultTimeout: number;
    private defaultHeaders: Record<string, string>;

    constructor(debugMode: boolean = false, defaultTimeout: number = 10000, defaultHeaders: Record<string, string> = {}) {
        this.debugMode = debugMode;
        this.defaultTimeout = defaultTimeout;
        this.defaultHeaders = defaultHeaders;
    }

    /**
     * Upload a single file or multiple files
     */
    async uploadFile<T = unknown>(
        url: string,
        fileData: FileUploadData,
        config: FileUploadConfig,
        requestFn: (url: string, config: RequestConfig) => Promise<FetchResponse<T>>
    ): Promise<FetchResponse<T>> {
        const formData = this.createFormDataFromFileData(fileData);
        return this.uploadFormData<T>(url, formData, config, requestFn);
    }

    /**
     * Upload multiple files
     */
    async uploadFiles<T = unknown>(
        url: string,
        files: File[],
        config: FileUploadConfig & { fieldName?: string },
        requestFn: (url: string, config: RequestConfig) => Promise<FetchResponse<T>>
    ): Promise<FetchResponse<T>> {
        const { fieldName = 'files', ...uploadConfig } = config;

        const fileData: FileUploadData = {
            file: files,
            fieldName,
        };

        return this.uploadFile<T>(url, fileData, uploadConfig, requestFn);
    }

    /**
     * Upload form data with files and other fields
     */
    async uploadFormData<T = unknown>(
        url: string,
        formData: FormData | MultipartFormData,
        config: FileUploadConfig,
        requestFn: (url: string, config: RequestConfig) => Promise<FetchResponse<T>>
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
            return this.uploadWithProgress<T>(url, finalFormData, config);
        }

        // For simple uploads without progress, use regular fetch
        return this.uploadWithFetch<T>(url, finalFormData, requestConfig, requestFn);
    }

    /**
     * Create FormData from file upload data
     */
    createFormDataFromFileData(fileData: FileUploadData): FormData {
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

    /**
     * Create FormData from object data
     */
    createFormDataFromObject(data: MultipartFormData): FormData {
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

    /**
     * Prepare headers for FormData upload (removes Content-Type)
     */
    prepareRequestHeaders(data: FormData, configHeaders?: HeadersInit): Record<string, string> {
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

        // Remove Content-Type to let browser set it with boundary for FormData
        delete headers['Content-Type'];
        delete headers['content-type'];

        return headers;
    }

    // Private methods

    private async uploadWithFetch<T>(
        url: string,
        formData: FormData,
        config: RequestConfig,
        requestFn: (url: string, config: RequestConfig) => Promise<FetchResponse<T>>
    ): Promise<FetchResponse<T>> {
        // Remove Content-Type header to let browser set it with boundary
        const { headers, ...restConfig } = config;
        const cleanHeaders = this.prepareRequestHeaders(formData, headers);

        return requestFn(url, {
            ...restConfig,
            method: 'POST',
            headers: cleanHeaders,
            body: formData,
        });
    }

    private async uploadWithProgress<T>(
        url: string,
        formData: FormData,
        config: FileUploadConfig
    ): Promise<FetchResponse<T>> {
        const {
            onProgress,
            onUploadStart,
            onUploadComplete,
            onUploadError,
            timeout = this.defaultTimeout,
            signal,
            headers,
            ...restConfig
        } = config;

        return new Promise<FetchResponse<T>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
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
                if (this.debugMode) {
                    this.log('Upload started');
                }
                onUploadStart?.();
            });

            xhr.upload.addEventListener('load', () => {
                if (this.debugMode) {
                    this.log('Upload completed');
                }
                onUploadComplete?.();
            });

            xhr.upload.addEventListener('error', () => {
                const error = new Error('Upload failed');
                if (this.debugMode) {
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
            const mergedHeaders: Record<string, string> = { ...this.defaultHeaders };
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

    private log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[UploadManager] ${message}`, data || '');
        }
    }
}