import type { FileUploadData, UploadProgressEvent } from "../types";

export const createFileUploadData = (
    file: File | File[],
    options: {
        fieldName?: string;
        additionalFields?: Record<string, string | number | boolean>;
        fileName?: string;
    } = {}
): FileUploadData => {
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
    return (progress: UploadProgressEvent) => {
        onProgress?.(progress.percentage);

        if (progress.speed && onSpeed) {
            onSpeed(progress.speed);
        }

        if (progress.estimatedTime && onTimeRemaining) {
            onTimeRemaining(progress.estimatedTime);
        }
    };
};