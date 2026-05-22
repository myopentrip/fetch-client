import type { FetchClientLike, FetchResponse } from '../../core/types';
import { mergeHeaders } from '../../core/utils/request-helpers';
import type {
    FileUploadConfig,
    FileUploadData,
    MultipartFormData,
    UploadProgressEvent,
} from './types';

export class UploadManager {
    async uploadFile<T>(
        client: FetchClientLike,
        path: string,
        fileData: FileUploadData,
        config: FileUploadConfig = {}
    ): Promise<FetchResponse<T>> {
        const formData = this.createFormDataFromFileData(fileData);
        return this.uploadFormData<T>(client, path, formData, config);
    }

    async uploadFiles<T>(
        client: FetchClientLike,
        path: string,
        files: File[],
        config: FileUploadConfig & { fieldName?: string } = {}
    ): Promise<FetchResponse<T>> {
        const { fieldName = 'files', ...uploadConfig } = config;
        return this.uploadFile<T>(
            client,
            path,
            { file: files, fieldName },
            uploadConfig
        );
    }

    async uploadFormData<T>(
        client: FetchClientLike,
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

        const finalFormData =
            formData instanceof FormData ? formData : this.createFormDataFromObject(formData);

        if (onProgress || onUploadStart || onUploadComplete) {
            return this.uploadWithProgress<T>(
                client,
                path,
                finalFormData,
                { onProgress, onUploadStart, onUploadComplete, onUploadError, ...requestConfig }
            );
        }

        return client.request<T>('POST', path, {
            ...requestConfig,
            body: finalFormData,
            headers: client.buildHeaders(finalFormData, requestConfig.headers),
        });
    }

    createFormDataFromFileData(fileData: FileUploadData): FormData {
        const formData = new FormData();
        const { file, fieldName = 'file', additionalFields, fileName } = fileData;

        if (Array.isArray(file)) {
            file.forEach((f, index) => {
                const name = fieldName.endsWith('[]') ? fieldName : `${fieldName}[${index}]`;
                formData.append(name, f, fileName ?? f.name);
            });
        } else {
            formData.append(fieldName, file, fileName ?? file.name);
        }

        if (additionalFields) {
            Object.entries(additionalFields).forEach(([key, value]) => {
                formData.append(key, String(value));
            });
        }

        return formData;
    }

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
     * XHR upload for progress — bypasses interceptors/retry (documented escape hatch).
     */
    private async uploadWithProgress<T>(
        client: FetchClientLike,
        path: string,
        formData: FormData,
        config: FileUploadConfig
    ): Promise<FetchResponse<T>> {
        const {
            onProgress,
            onUploadStart,
            onUploadComplete,
            onUploadError,
            timeout = 10000,
            signal,
            headers,
        } = config;

        const url = client.resolveURL(path);
        const mergedHeaders = mergeHeaders(client.getDefaultHeaders(), headers);

        return new Promise<FetchResponse<T>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let lastLoaded = 0;
            let lastTime = Date.now();

            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (!event.lengthComputable) return;

                    const now = Date.now();
                    const timeDiff = now - lastTime;
                    const bytesDiff = event.loaded - lastLoaded;
                    const speed = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0;
                    const estimatedTime = speed > 0 ? (event.total - event.loaded) / speed : 0;

                    onProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100),
                        speed,
                        estimatedTime,
                    });

                    lastLoaded = event.loaded;
                    lastTime = now;
                });
            }

            xhr.upload.addEventListener('loadstart', () => onUploadStart?.());
            xhr.upload.addEventListener('load', () => onUploadComplete?.());

            xhr.addEventListener('load', () => {
                try {
                    resolve(this.createResponseFromXHR<T>(xhr, path));
                } catch (error) {
                    reject(error);
                }
            });

            const fail = (message: string) => {
                const error = new Error(message);
                onUploadError?.(error);
                reject(error);
            };

            xhr.upload.addEventListener('error', () => fail('Upload failed'));
            xhr.addEventListener('error', () => fail('Network error during upload'));
            xhr.addEventListener('timeout', () => fail(`Upload timeout after ${timeout}ms`));

            if (signal) {
                signal.addEventListener('abort', () => {
                    xhr.abort();
                    reject(new Error('Upload cancelled'));
                });
            }

            xhr.open('POST', url);
            xhr.timeout = timeout;

            Object.entries(mergedHeaders).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'content-type') {
                    xhr.setRequestHeader(key, String(value));
                }
            });

            xhr.send(formData);
        });
    }

    private createResponseFromXHR<T>(xhr: XMLHttpRequest, path: string): FetchResponse<T> {
        let data: T;

        try {
            const contentType = xhr.getResponseHeader('content-type');
            data =
                contentType?.includes('application/json')
                    ? JSON.parse(xhr.responseText)
                    : (xhr.responseText as unknown as T);
        } catch {
            data = xhr.responseText as unknown as T;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
            const error = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`) as Error & {
                status?: number;
                statusText?: string;
            };
            error.status = xhr.status;
            error.statusText = xhr.statusText;
            throw error;
        }

        const headers = new Headers();
        xhr.getAllResponseHeaders()
            .split('\r\n')
            .forEach((line) => {
                const [key, value] = line.split(': ');
                if (key && value) headers.append(key, value);
            });

        return {
            data,
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
            meta: { path, method: 'POST' },
        };
    }
}
