import type {
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    Interceptors,
    RequestConfig,
    FetchResponse,
    FetchError,
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

    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        this.interceptors.request.push(interceptor);
        if (this.debugMode) this.log('Request interceptor added');

        return () => {
            const index = this.interceptors.request.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.request.splice(index, 1);
                if (this.debugMode) this.log('Request interceptor removed');
            }
        };
    }

    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        this.interceptors.response.push(interceptor);
        if (this.debugMode) this.log('Response interceptor added');

        return () => {
            const index = this.interceptors.response.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.response.splice(index, 1);
                if (this.debugMode) this.log('Response interceptor removed');
            }
        };
    }

    addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
        this.interceptors.error.push(interceptor);
        if (this.debugMode) this.log('Error interceptor added');

        return () => {
            const index = this.interceptors.error.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.error.splice(index, 1);
                if (this.debugMode) this.log('Error interceptor removed');
            }
        };
    }

    removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
        const index = this.interceptors.request.indexOf(interceptor);
        if (index > -1) {
            this.interceptors.request.splice(index, 1);
            if (this.debugMode) this.log('Request interceptor removed');
            return true;
        }
        return false;
    }

    clearAllInterceptors(): void {
        this.interceptors.request = [];
        this.interceptors.response = [];
        this.interceptors.error = [];
        if (this.debugMode) this.log('All interceptors cleared');
    }

    getInterceptorCounts(): { request: number; response: number; error: number } {
        return {
            request: this.interceptors.request.length,
            response: this.interceptors.response.length,
            error: this.interceptors.error.length,
        };
    }

    setInterceptorsEnabled(enabled: boolean): void {
        this.enabledInterceptors = enabled;
        if (this.debugMode) this.log(`Interceptors ${enabled ? 'enabled' : 'disabled'}`);
    }

    async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
        if (!this.enabledInterceptors) return config;

        let modifiedConfig = { ...config };

        for (const interceptor of this.interceptors.request) {
            modifiedConfig = await interceptor(modifiedConfig);
        }

        return modifiedConfig;
    }

    async applyResponseInterceptors<T>(response: FetchResponse<T>): Promise<FetchResponse<T>> {
        if (!this.enabledInterceptors) return response;

        let modifiedResponse: FetchResponse<T> = response;

        for (const interceptor of this.interceptors.response) {
            modifiedResponse = (await interceptor(modifiedResponse)) as FetchResponse<T>;
        }

        return modifiedResponse;
    }

    async applyErrorInterceptors(error: FetchError): Promise<FetchError> {
        if (!this.enabledInterceptors) return error;

        let modifiedError = this.cloneError(error);

        for (const interceptor of this.interceptors.error) {
            try {
                modifiedError = await interceptor(modifiedError);
            } catch (interceptorError) {
                if (this.debugMode) this.log('Error interceptor failed', interceptorError);
                return error;
            }
        }

        return modifiedError;
    }

    private cloneError(error: FetchError): FetchError {
        const cloned = new Error(error.message) as FetchError;
        Object.assign(cloned, error);
        if (error.stack) cloned.stack = error.stack;
        if (error.name) cloned.name = error.name;
        return cloned;
    }

    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            console.log(`[InterceptorManager] ${message}`, data ?? '');
        }
    }
}
