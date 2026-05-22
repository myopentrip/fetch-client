import { describe, expect, it } from 'vitest';
import { FetchClient, type FetchError } from '../src/index';
import {
    analyzeSSLError,
    createDevelopmentSSLErrorInterceptor,
    createProductionSSLErrorInterceptor,
    createSSLErrorInterceptor,
    createSSLErrorPlugin,
    getSSLErrorSuggestions,
    isSSLError,
    shouldRetrySSLError,
    transformSSLError,
} from '../src/ssl';

function mockError(message: string, extra: Record<string, unknown> = {}): FetchError {
    return { message, name: 'FetchError', ...extra } as FetchError;
}

describe('SSL error utilities', () => {
    it.each([
        ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', true],
        ['certificate verify failed', true],
        ['CERT_UNTRUSTED', true],
        ['SELF_SIGNED_CERT_IN_CHAIN', true],
        ['SSL_ERROR_SYSCALL', true],
        ['HTTP 404: Not Found', false],
        ['Network timeout', false],
        ['', false],
    ])('isSSLError("%s") -> %s', (message, expected) => {
        expect(isSSLError(mockError(message))).toBe(expected);
    });

    it('analyzeSSLError classifies known certificate errors', () => {
        const leaf = analyzeSSLError(mockError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
        expect(leaf.type).toBe('certificate');
        expect(leaf.retryable).toBe(false);

        const selfSigned = analyzeSSLError(mockError('DEPTH_ZERO_SELF_SIGNED_CERT'));
        expect(selfSigned.type).toBe('certificate');
        expect(selfSigned.retryable).toBe(false);

        const genericSsl = analyzeSSLError(mockError('SSL connection error'));
        expect(genericSsl.type).toBe('certificate');
        expect(genericSsl.retryable).toBe(true);
    });

    it('transformSSLError respects enableAutoTransform', () => {
        const original = mockError('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
        const transformed = transformSSLError(mockError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), {}, false);
        expect(transformed.message).not.toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
        expect((transformed as FetchError & { sslError?: unknown }).sslError).toBeDefined();

        const unchanged = transformSSLError(original, { enableAutoTransform: false }, false);
        expect(unchanged.message).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    });

    it('development and production interceptors transform SSL errors', () => {
        const dev = createDevelopmentSSLErrorInterceptor()(mockError('CERT_UNTRUSTED'));
        expect(dev.message).not.toBe('CERT_UNTRUSTED');
        expect((dev as FetchError & { sslError?: { technicalDetails?: string } }).sslError?.technicalDetails).toBeTruthy();

        const prod = createProductionSSLErrorInterceptor()(mockError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
        expect(prod.message).not.toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
        expect((prod as FetchError & { sslError?: { suggestions?: string[] } }).sslError?.suggestions).toBeUndefined();
    });

    it('custom interceptor runs customTransformer', () => {
        const interceptor = createSSLErrorInterceptor({
            customTransformer: (error) => {
                (error as FetchError & { customMark?: string }).customMark = 'transformed';
                return error;
            },
        });
        const result = interceptor(mockError('SSL_ERROR'));
        expect((result as FetchError & { customMark?: string }).customMark).toBe('transformed');
    });

    it('shouldRetrySSLError and getSSLErrorSuggestions', () => {
        expect(shouldRetrySSLError(mockError('SSL handshake failed'))).toBe(true);
        expect(shouldRetrySSLError(mockError('UNABLE_TO_VERIFY_LEAF_SIGNATURE'))).toBe(false);
        expect(shouldRetrySSLError(mockError('HTTP 404'))).toBe(false);

        const suggestions = getSSLErrorSuggestions(mockError('SELF_SIGNED_CERT_IN_CHAIN'));
        expect(suggestions.length).toBeGreaterThan(0);
    });

    it('handles edge-case messages without throwing', () => {
        for (const message of [undefined, null, '', 'SSL'] as const) {
            const error = mockError(message as unknown as string);
            expect(() => isSSLError(error)).not.toThrow();
            expect(() => analyzeSSLError(error)).not.toThrow();
            expect(() => getSSLErrorSuggestions(error)).not.toThrow();
        }
    });
});

describe('SSL plugin', () => {
    it('registers via client.use()', async () => {
        const client = new FetchClient({ baseURL: 'https://example.com' });
        await client.use(createSSLErrorPlugin({ includeSuggestions: true }));
        expect(client).toBeDefined();
    });
});
