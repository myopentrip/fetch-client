import type { FetchClientConfig, RequestConfig, FetchResponse, FetchError, HttpMethod } from './types';

export class FetchClient {
  private config: Required<FetchClientConfig>;

  constructor(config: FetchClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      retries: config.retries || 0,
      retryDelay: config.retryDelay || 1000,
    };
  }

  private createURL(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    const base = this.config.baseURL.endsWith('/') 
      ? this.config.baseURL.slice(0, -1) 
      : this.config.baseURL;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${base}${cleanPath}`;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeRequest<T>(
    url: string,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    const {
      timeout = this.config.timeout,
      retries = this.config.retries,
      retryDelay = this.config.retryDelay,
      headers,
      ...fetchConfig
    } = config;

    const mergedHeaders = {
      ...this.config.headers,
      ...headers,
    };

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.withTimeout(
          fetch(url, {
            ...fetchConfig,
            headers: mergedHeaders,
          }),
          timeout
        );

        if (!response.ok) {
          const error: FetchError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.statusText = response.statusText;
          error.response = response;
          throw error;
        }

        const contentType = response.headers.get('content-type');
        let data: T;

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as unknown as T;
        }

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          await this.sleep(retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError!;
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    const url = this.createURL(path);
    return this.executeRequest<T>(url, {
      ...config,
      method,
    });
  }

  async get<T = unknown>(
    path: string,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    return this.request<T>('GET', path, config);
  }

  async post<T = unknown>(
    path: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    return this.request<T>('POST', path, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = unknown>(
    path: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    return this.request<T>('PUT', path, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = unknown>(
    path: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    return this.request<T>('PATCH', path, {
      ...config,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = unknown>(
    path: string,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    return this.request<T>('DELETE', path, config);
  }
}