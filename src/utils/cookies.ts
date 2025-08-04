// Cookie utilities for authentication storage
import type { CookieOptions } from '../types';

/**
 * Check if we're in a browser environment
 */
const isBrowser = (): boolean => {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
};

/**
 * Parse cookie string into key-value pairs
 */
export const parseCookies = (cookieString?: string): Record<string, string> => {
    const cookies: Record<string, string> = {};
    const cookieStr = cookieString || (isBrowser() ? document.cookie : '');
    
    if (!cookieStr) return cookies;
    
    cookieStr.split(';').forEach(cookie => {
        const [key, ...rest] = cookie.trim().split('=');
        if (key && rest.length > 0) {
            cookies[key] = decodeURIComponent(rest.join('='));
        }
    });
    
    return cookies;
};

/**
 * Get a specific cookie value
 */
export const getCookie = (name: string, cookieString?: string): string | null => {
    const cookies = parseCookies(cookieString);
    return cookies[name] || null;
};

/**
 * Set a cookie with options
 */
export const setCookie = (
    name: string, 
    value: string, 
    options: CookieOptions = {}
): void => {
    if (!isBrowser()) {
        console.warn('setCookie called in non-browser environment');
        return;
    }

    const {
        domain,
        path = '/',
        secure = window.location.protocol === 'https:',
        httpOnly = false, // Note: can't set httpOnly from client-side JS
        sameSite = 'lax',
        maxAge,
        expires
    } = options;

    let cookieString = `${name}=${encodeURIComponent(value)}`;
    
    if (path) cookieString += `; Path=${path}`;
    if (domain) cookieString += `; Domain=${domain}`;
    if (secure) cookieString += `; Secure`;
    if (sameSite) cookieString += `; SameSite=${sameSite}`;
    
    if (maxAge !== undefined) {
        cookieString += `; Max-Age=${maxAge}`;
    } else if (expires) {
        cookieString += `; Expires=${expires.toUTCString()}`;
    }
    
    // Note: httpOnly cannot be set from client-side JavaScript
    // It must be set by the server
    if (httpOnly) {
        console.warn('httpOnly cookies cannot be set from client-side JavaScript. This must be set by the server.');
    }
    
    document.cookie = cookieString;
};

/**
 * Remove a cookie
 */
export const removeCookie = (
    name: string, 
    options: Pick<CookieOptions, 'domain' | 'path'> = {}
): void => {
    if (!isBrowser()) {
        console.warn('removeCookie called in non-browser environment');
        return;
    }

    const { domain, path = '/' } = options;
    
    let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    
    if (path) cookieString += `; Path=${path}`;
    if (domain) cookieString += `; Domain=${domain}`;
    
    document.cookie = cookieString;
};

/**
 * Create cookie storage implementation
 */
export const createCookieStorage = (options: CookieOptions = {}) => {
    const defaultOptions: CookieOptions = {
        path: '/',
        secure: isBrowser() && window.location.protocol === 'https:',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days default
        ...options
    };

    return {
        getItem: (key: string): string | null => {
            return getCookie(key);
        },
        
        setItem: (key: string, value: string): void => {
            setCookie(key, value, defaultOptions);
        },
        
        removeItem: (key: string): void => {
            removeCookie(key, {
                domain: defaultOptions.domain,
                path: defaultOptions.path
            });
        }
    };
};

/**
 * Create secure cookie storage with encryption
 */
export const createSecureCookieStorage = (
    encryptionKey?: string,
    cookieOptions: CookieOptions = {}
) => {
    const cookieStorage = createCookieStorage({
        secure: true,
        sameSite: 'strict',
        ...cookieOptions
    });

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
            const value = cookieStorage.getItem(key);
            return value ? decrypt(value) : null;
        },
        
        setItem: (key: string, value: string): void => {
            cookieStorage.setItem(key, encrypt(value));
        },
        
        removeItem: (key: string): void => {
            cookieStorage.removeItem(key);
        }
    };
};

/**
 * Server-side cookie utilities for Next.js/Node.js
 */
export const createServerSideCookieStorage = (
    getRequestCookies: () => string,
    setResponseCookie: (name: string, value: string, options?: CookieOptions) => void,
    removeResponseCookie: (name: string, options?: Pick<CookieOptions, 'domain' | 'path'>) => void
) => {
    return {
        getItem: (key: string): string | null => {
            const cookies = parseCookies(getRequestCookies());
            return cookies[key] || null;
        },
        
        setItem: (key: string, value: string): void => {
            setResponseCookie(key, value, {
                httpOnly: true, // Server can set httpOnly
                secure: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 // 7 days
            });
        },
        
        removeItem: (key: string): void => {
            removeResponseCookie(key);
        }
    };
};

/**
 * Cookie-based session management
 */
export class CookieSession {
    private storage: ReturnType<typeof createCookieStorage>;
    private sessionKey: string;

    constructor(sessionKey: string = 'session', options: CookieOptions = {}) {
        this.sessionKey = sessionKey;
        this.storage = createCookieStorage(options);
    }

    set<T>(data: T): void {
        const sessionData = JSON.stringify(data);
        this.storage.setItem(this.sessionKey, sessionData);
    }

    get<T>(): T | null {
        const sessionData = this.storage.getItem(this.sessionKey);
        if (!sessionData) return null;
        
        try {
            return JSON.parse(sessionData);
        } catch {
            return null;
        }
    }

    clear(): void {
        this.storage.removeItem(this.sessionKey);
    }

    exists(): boolean {
        return this.storage.getItem(this.sessionKey) !== null;
    }
}

/**
 * Utility to check if cookies are enabled
 */
export const areCookiesEnabled = (): boolean => {
    if (!isBrowser()) return false;
    
    try {
        const testKey = '__test_cookie__';
        setCookie(testKey, 'test');
        const enabled = getCookie(testKey) === 'test';
        removeCookie(testKey);
        return enabled;
    } catch {
        return false;
    }
};

/**
 * Get all cookies as an object
 */
export const getAllCookies = (): Record<string, string> => {
    return parseCookies();
};

/**
 * Clear all cookies (client-side only, limited effectiveness)
 */
export const clearAllCookies = (): void => {
    if (!isBrowser()) return;
    
    const cookies = getAllCookies();
    Object.keys(cookies).forEach(name => {
        removeCookie(name);
        // Try with different path combinations
        removeCookie(name, { path: '/' });
        removeCookie(name, { path: '' });
    });
};