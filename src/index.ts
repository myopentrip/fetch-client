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