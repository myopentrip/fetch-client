import type { HttpMethod, RequestMeta } from '../types';

export function resolveURL(baseURL: string, path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
}

export function prepareRequestBody(data?: unknown): BodyInit | undefined {
    if (data === undefined || data === null) return undefined;

    if (
        data instanceof FormData ||
        data instanceof Blob ||
        data instanceof ArrayBuffer ||
        data instanceof URLSearchParams ||
        typeof data === 'string'
    ) {
        return data as BodyInit;
    }

    return JSON.stringify(data);
}

export function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};

    if (!headers) return result;

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            result[key] = value;
        });
    } else if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
            result[key] = value;
        });
    } else {
        Object.assign(result, headers);
    }

    return result;
}

export function mergeHeaders(
    ...parts: (HeadersInit | Record<string, string> | undefined)[]
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const part of parts) {
        if (!part) continue;
        Object.assign(result, normalizeHeaders(part));
    }

    return result;
}

export function prepareRequestHeaders(
    data: unknown | undefined,
    configHeaders: HeadersInit | undefined,
    defaultHeaders: Record<string, string> = {}
): Record<string, string> {
    const headers = mergeHeaders(defaultHeaders, configHeaders);

    const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
    );

    if (data instanceof FormData) {
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'content-type') {
                delete headers[key];
            }
        }
    } else if (
        data !== undefined &&
        data !== null &&
        !hasContentType &&
        !(data instanceof Blob) &&
        !(data instanceof ArrayBuffer) &&
        !(data instanceof URLSearchParams) &&
        typeof data !== 'string'
    ) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

export function buildRequestMeta(
    method: HttpMethod,
    path: string,
    partial?: Partial<RequestMeta>
): RequestMeta {
    return {
        path,
        method,
        ...partial,
    };
}
