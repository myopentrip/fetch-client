// SSL/TLS Certificate Error Handling Utilities
import type { FetchError, FetchClientConfig } from '../types';

/**
 * SSL/Certificate error types that can occur during HTTPS requests
 */
export interface SSLErrorInfo {
    type: 'certificate' | 'network' | 'timeout' | 'unknown';
    originalError: string;
    userFriendlyMessage: string;
    technicalDetails: string;
    suggestions: string[];
    retryable: boolean;
}

/**
 * SSL error handling configuration
 */
export interface SSLErrorConfig {
    /** Whether to automatically transform SSL errors into user-friendly messages */
    enableAutoTransform?: boolean;
    /** Whether to include technical details in development mode */
    includeTechnicalDetails?: boolean;
    /** Custom error transformer function */
    customTransformer?: (error: FetchError) => FetchError;
    /** Whether to suggest common solutions */
    includeSuggestions?: boolean;
}

/**
 * Default SSL error configuration
 */
export const defaultSSLErrorConfig: Required<Omit<SSLErrorConfig, 'customTransformer'>> & { customTransformer?: (error: FetchError) => FetchError } = {
    enableAutoTransform: true,
    includeTechnicalDetails: false,
    includeSuggestions: true
};

/**
 * Detect if an error is SSL/certificate related
 */
export function isSSLError(error: FetchError): boolean {
    if (!error.message) return false;
    
    const sslErrorPatterns = [
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'CERT_UNTRUSTED',
        'CERT_INVALID',
        'CERT_EXPIRED',
        'CERT_NOT_YET_VALID',
        'CERT_REVOKED',
        'CERT_CHAIN_TOO_LONG',
        'CERT_AUTHORITY_INVALID',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SSL_ERROR',
        'TLS_ERROR',
        'certificate verify failed',
        'ssl certificate problem',
        'certificate has expired',
        'certificate is not yet valid'
    ];
    
    return sslErrorPatterns.some(pattern => 
        error.message.toLowerCase().includes(pattern.toLowerCase())
    );
}

/**
 * Analyze SSL error and provide detailed information
 */
export function analyzeSSLError(error: FetchError): SSLErrorInfo {
    const message = error.message?.toLowerCase() || '';
    
    // Certificate verification errors
    if (message.includes('unable_to_verify_leaf_signature') || 
        message.includes('certificate verify failed')) {
        return {
            type: 'certificate',
            originalError: error.message,
            userFriendlyMessage: 'SSL certificate verification failed. The server\'s certificate could not be verified.',
            technicalDetails: `Certificate verification error: ${error.message}`,
            suggestions: [
                'Check if the server certificate is valid and properly configured',
                'Verify the certificate chain is complete',
                'For development: Consider using a certificate ignore option (not recommended for production)',
                'Contact the server administrator if this persists'
            ],
            retryable: false
        };
    }
    
    // Self-signed certificate errors
    if (message.includes('self_signed_cert') || message.includes('depth_zero_self_signed_cert')) {
        return {
            type: 'certificate',
            originalError: error.message,
            userFriendlyMessage: 'The server is using a self-signed certificate which cannot be verified.',
            technicalDetails: `Self-signed certificate error: ${error.message}`,
            suggestions: [
                'For development: You may need to configure certificate acceptance',
                'For production: The server should use a properly signed certificate',
                'Contact the server administrator to install a valid certificate'
            ],
            retryable: false
        };
    }
    
    // Expired certificate
    if (message.includes('cert_expired') || message.includes('certificate has expired')) {
        return {
            type: 'certificate',
            originalError: error.message,
            userFriendlyMessage: 'The server\'s SSL certificate has expired.',
            technicalDetails: `Certificate expiration error: ${error.message}`,
            suggestions: [
                'The server administrator needs to renew the SSL certificate',
                'This is a server-side issue that cannot be resolved from the client',
                'Contact the server administrator immediately'
            ],
            retryable: false
        };
    }
    
    // Invalid certificate authority
    if (message.includes('cert_authority_invalid') || message.includes('cert_untrusted')) {
        return {
            type: 'certificate',
            originalError: error.message,
            userFriendlyMessage: 'The server\'s certificate authority is not trusted.',
            technicalDetails: `Certificate authority error: ${error.message}`,
            suggestions: [
                'The certificate was issued by an untrusted authority',
                'Verify the certificate chain includes all intermediate certificates',
                'Contact the server administrator to fix the certificate configuration'
            ],
            retryable: false
        };
    }
    
    // Generic SSL/TLS errors
    if (message.includes('ssl') || message.includes('tls')) {
        return {
            type: 'certificate',
            originalError: error.message,
            userFriendlyMessage: 'SSL/TLS connection error occurred.',
            technicalDetails: `SSL/TLS error: ${error.message}`,
            suggestions: [
                'Check your internet connection',
                'Verify the server supports the required SSL/TLS version',
                'Try again in a few moments',
                'Contact support if the problem persists'
            ],
            retryable: true
        };
    }
    
    // Fallback for unknown SSL errors
    return {
        type: 'unknown',
        originalError: error.message,
        userFriendlyMessage: 'A secure connection error occurred.',
        technicalDetails: `Connection error: ${error.message}`,
        suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Contact support if the problem persists'
        ],
        retryable: true
    };
}

/**
 * Transform SSL error into user-friendly format
 */
export function transformSSLError(
    error: FetchError, 
    config: SSLErrorConfig = {},
    isDevelopment: boolean = false
): FetchError {
    const finalConfig = { ...defaultSSLErrorConfig, ...config };
    
    if (!finalConfig.enableAutoTransform || !isSSLError(error)) {
        return error;
    }
    
    const sslInfo = analyzeSSLError(error);
    
    // Apply custom transformer first if provided
    let transformedError = finalConfig.customTransformer ? finalConfig.customTransformer(error) : error;
    
    // Apply built-in transformation
    transformedError.message = sslInfo.userFriendlyMessage;
    
    // Add SSL error information
    (transformedError as any).sslError = {
        type: sslInfo.type,
        retryable: sslInfo.retryable,
        suggestions: finalConfig.includeSuggestions ? sslInfo.suggestions : undefined,
        technicalDetails: (finalConfig.includeTechnicalDetails || isDevelopment) 
            ? sslInfo.technicalDetails 
            : undefined,
        originalError: isDevelopment ? sslInfo.originalError : undefined
    };
    
    return transformedError;
}

/**
 * Create an SSL error interceptor
 */
export function createSSLErrorInterceptor(
    config: SSLErrorConfig = {},
    isDevelopment: boolean = false
) {
    return (error: FetchError): FetchError => {
        return transformSSLError(error, config, isDevelopment);
    };
}

/**
 * Create a development-friendly SSL error interceptor that shows all details
 */
export function createDevelopmentSSLErrorInterceptor(): (error: FetchError) => FetchError {
    return createSSLErrorInterceptor({
        enableAutoTransform: true,
        includeTechnicalDetails: true,
        includeSuggestions: true
    }, true);
}

/**
 * Create a production SSL error interceptor with minimal information
 */
export function createProductionSSLErrorInterceptor(
    customTransformer?: (error: FetchError) => FetchError
): (error: FetchError) => FetchError {
    return createSSLErrorInterceptor({
        enableAutoTransform: true,
        includeTechnicalDetails: false,
        includeSuggestions: false,
        customTransformer
    }, false);
}

/**
 * Utility to check if an error should be retried based on SSL error analysis
 */
export function shouldRetrySSLError(error: FetchError): boolean {
    if (!isSSLError(error)) return false;
    
    const sslInfo = analyzeSSLError(error);
    return sslInfo.retryable;
}

/**
 * Get user-friendly suggestions for resolving SSL errors
 */
export function getSSLErrorSuggestions(error: FetchError): string[] {
    if (!isSSLError(error)) return [];
    
    const sslInfo = analyzeSSLError(error);
    return sslInfo.suggestions;
}