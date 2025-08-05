import type {
    FetchClientConfig,
    RequestConfig,
    FetchResponse,
    FetchError,
    HttpMethod,
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor,
    RetryConfig,
    FileUploadConfig,
    FileUploadData,
    MultipartFormData,
    AuthConfig,
    AuthTokens,
    AuthState,
    LoginCredentials
} from './types';

import { AuthManager } from './managers/auth-manager';
import { UploadManager } from './managers/upload-manager';
import { InterceptorManager } from './managers/interceptor-manager';
import { RequestExecutor } from './managers/request-executor';
import { RetryManager } from './managers/retry-manager';

export class FetchClient {
    private config: Required<Omit<FetchClientConfig, 'auth'>> & { auth?: AuthConfig };
    private authManager: AuthManager | null = null;
    private uploadManager: UploadManager;
    private interceptorManager: InterceptorManager;
    private requestExecutor: RequestExecutor;
    private retryManager: RetryManager;

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
            auth: config.auth,
        };

        // Initialize managers
        this.interceptorManager = new InterceptorManager(
            this.config.enableInterceptors,
            this.config.debug
        );

        this.requestExecutor = new RequestExecutor(
            this.config.baseURL,
            this.config.timeout,
            this.config.headers,
            this.config.debug
        );

        this.uploadManager = new UploadManager(
            this.config.debug,
            this.config.timeout,
            this.config.headers
        );

        const retryConfig = {
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
        this.retryManager = new RetryManager(retryConfig, this.config.debug);

        // Initialize auth if configured
        if (this.config.auth) {
            this.initializeAuth();
        }
    }

    // Interceptor management methods (delegated)
    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        return this.interceptorManager.addRequestInterceptor(interceptor);
    }

    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        return this.interceptorManager.addResponseInterceptor(interceptor);
    }

    addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
        return this.interceptorManager.addErrorInterceptor(interceptor);
    }

    updateRetryConfig(config: Partial<RetryConfig>): void {
        this.retryManager.updateConfig(config);
    }

    // Authentication Methods (delegated)

    /**
     * Login with credentials
     */
    async login<T = any>(credentials: LoginCredentials): Promise<FetchResponse<T>> {
        if (!this.authManager) {
            throw new Error('Authentication not configured');
        }

        if (!this.config.auth?.loginUrl) {
            throw new Error('Login URL not configured');
        }

        try {
            const response = await this.post<T>(this.config.auth.loginUrl, credentials);

            await this.authManager.processLoginResponse(response);

            return response;
        } catch (error) {
            this.authManager.handleLoginError(error as FetchError);
            throw error;
        }
    }

    /**
     * Logout user
     */
    async logout(): Promise<void> {
        if (!this.authManager) {
            throw new Error('Authentication not configured');
        }

        try {
            // Call logout endpoint if configured
            if (this.config.auth?.logoutUrl) {
                await this.post(this.config.auth.logoutUrl);
            }
        } catch (error) {
            // Continue with logout even if endpoint fails
            this.log('Logout endpoint failed', error);
        } finally {
            await this.authManager.clearTokens();
            this.authManager.handleLogout();
        }
    }

    /**
     * Set authentication tokens
     */
    async setTokens(tokens: AuthTokens): Promise<void> {
        if (!this.authManager) {
            throw new Error('Authentication not configured');
        }

        await this.authManager.setTokens(tokens);
        this.addAuthInterceptor();
    }

    /**
     * Get current tokens
     */
    getTokens(): AuthTokens | null {
        return this.authManager?.getTokens() || null;
    }

    /**
     * Clear authentication tokens
     */
    async clearTokens(): Promise<void> {
        if (!this.authManager) {
            throw new Error('Authentication not configured');
        }

        await this.authManager.clearTokens();
        this.removeAuthInterceptor();
        
        if (this.config.debug) {
            this.log('Authentication tokens cleared and interceptors removed');
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.authManager?.isAuthenticated() || false;
    }

    /**
     * Check if token is expired or will expire soon
     */
    isTokenExpired(threshold?: number): boolean {
        return this.authManager?.isTokenExpired(threshold) || false;
    }

    /**
     * Refresh authentication tokens
     */
    async refreshTokens(): Promise<AuthTokens> {
        if (!this.authManager) {
            throw new Error('Authentication not configured');
        }

        return this.authManager.refreshTokens(this.createRequestFunctionForAuth());
    }

    /**
     * Get auth state
     */
    getAuthState(): AuthState {
        return this.authManager?.getAuthState() || {
            isAuthenticated: false,
            tokens: null,
            isRefreshing: false,
        };
    }

    /**
     * Set user information
     */
    setUser(user: any): void {
        this.authManager?.setUser(user);
    }

    /**
     * Get current user
     */
    getUser(): any {
        return this.authManager?.getUser();
    }

    // HTTP Methods (delegated with interceptors and retry)

    async request<T = unknown>(
        method: HttpMethod,
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.retryManager.executeWithRetry(async () => {
            // Apply request interceptors
            const interceptedConfig = await this.interceptorManager.applyRequestInterceptors({
                ...config,
                method,
            });

            // Execute request
            const url = this.createURL(path);
            const response = await this.requestExecutor.executeRequest<T>(url, interceptedConfig);

            // Apply response interceptors
            return await this.interceptorManager.applyResponseInterceptors(response);
        }, `${method} ${path}`, (error: FetchError) => this.interceptorManager.applyErrorInterceptors(error));
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
            body: this.prepareRequestBody(data),
            headers: this.prepareRequestHeaders(data, config.headers),
        });
    }

    async put<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('PUT', path, {
            ...config,
            body: this.prepareRequestBody(data),
            headers: this.prepareRequestHeaders(data, config.headers),
        });
    }

    async patch<T = unknown>(
        path: string,
        data?: unknown,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('PATCH', path, {
            ...config,
            body: this.prepareRequestBody(data),
            headers: this.prepareRequestHeaders(data, config.headers),
        });
    }

    async delete<T = unknown>(
        path: string,
        config: RequestConfig = {}
    ): Promise<FetchResponse<T>> {
        return this.request<T>('DELETE', path, config);
    }

    // File Upload Methods (delegated)

    /**
     * Upload a single file or multiple files
     */
    async uploadFile<T = unknown>(
        path: string,
        fileData: FileUploadData,
        config: FileUploadConfig = {}
    ): Promise<FetchResponse<T>> {
        const url = this.createURL(path);
        return this.uploadManager.uploadFile<T>(url, fileData, config, this.createRequestFunctionForUpload<T>());
    }

    /**
     * Upload multiple files
     */
    async uploadFiles<T = unknown>(
        path: string,
        files: File[],
        config: FileUploadConfig & { fieldName?: string } = {}
    ): Promise<FetchResponse<T>> {
        const url = this.createURL(path);
        return this.uploadManager.uploadFiles<T>(url, files, config, this.createRequestFunctionForUpload<T>());
    }

    /**
     * Upload form data with files and other fields
     */
    async uploadFormData<T = unknown>(
        path: string,
        formData: FormData | MultipartFormData,
        config: FileUploadConfig = {}
    ): Promise<FetchResponse<T>> {
        const url = this.createURL(path);
        return this.uploadManager.uploadFormData<T>(url, formData, config, this.createRequestFunctionForUpload<T>());
    }

    // Private methods

    private async initializeAuth(): Promise<void> {
        if (!this.config.auth) return;

        this.authManager = new AuthManager(this.config.auth, this.config.debug);
        await this.authManager.initialize();

        // Add auth interceptor if tokens exist
        if (this.authManager.getTokens()) {
            this.addAuthInterceptor();
        }

        // Add response interceptor for handling 401s
        this.addResponseInterceptor(async (response) => {
            if (response.status === 401 && this.config.auth?.autoRefresh !== false) {
                await this.handleUnauthorized();
            }
            return response;
        });
    }

    private async handleUnauthorized(): Promise<void> {
        if (!this.authManager) return;

        await this.authManager.handleUnauthorized(this.createRequestFunctionForAuth());
    }

    private addAuthInterceptor(): void {
        if (!this.authManager) return;

        // Remove existing auth interceptor if any
        this.removeAuthInterceptor();

        // Add new auth interceptor
        this.authInterceptor = this.authManager.createAuthInterceptor();
        this.addRequestInterceptor(this.authInterceptor);
    }

    private removeAuthInterceptor(): void {
        if (this.authInterceptor) {
            const removed = this.interceptorManager.removeRequestInterceptor(this.authInterceptor);
            if (this.config.debug && !removed) {
                this.log('Warning: Auth interceptor removal failed - interceptor not found');
            }
            this.authInterceptor = null;
        }
    }

    private authInterceptor: RequestInterceptor | null = null;

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

    private prepareRequestBody(data?: unknown): BodyInit | undefined {
        if (!data) return undefined;

        // Don't modify FormData or other BodyInit types
        if (data instanceof FormData ||
            data instanceof Blob ||
            data instanceof ArrayBuffer ||
            data instanceof URLSearchParams ||
            typeof data === 'string') {
            return data as BodyInit;
        }

        // JSON stringify for regular objects
        return JSON.stringify(data);
    }

    private prepareRequestHeaders(data?: unknown, configHeaders?: HeadersInit): Record<string, string> {
        // Convert HeadersInit to Record<string, string>
        let headers: Record<string, string> = {};

        if (configHeaders) {
            if (configHeaders instanceof Headers) {
                configHeaders.forEach((value, key) => {
                    headers[key] = value;
                });
            } else if (Array.isArray(configHeaders)) {
                configHeaders.forEach(([key, value]) => {
                    headers[key] = value;
                });
            } else {
                headers = { ...configHeaders };
            }
        }

        // If data is FormData, remove Content-Type to let browser set it with boundary
        if (data instanceof FormData) {
            delete headers['Content-Type'];
            delete headers['content-type'];
        }

        return headers;
    }

    private createRequestFunctionForAuth() {
        return async (url: string, data: any): Promise<FetchResponse> => {
            // Create a simple POST request for auth operations (without interceptors to avoid recursion)
            return this.requestExecutor.post(url, data);
        };
    }

    private createRequestFunctionForUpload<T = unknown>() {
        return async (url: string, config: RequestConfig): Promise<FetchResponse<T>> => {
            // Create request for upload operations with interceptors applied
            const interceptedConfig = await this.interceptorManager.applyRequestInterceptors(config);
            return this.requestExecutor.executeRequest<T>(url, interceptedConfig);
        };
    }

    private log(message: string, data?: any): void {
        if (this.config.debug) {
            console.log(`[FetchClient] ${message}`, data || '');
        }
    }
}