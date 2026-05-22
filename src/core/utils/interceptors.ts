import type { RequestConfig, FetchResponse } from '../types';
import { mergeHeaders } from './request-helpers';

export const createAuthInterceptor = (getToken: () => string | Promise<string>) => {
    return async (config: RequestConfig): Promise<RequestConfig> => {
        const token = await getToken();
        if (token) {
            config.headers = mergeHeaders(config.headers, {
                Authorization: `Bearer ${token}`,
            });
        }
        return config;
    };
};

export const createLoggingInterceptor = (enabled: boolean = true) => {
    return (config: RequestConfig): RequestConfig => {
        if (enabled) {
            console.log('[FetchClient] Request', {
                method: config.method,
                meta: config.meta,
                timestamp: new Date().toISOString(),
            });
        }
        return config;
    };
};

export const createTimingInterceptor = () => {
    const timings = new WeakMap<RequestConfig, number>();

    return {
        request: (config: RequestConfig): RequestConfig => {
            timings.set(config, Date.now());
            return config;
        },
        response: <T>(response: FetchResponse<T>): FetchResponse<T> => {
            console.log('[FetchClient] Response', {
                status: response.status,
                path: response.meta.path,
            });
            return response;
        },
    };
};
