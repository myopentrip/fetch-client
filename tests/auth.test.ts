import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchClient } from '../src/index';
import {
    AuthEventEmitter,
    createAuthConfig,
    createAuthPlugin,
    createLoginCredentials,
    formatTokenTimeRemaining,
    getUserFromToken,
    isTokenExpiredUtil as isTokenExpired,
    validateTokenStructure,
    type AuthTokens,
} from '../src/auth';

const JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MTYyMzkwMjIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXX0.QCjCgNdWDw9kWAtTJyEVGHF4gkdGN1F8zWKOvfNxUzk';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe('auth helpers', () => {
    it('createAuthConfig merges defaults', () => {
        const config = createAuthConfig({ storage: 'memory', autoRefresh: false });
        expect(config.storage).toBe('memory');
        expect(config.autoRefresh).toBe(false);
        expect(config.retryAfterRefresh).toBe(true);
        expect(config.tokenPrefix).toBe('Bearer');
    });

    it('createLoginCredentials includes extra fields', () => {
        const creds = createLoginCredentials('a@b.com', 'secret', { rememberMe: true });
        expect(creds).toEqual({ email: 'a@b.com', password: 'secret', rememberMe: true });
    });

    it('getUserFromToken decodes JWT payload', () => {
        const user = getUserFromToken(JWT);
        expect(user?.email).toBe('john@example.com');
        expect(user?.name).toBe('John Doe');
    });

    it('isTokenExpired respects expiresAt threshold', () => {
        const soon: AuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() + 60_000,
        };
        const later: AuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() + 600_000,
        };
        expect(isTokenExpired(soon, 120)).toBe(true);
        expect(isTokenExpired(later, 120)).toBe(false);
    });

    it('formatTokenTimeRemaining formats remaining time', () => {
        const tokens: AuthTokens = {
            accessToken: 'x',
            expiresAt: Date.now() + 90_000,
        };
        expect(formatTokenTimeRemaining(tokens)).toMatch(/^\d+m \d+s$/);
    });

    it('validateTokenStructure reports missing access token', () => {
        const result = validateTokenStructure({ accessToken: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Access token is required');
    });
});

describe('AuthEventEmitter', () => {
    it('notifies subscribers on emit', () => {
        const events = new AuthEventEmitter();
        let fired = false;
        events.on('login', () => {
            fired = true;
        });
        events.emit('login', { accessToken: 't' });
        expect(fired).toBe(true);
    });
});

describe('auth plugin (memory)', () => {
    it('tracks authentication state and user', async () => {
        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, { storage: 'memory' });

        expect(auth.isAuthenticated()).toBe(false);

        await auth.setTokens({
            accessToken: JWT,
            refreshToken: 'refresh',
            expiresIn: 3600,
        });

        expect(auth.isAuthenticated()).toBe(true);

        auth.setUser({ id: '1', name: 'Jane' });
        expect(auth.getUser()).toEqual({ id: '1', name: 'Jane' });

        await auth.clearTokens();
        expect(auth.isAuthenticated()).toBe(false);
    });

    it('adds Authorization header on requests', async () => {
        let authHeader: string | undefined;

        globalThis.fetch = vi.fn(async (_input, init) => {
            authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        const client = new FetchClient({ baseURL: 'https://api.test' });
        const auth = await createAuthPlugin(client, { storage: 'memory' });
        await auth.setTokens({ accessToken: 'my-token', refreshToken: 'r' });

        await client.get('/resource');

        expect(authHeader).toBe('Bearer my-token');
    });
});
