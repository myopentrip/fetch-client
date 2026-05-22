import type {
    FetchClientLike,
    FetchResponse,
    FetchError,
    ErrorInterceptorContext,
} from '../../core/types';
import type {
    AuthConfig,
    AuthTokens,
    AuthState,
    LoginCredentials,
    AuthRefreshRequestFn,
} from './types';
import { AuthManager } from './auth-manager';

export class AuthPlugin {
    readonly name = 'auth';

    private authInterceptor: ReturnType<AuthManager['createAuthInterceptor']> | null = null;
    private removeAuthErrorInterceptor?: () => void;

    private constructor(
        private readonly client: FetchClientLike,
        private readonly manager: AuthManager,
        private readonly config: AuthConfig
    ) {}

    static async create(client: FetchClientLike, config: AuthConfig): Promise<AuthPlugin> {
        const plugin = new AuthPlugin(client, new AuthManager(config, config.debug ?? false), config);
        await plugin.init();
        return plugin;
    }

    private async init(): Promise<void> {
        await this.manager.initialize();

        if (this.manager.getTokens()) {
            this.attachAuthInterceptor();
        }

        if (this.config.autoRefresh !== false) {
            this.removeAuthErrorInterceptor = this.client.addErrorInterceptor((error, context) =>
                this.handleUnauthorizedError(error, context)
            );
        }
    }

    private async handleUnauthorizedError(
        error: FetchError,
        context?: ErrorInterceptorContext
    ): Promise<FetchResponse | FetchError> {
        if (error.status !== 401 || !context) {
            return error;
        }

        const meta = context.config.meta;
        if (meta?.skipAuthRefresh || meta?.authRetried) {
            return error;
        }

        const refreshToken = this.manager.getTokens()?.refreshToken;
        if (!refreshToken || !this.config.tokenRefreshUrl) {
            await this.manager.handleUnauthorized(this.createRefreshRequestFn());
            return error;
        }

        try {
            await this.manager.refreshTokens(this.createRefreshRequestFn());
        } catch {
            return error;
        }

        if (!this.manager.isAuthenticated()) {
            return error;
        }

        this.attachAuthInterceptor();

        if (this.config.retryAfterRefresh === false) {
            return error;
        }

        const retryResponse = await this.client.request(
            context.method,
            context.path,
            {
                ...context.config,
                meta: {
                    ...context.config.meta,
                    path: context.path,
                    method: context.method,
                    authRetried: true,
                },
            }
        );

        return retryResponse;
    }

    async login<T = unknown>(credentials: LoginCredentials): Promise<FetchResponse<T>> {
        if (!this.config.loginUrl) {
            throw new Error('Login URL not configured');
        }

        try {
            const response = await this.client.post<T>(this.config.loginUrl, credentials, {
                meta: { skipAuthRefresh: true },
            });
            await this.manager.processLoginResponse(response);
            this.attachAuthInterceptor();
            return response;
        } catch (error) {
            this.manager.handleLoginError(error as FetchError);
            throw error;
        }
    }

    async logout(): Promise<void> {
        try {
            if (this.config.logoutUrl) {
                await this.client.post(this.config.logoutUrl, undefined, {
                    meta: { skipAuthRefresh: true },
                });
            }
        } catch {
            // continue logout locally
        } finally {
            await this.manager.clearTokens();
            this.detachAuthInterceptor();
            this.manager.handleLogout();
        }
    }

    async setTokens(tokens: AuthTokens): Promise<void> {
        await this.manager.setTokens(tokens);
        this.attachAuthInterceptor();
    }

    getTokens(): AuthTokens | null {
        return this.manager.getTokens();
    }

    async clearTokens(): Promise<void> {
        await this.manager.clearTokens();
        this.detachAuthInterceptor();
    }

    isAuthenticated(): boolean {
        return this.manager.isAuthenticated();
    }

    isTokenExpired(threshold?: number): boolean {
        return this.manager.isTokenExpired(threshold);
    }

    async refreshTokens(): Promise<AuthTokens> {
        const tokens = await this.manager.refreshTokens(this.createRefreshRequestFn());
        this.attachAuthInterceptor();
        return tokens;
    }

    getAuthState(): AuthState {
        return this.manager.getAuthState();
    }

    setUser(user: unknown): void {
        this.manager.setUser(user);
    }

    getUser(): unknown {
        return this.manager.getUser();
    }

    teardown(): void {
        this.detachAuthInterceptor();
        this.removeAuthErrorInterceptor?.();
        this.removeAuthErrorInterceptor = undefined;
    }

    private attachAuthInterceptor(): void {
        this.detachAuthInterceptor();
        this.authInterceptor = this.manager.createAuthInterceptor();
        this.client.addRequestInterceptor(this.authInterceptor);
    }

    private detachAuthInterceptor(): void {
        if (this.authInterceptor) {
            this.client.removeRequestInterceptor(this.authInterceptor);
            this.authInterceptor = null;
        }
    }

    private createRefreshRequestFn(): AuthRefreshRequestFn {
        return (url, data) => {
            if (!this.client.rawPost) {
                throw new Error('FetchClient.rawPost is required for token refresh');
            }
            return this.client.rawPost(url, data);
        };
    }
}

export async function createAuthPlugin(
    client: FetchClientLike,
    config: AuthConfig
): Promise<AuthPlugin> {
    return AuthPlugin.create(client, config);
}
