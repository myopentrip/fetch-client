export { AuthPlugin, createAuthPlugin } from './plugins/auth/auth-plugin';
export { AuthManager } from './plugins/auth/auth-manager';
export type {
    AuthConfig,
    AuthTokens,
    AuthState,
    LoginCredentials,
    CookieOptions,
    AuthRefreshRequestFn,
} from './plugins/auth/types';

export {
    createAuthConfig,
    createLoginCredentials,
    isTokenExpired as isTokenExpiredUtil,
    calculateTokenExpiry,
    formatTokenTimeRemaining,
    extractJWTPayload,
    getUserFromToken,
    validateTokenStructure,
    createSecureStorage,
    AuthEventEmitter,
    TokenRefreshQueue,
} from './plugins/auth/utils/helpers';

export * from './plugins/auth/utils/cookies';
