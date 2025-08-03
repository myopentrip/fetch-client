import { formatFileSize } from "./formatters";

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