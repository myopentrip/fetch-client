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
    }
    if (seconds < 3600) {
        return Math.round(seconds / 60) + 'm';
    }
    return Math.round(seconds / 3600) + 'h';
};

export const getHTTPStatusDescription = (statusCode: number): string => {
    const statusDescriptions: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        408: 'Request Timeout',
        409: 'Conflict',
        422: 'Unprocessable Entity',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
    };

    return statusDescriptions[statusCode] || 'Unknown Status';
};

export const formatHTTPErrorMessage = (statusCode: number, statusText?: string): string => {
    const description = getHTTPStatusDescription(statusCode);

    if (statusText && statusText.trim() && statusText !== description) {
        return `HTTP ${statusCode}: ${description} (${statusText})`;
    }

    return `HTTP ${statusCode}: ${description}`;
};
