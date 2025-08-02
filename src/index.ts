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
export const createAuthInterceptor = (getToken: () => string | Promise<string>) => {
    return async (config: any) => {
        const token = await getToken();
        if (token) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`,
            };
        }
        return config;
    };
};

export const createLoggingInterceptor = (enabled: boolean = true) => {
    return (config: any) => {
        if (enabled) {
            console.log('🚀 Outgoing Request:', {
                method: config.method,
                url: config.url,
                headers: config.headers,
                timestamp: new Date().toISOString(),
            });
        }
        return config;
    };
};

export const createTimingInterceptor = () => {
    const timings = new Map<any, number>();

    return {
        request: (config: any) => {
            timings.set(config, Date.now());
            return config;
        },
        response: (response: any) => {
            const startTime = timings.get(response);
            if (startTime) {
                const duration = Date.now() - startTime;
                console.log(`⏱️ Request took ${duration}ms`);
                timings.delete(response);
            }
            return response;
        },
    };
};

// File Upload Helper Functions
export const createFileUploadData = (
    file: File | File[],
    options: {
        fieldName?: string;
        additionalFields?: Record<string, string | number | boolean>;
        fileName?: string;
    } = {}
): import('./types').FileUploadData => {
    return {
        file,
        fieldName: options.fieldName || 'file',
        additionalFields: options.additionalFields,
        fileName: options.fileName,
    };
};

export const createProgressCallback = (
    onProgress?: (percentage: number) => void,
    onSpeed?: (bytesPerSecond: number) => void,
    onTimeRemaining?: (seconds: number) => void
) => {
    return (progress: import('./types').UploadProgressEvent) => {
        onProgress?.(progress.percentage);

        if (progress.speed && onSpeed) {
            onSpeed(progress.speed);
        }

        if (progress.estimatedTime && onTimeRemaining) {
            onTimeRemaining(progress.estimatedTime);
        }
    };
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatUploadSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s';
};

export const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
        return Math.round(seconds) + 's';
    } else if (seconds < 3600) {
        return Math.round(seconds / 60) + 'm';
    } else {
        return Math.round(seconds / 3600) + 'h';
    }
};

export const validateFile = (
    file: File,
    options: {
        maxSize?: number; // in bytes
        allowedTypes?: string[]; // MIME types
        allowedExtensions?: string[]; // file extensions
    } = {}
): { valid: boolean; error?: string } => {
    const { maxSize, allowedTypes, allowedExtensions } = options;

    // Check file size
    if (maxSize && file.size > maxSize) {
        return {
            valid: false,
            error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
        };
    }

    // Check MIME type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `File type (${file.type}) is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        };
    }

    // Check file extension
    if (allowedExtensions) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            return {
                valid: false,
                error: `File extension (.${fileExtension}) is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
            };
        }
    }

    return { valid: true };
};