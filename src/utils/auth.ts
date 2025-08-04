// Authentication utility functions
import type { AuthTokens, AuthConfig, LoginCredentials } from '../types';

/**
 * Create auth configuration with defaults
 */
export const createAuthConfig = (config: Partial<AuthConfig> = {}): AuthConfig => {
    return {
        tokenKey: 'authToken',
        refreshTokenKey: 'refreshToken',
        storage: 'localStorage',
        tokenPrefix: 'Bearer',
        autoRefresh: true,
        refreshThreshold: 300, // 5 minutes
        cookieOptions: {
            path: '/',
            secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 // 7 days
        },
        ...config
    };
};

/**
 * Create login credentials object
 */
export const createLoginCredentials = (
    email: string,
    password: string,
    additionalFields: Record<string, any> = {}
): LoginCredentials => {
    return {
        email,
        password,
        ...additionalFields
    };
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (tokens: AuthTokens, threshold: number = 300): boolean => {
    if (!tokens.expiresAt) return false;
    
    const now = Date.now();
    const refreshThreshold = threshold * 1000;
    
    return tokens.expiresAt <= (now + refreshThreshold);
};

/**
 * Calculate token expiry timestamp
 */
export const calculateTokenExpiry = (expiresIn: number): number => {
    return Date.now() + (expiresIn * 1000);
};

/**
 * Format time until token expires
 */
export const formatTokenTimeRemaining = (tokens: AuthTokens): string => {
    if (!tokens.expiresAt) return 'Unknown';
    
    const now = Date.now();
    const remaining = tokens.expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

/**
 * Extract JWT payload (without verification)
 */
export const extractJWTPayload = (token: string): any | null => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        return null;
    }
};

/**
 * Get user info from JWT token
 */
export const getUserFromToken = (token: string): any | null => {
    const payload = extractJWTPayload(token);
    if (!payload) return null;
    
    return {
        id: payload.sub || payload.id || payload.user_id,
        email: payload.email,
        username: payload.username || payload.preferred_username,
        name: payload.name || payload.full_name,
        roles: payload.roles || payload.authorities || [],
        permissions: payload.permissions || payload.scopes || [],
        exp: payload.exp,
        iat: payload.iat,
        ...payload
    };
};

/**
 * Validate token structure (basic validation)
 */
export const validateTokenStructure = (tokens: AuthTokens): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!tokens.accessToken) {
        errors.push('Access token is required');
    }
    
    if (typeof tokens.accessToken !== 'string') {
        errors.push('Access token must be a string');
    }
    
    if (tokens.refreshToken && typeof tokens.refreshToken !== 'string') {
        errors.push('Refresh token must be a string');
    }
    
    if (tokens.expiresIn && (typeof tokens.expiresIn !== 'number' || tokens.expiresIn <= 0)) {
        errors.push('ExpiresIn must be a positive number');
    }
    
    if (tokens.expiresAt && (typeof tokens.expiresAt !== 'number' || tokens.expiresAt <= Date.now())) {
        errors.push('ExpiresAt must be a future timestamp');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Create secure token storage implementation
 */
export const createSecureStorage = (encryptionKey?: string) => {
    const encrypt = (value: string): string => {
        if (!encryptionKey) return value;
        // Simple XOR encryption for demo - use proper encryption in production
        return btoa(value.split('').map((char, i) => 
            String.fromCharCode(char.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
        ).join(''));
    };
    
    const decrypt = (value: string): string => {
        if (!encryptionKey) return value;
        try {
            const decoded = atob(value);
            return decoded.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
            ).join('');
        } catch {
            return value;
        }
    };
    
    return {
        getItem: (key: string): string | null => {
            const value = localStorage.getItem(key);
            return value ? decrypt(value) : null;
        },
        setItem: (key: string, value: string): void => {
            localStorage.setItem(key, encrypt(value));
        },
        removeItem: (key: string): void => {
            localStorage.removeItem(key);
        }
    };
};

/**
 * Auth event emitter for handling auth state changes
 */
export class AuthEventEmitter {
    private listeners: Map<string, Function[]> = new Map();
    
    on(event: string, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        this.listeners.get(event)!.push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }
    
    emit(event: string, ...args: any[]): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(...args));
        }
    }
    
    removeAllListeners(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

/**
 * Token refresh queue to prevent multiple concurrent refresh requests
 */
export class TokenRefreshQueue {
    private isRefreshing = false;
    private refreshPromise: Promise<AuthTokens> | null = null;
    private waitingQueue: Array<{
        resolve: (tokens: AuthTokens) => void;
        reject: (error: Error) => void;
    }> = [];
    
    async addToQueue(): Promise<AuthTokens> {
        if (this.refreshPromise) {
            return new Promise((resolve, reject) => {
                this.waitingQueue.push({ resolve, reject });
            });
        }
        
        throw new Error('No refresh in progress');
    }
    
    startRefresh(refreshFunction: () => Promise<AuthTokens>): Promise<AuthTokens> {
        if (this.refreshPromise) {
            return this.addToQueue();
        }
        
        this.isRefreshing = true;
        this.refreshPromise = refreshFunction()
            .then(tokens => {
                // Resolve all waiting promises
                this.waitingQueue.forEach(({ resolve }) => resolve(tokens));
                this.clearQueue();
                return tokens;
            })
            .catch(error => {
                // Reject all waiting promises
                this.waitingQueue.forEach(({ reject }) => reject(error));
                this.clearQueue();
                throw error;
            });
        
        return this.refreshPromise;
    }
    
    private clearQueue(): void {
        this.isRefreshing = false;
        this.refreshPromise = null;
        this.waitingQueue = [];
    }
    
    get isActive(): boolean {
        return this.isRefreshing;
    }
}