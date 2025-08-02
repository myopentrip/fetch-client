import type { 
  FetchClientConfig, 
  RequestConfig, 
  FetchResponse, 
  FetchError, 
  HttpMethod, 
  RequestInterceptor, 
  ResponseInterceptor, 
  ErrorInterceptor,
  Interceptors,
  RetryConfig
} from './types';

export class FetchClient {
  private config: Required<FetchClientConfig>;
  private interceptors: Interceptors;
  private retryConfig: RetryConfig;

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
      enableInterceptors: config.enableInterceptors !== false,
      debug: config.debug || false,
    };

    this.interceptors = {
      request: [],
      response: [],
      error: [],
    };

    this.retryConfig = {
      maxRetries: this.config.retries,
      baseDelay: this.config.retryDelay,
      maxDelay: 30000, // 30 seconds max
      backoffFactor: 2,
      jitter: true,
      retryCondition: (error: FetchError, attempt: number) => {
        // Retry on network errors or 5xx status codes
        return !error.status || (error.status >= 500 && error.status < 600);
      },
    };
  }

  // Interceptor management methods
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.interceptors.request.push(interceptor);
    return () => {
      const index = this.interceptors.request.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.request.splice(index, 1);
      }
    };
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.interceptors.response.push(interceptor);
    return () => {
      const index = this.interceptors.response.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.response.splice(index, 1);
      }
    };
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.interceptors.error.push(interceptor);
    return () => {
      const index = this.interceptors.error.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.error.splice(index, 1);
      }
    };
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
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

  private calculateRetryDelay(attempt: number): number {
    let delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt);
    
    if (this.retryConfig.jitter) {
      // Add ±10% jitter to prevent thundering herd
      const jitterRange = delay * 0.1;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    if (!this.config.enableInterceptors) return config;
    
    let modifiedConfig = { ...config };
    
    for (const interceptor of this.interceptors.request) {
      try {
        modifiedConfig = await interceptor(modifiedConfig);
      } catch (error) {
        if (this.config.debug) {
          console.warn('Request interceptor failed:', error);
        }
        throw error;
      }
    }
    
    return modifiedConfig;
  }

  private async applyResponseInterceptors<T>(response: FetchResponse<T>): Promise<FetchResponse<T>> {
    if (!this.config.enableInterceptors) return response;
    
    let modifiedResponse = { ...response };
    
    for (const interceptor of this.interceptors.response) {
      try {
        modifiedResponse = await (interceptor as any)(modifiedResponse);
      } catch (error) {
        if (this.config.debug) {
          console.warn('Response interceptor failed:', error);
        }
        throw error;
      }
    }
    
    return modifiedResponse;
  }

  private async applyErrorInterceptors(error: FetchError): Promise<FetchError> {
    if (!this.config.enableInterceptors) return error;
    
    let modifiedError = { ...error };
    
    for (const interceptor of this.interceptors.error) {
      try {
        modifiedError = await interceptor(modifiedError);
      } catch (interceptorError) {
        if (this.config.debug) {
          console.warn('Error interceptor failed:', interceptorError);
        }
        return error; // Return original error if interceptor fails
      }
    }
    
    return modifiedError;
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[FetchClient] ${message}`, data || '');
    }
  }

      private async executeRequest<T>(
    url: string,
    config: RequestConfig = {}
  ): Promise<FetchResponse<T>> {
    // Apply request interceptors
    const interceptedConfig = await this.applyRequestInterceptors(config);
    
    const {
      timeout = this.config.timeout,
      retries = this.retryConfig.maxRetries,
      headers,
      signal,
      ...fetchConfig
    } = interceptedConfig;

    const mergedHeaders = {
      ...this.config.headers,
      ...headers,
    };

    let lastError: FetchError | undefined;
    const startTime = Date.now();

    this.log('Starting request', { url, method: fetchConfig.method, headers: mergedHeaders });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller if no signal provided but timeout is set
        const controller = signal ? undefined : new AbortController();
        const requestSignal = signal || controller?.signal;

        // Set up timeout for abort controller if we created one
        let timeoutId: NodeJS.Timeout | undefined;
        if (controller && timeout) {
          timeoutId = setTimeout(() => {
            controller.abort();
          }, timeout);
        }

        const response = await fetch(url, {
          ...fetchConfig,
          headers: mergedHeaders,
          signal: requestSignal,
        });

        // Clear timeout if request succeeded
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

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
          try {
            data = await response.json();
          } catch (parseError) {
            // If JSON parsing fails, fall back to text
            data = (await response.text()) as unknown as T;
          }
        } else {
          data = (await response.text()) as unknown as T;
        }

        const fetchResponse: FetchResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };

        const duration = Date.now() - startTime;
        this.log('Request completed successfully', { 
          url, 
          status: response.status, 
          duration: `${duration}ms`,
          attempt: attempt + 1 
        });

        // Apply response interceptors
        return await this.applyResponseInterceptors(fetchResponse);

      } catch (error) {
        const fetchError = error as FetchError;
        
        // Check if we should retry this error
        const shouldRetry = attempt < retries && 
          this.retryConfig.retryCondition && 
          this.retryConfig.retryCondition(fetchError, attempt);

        this.log(`Request failed (attempt ${attempt + 1}/${retries + 1})`, { 
          url, 
          error: fetchError.message,
          shouldRetry 
        });

        if (shouldRetry) {
          const delay = this.calculateRetryDelay(attempt);
          this.log(`Retrying in ${delay}ms`, { attempt: attempt + 1, delay });
          await this.sleep(delay);
        } else {
          lastError = fetchError;
          break;
        }
        
        lastError = fetchError;
      }
    }

    // Apply error interceptors before throwing
    if (lastError) {
      const processedError = await this.applyErrorInterceptors(lastError);
      throw processedError;
    } else {
      throw new Error('Request failed with unknown error');
    }
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