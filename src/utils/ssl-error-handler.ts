// SSL/TLS Certificate Error Handling Utilities
import type { FetchError } from '../types';

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
 * Handles both browser and Node.js error structures
 */
export function isSSLError(error: FetchError): boolean {
    // Collect all possible error messages to check
    const messagesToCheck: string[] = [];
    
    // Add main error message
    if (error.message) {
        messagesToCheck.push(error.message);
    }
    
    if (isNodeError(error)) {
        const cause = (error as any).cause;
        if (cause.message) {
            messagesToCheck.push(cause.message);
        }
        if (cause.code) {
            messagesToCheck.push(cause.code);
        }
    }
    
    // Node.js SystemError properties
    const nodeError = error as any;
    if (nodeError.code) {
        messagesToCheck.push(nodeError.code);
    }
    if (nodeError.syscall) {
        messagesToCheck.push(nodeError.syscall);
    }
    
    // SSL/Certificate error patterns (both Node.js and browser)
    const sslErrorPatterns = [
        // OpenSSL error codes (Node.js)
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'CERT_UNTRUSTED',
        'CERT_HAS_EXPIRED',
        'CERT_NOT_YET_VALID',
        'CERT_REVOKED',
        'CERT_CHAIN_TOO_LONG',
        'CERT_AUTHORITY_INVALID',
        'UNABLE_TO_GET_ISSUER_CERT',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
        'CERT_SIGNATURE_FAILURE',
        'HOSTNAME_MISMATCH',
        'INVALID_CA',
        
        // Node.js TLS error codes
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'ERR_TLS_CERT_ALTNAME_FORMAT',
        'ERR_TLS_HANDSHAKE_TIMEOUT',
        'ERR_TLS_INVALID_CONTEXT',
        'ERR_TLS_INVALID_STATE',
        'ERR_TLS_REQUIRED_SERVER_NAME',
        
        // Common SSL/TLS patterns (both environments)
        'certificate verify failed',
        'certificate has expired',
        'certificate is not yet valid',
        'self-signed certificate',
        'ssl certificate problem',
        'ssl handshake',
        'tls handshake',
        'certificate unknown',
        'bad certificate',
        'certificate revoked',
        'certificate_verify_failed',
        'handshake_failure',
        'SSL_ERROR',
        'TLS_ERROR'
    ];
    
    // Check all collected messages against SSL patterns
    return messagesToCheck.some(message => 
        sslErrorPatterns.some(pattern => 
            message.toLowerCase().includes(pattern.toLowerCase())
        )
    );
}

/**
 * Check if an error is a Node.js error
 */
function isNodeError(error: FetchError): boolean {
    return 'cause' in error && (error as any).cause && typeof (error as any).cause === 'object';
}

/**
 * Get the most relevant error message from the error object
 * Handles both browser and Node.js error structures
 */
function extractErrorMessage(error: FetchError): string {
    // Node.js: Check error.cause first (this is where the real SSL error is)
    if (isNodeError(error)) {
        const cause = (error as any).cause;
        if (cause.code) {
            return cause.code;
        }
        if (cause.message) {
            return cause.message;
        }
    }
    
    // Fallback to main error message
    return error.message || 'Unknown SSL error';
}

/**
 * Analyze SSL error and provide detailed information
 */
export function analyzeSSLError(error: FetchError): SSLErrorInfo {
    const originalMessage = error.message || '';
    const relevantMessage = extractErrorMessage(error).toLowerCase();
    const nodeError = error as any;
    
    // Certificate verification errors
    if (relevantMessage.includes('unable_to_verify_leaf_signature') || 
        relevantMessage.includes('certificate verify failed') ||
        nodeError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        return {
            type: 'certificate',
            originalError: originalMessage,
            userFriendlyMessage: 'SSL certificate verification failed. The server\'s certificate could not be verified.',
            technicalDetails: `Certificate verification error: ${relevantMessage}`,
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
    if (relevantMessage.includes('self_signed_cert') || 
        relevantMessage.includes('depth_zero_self_signed_cert') ||
        relevantMessage.includes('self-signed certificate') ||
        nodeError.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        return {
            type: 'certificate',
            originalError: originalMessage,
            userFriendlyMessage: 'The server is using a self-signed certificate which cannot be verified.',
            technicalDetails: `Self-signed certificate error: ${relevantMessage}`,
            suggestions: [
                'For development: You may need to configure certificate acceptance',
                'For production: The server should use a properly signed certificate',
                'Contact the server administrator to install a valid certificate'
            ],
            retryable: false
        };
    }
    
    // Expired certificate
    if (relevantMessage.includes('cert_expired') || 
        relevantMessage.includes('certificate has expired') ||
        relevantMessage.includes('cert_has_expired') ||
        nodeError.code === 'CERT_HAS_EXPIRED') {
        return {
            type: 'certificate',
            originalError: originalMessage,
            userFriendlyMessage: 'The server\'s SSL certificate has expired.',
            technicalDetails: `Certificate expiration error: ${relevantMessage}`,
            suggestions: [
                'The server administrator needs to renew the SSL certificate',
                'This is a server-side issue that cannot be resolved from the client',
                'Contact the server administrator immediately'
            ],
            retryable: false
        };
    }
    
    // Invalid certificate authority
    if (relevantMessage.includes('cert_authority_invalid') || 
        relevantMessage.includes('cert_untrusted') ||
        nodeError.code === 'CERT_UNTRUSTED') {
        return {
            type: 'certificate',
            originalError: originalMessage,
            userFriendlyMessage: 'The server\'s certificate authority is not trusted.',
            technicalDetails: `Certificate authority error: ${relevantMessage}`,
            suggestions: [
                'The certificate was issued by an untrusted authority',
                'Verify the certificate chain includes all intermediate certificates',
                'Contact the server administrator to fix the certificate configuration'
            ],
            retryable: false
        };
    }
    
    // Generic SSL/TLS errors
    if (relevantMessage.includes('ssl') || 
        relevantMessage.includes('tls') || 
        relevantMessage.includes('handshake') ||
        (relevantMessage.includes('fetch failed') && 'cause' in error && (error as any).cause) ||
        nodeError.code?.includes('TLS_')) {
        return {
            type: 'certificate',
            originalError: originalMessage,
            userFriendlyMessage: 'SSL/TLS connection error occurred.',
            technicalDetails: `SSL/TLS error: ${relevantMessage}`,
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
        originalError: originalMessage,
        userFriendlyMessage: 'A secure connection error occurred.',
        technicalDetails: `Connection error: ${relevantMessage}`,
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