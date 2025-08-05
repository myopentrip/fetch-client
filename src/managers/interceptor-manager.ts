import type {
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    Interceptors,
    RequestConfig,
    FetchResponse,
    FetchError
} from '../types';

export class InterceptorManager {
    private interceptors: Interceptors;
    private enabledInterceptors: boolean;
    private debugMode: boolean;

    constructor(enableInterceptors: boolean = true, debugMode: boolean = false) {
        this.interceptors = {
            request: [],
            response: [],
            error: [],
        };
        this.enabledInterceptors = enableInterceptors;
        this.debugMode = debugMode;
    }

    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        this.interceptors.request.push(interceptor);
        if (this.debugMode) {
            this.log('Request interceptor added');
        }

        return () => {
            const index = this.interceptors.request.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.request.splice(index, 1);
                if (this.debugMode) {
                    this.log('Request interceptor removed');
                }
            }
        };
    }

    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        this.interceptors.response.push(interceptor);
        if (this.debugMode) {
            this.log('Response interceptor added');
        }

        return () => {
            const index = this.interceptors.response.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.response.splice(index, 1);
                if (this.debugMode) {
                    this.log('Response interceptor removed');
                }
            }
        };
    }

    /**
     * Add error interceptor
     */
    addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
        this.interceptors.error.push(interceptor);
        if (this.debugMode) {
            this.log('Error interceptor added');
        }

        return () => {
            const index = this.interceptors.error.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.error.splice(index, 1);
                if (this.debugMode) {
                    this.log('Error interceptor removed');
                }
            }
        };
    }

    /**
     * Remove a specific request interceptor
     */
    removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
        const index = this.interceptors.request.indexOf(interceptor);
        if (index > -1) {
            this.interceptors.request.splice(index, 1);
            if (this.debugMode) {
                this.log('Request interceptor removed');
            }
            return true;
        }
        return false;
    }

    /**
     * Clear all interceptors
     */
    clearAllInterceptors(): void {
        this.interceptors.request = [];
        this.interceptors.response = [];
        this.interceptors.error = [];
        if (this.debugMode) {
            this.log('All interceptors cleared');
        }
    }

    /**
     * Clear interceptors of specific type
     */
    clearInterceptorsByType(type: 'request' | 'response' | 'error'): void {
        this.interceptors[type] = [];
        if (this.debugMode) {
            this.log(`${type} interceptors cleared`);
        }
    }

    /**
     * Get current interceptor counts
     */
    getInterceptorCounts(): { request: number; response: number; error: number } {
        return {
            request: this.interceptors.request.length,
            response: this.interceptors.response.length,
            error: this.interceptors.error.length,
        };
    }

    /**
     * Enable or disable interceptors
     */
    setInterceptorsEnabled(enabled: boolean): void {
        this.enabledInterceptors = enabled;
        if (this.debugMode) {
            this.log(`Interceptors ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Apply request interceptors
     */
    async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
        if (!this.enabledInterceptors) {
            return config;
        }

        let modifiedConfig = { ...config };

        for (const interceptor of this.interceptors.request) {
            try {
                modifiedConfig = await interceptor(modifiedConfig);
            } catch (error) {
                if (this.debugMode) {
                    this.log('Request interceptor failed', error);
                }
                throw error;
            }
        }

        return modifiedConfig;
    }

    /**
     * Apply response interceptors
     */
    async applyResponseInterceptors<T>(response: FetchResponse<T>): Promise<FetchResponse<T>> {
        if (!this.enabledInterceptors) {
            return response;
        }

        let modifiedResponse = { ...response };

        for (const interceptor of this.interceptors.response) {
            try {
                modifiedResponse = await (interceptor as any)(modifiedResponse) as FetchResponse<T>;
            } catch (error) {
                if (this.debugMode) {
                    this.log('Response interceptor failed', error);
                }
                throw error;
            }
        }

        return modifiedResponse;
    }

    /**
     * Apply error interceptors
     */
    async applyErrorInterceptors(error: FetchError): Promise<FetchError> {
        if (!this.enabledInterceptors) {
            return error;
        }

        // Properly clone the error while preserving Error prototype
        let modifiedError = this.cloneError(error);

        for (const interceptor of this.interceptors.error) {
            try {
                modifiedError = await interceptor(modifiedError);
            } catch (interceptorError) {
                if (this.debugMode) {
                    this.log('Error interceptor failed', interceptorError);
                }
                return error; // Return original error if interceptor fails
            }
        }

        return modifiedError;
    }

    /**
     * Properly clone an error object while preserving its Error nature
     */
    private cloneError(error: FetchError): FetchError {
        // Create a new error with the same message
        const cloned = new Error(error.message) as FetchError;
        
        // Copy all enumerable properties
        Object.assign(cloned, error);
        
        // Ensure critical properties are preserved
        if (error.stack) cloned.stack = error.stack;
        if ('cause' in error && (error as any).cause) (cloned as any).cause = (error as any).cause;
        if (error.name) cloned.name = error.name;
        
        return cloned;
    }

    /**
     * Create a response interceptor for handling unauthorized responses
     */
    createUnauthorizedInterceptor(
        handleUnauthorized: () => Promise<void>
    ): ResponseInterceptor {
        return async (response) => {
            if (response.status === 401) {
                await handleUnauthorized();
            }
            return response;
        };
    }

    private log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[InterceptorManager] ${message}`, data || '');
        }
    }
}