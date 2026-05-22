import type { RequestConfig } from '../../core/types';

export interface UploadProgressEvent {
    loaded: number;
    total: number;
    percentage: number;
    speed?: number;
    estimatedTime?: number;
}

export interface FileUploadConfig extends Omit<RequestConfig, 'body'> {
    onProgress?: (progress: UploadProgressEvent) => void;
    onUploadStart?: () => void;
    onUploadComplete?: () => void;
    onUploadError?: (error: Error) => void;
}

export interface FileUploadData {
    file: File | File[];
    fieldName?: string;
    additionalFields?: Record<string, string | number | boolean>;
    fileName?: string;
}

export interface MultipartFormData {
    [key: string]: string | number | boolean | File | File[];
}
