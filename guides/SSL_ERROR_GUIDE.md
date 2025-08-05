# SSL/Certificate Error Handling Guide

The `@myopentrip/fetch-client` package provides intelligent SSL/TLS certificate error handling to improve user experience and debugging capabilities.

## 🔒 **HYBRID APPROACH**

We provide **both automatic handling AND full customization**:

1. **🚀 Automatic by default** - SSL errors are transformed into user-friendly messages
2. **🔧 Fully customizable** - Users can override, extend, or disable the behavior
3. **🎯 Environment-aware** - Different handling for development vs production
4. **💡 Intelligent suggestions** - Provides actionable solutions for SSL issues

## 🎯 **Quick Start**

```bash
# Test SSL error handling
pnpm run test:ssl

# See real-world examples
pnpm run example:ssl
```

## 📚 **Usage Examples**

### Default Behavior (Recommended)
```typescript
import { FetchClient } from '@myopentrip/fetch-client';

// SSL error handling is ENABLED BY DEFAULT
const client = new FetchClient({
    baseURL: 'https://api.example.com'
});

try {
    await client.get('/secure-endpoint');
} catch (error) {
    // SSL errors are automatically transformed:
    // Before: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" 
    // After:  "SSL certificate verification failed. The server's certificate could not be verified."
    
    console.log(error.message); // User-friendly message
    console.log(error.sslError.suggestions); // Actionable solutions
}
```

### Development Mode (Verbose Details)
```typescript
const client = new FetchClient({
    baseURL: 'https://localhost:8443',
    debug: true, // Automatically includes technical details
    sslErrorHandling: {
        enabled: true,
        includeTechnicalDetails: true,
        includeSuggestions: true
    }
});

try {
    await client.get('/api/data');
} catch (error) {
    console.log('User message:', error.message);
    console.log('Technical details:', error.sslError.technicalDetails);
    console.log('Original error:', error.sslError.originalError);
    console.log('Suggestions:', error.sslError.suggestions);
}
```

### Production Mode (Minimal Details)
```typescript
const client = new FetchClient({
    baseURL: 'https://api.production.com',
    sslErrorHandling: {
        enabled: true,
        includeTechnicalDetails: false, // Hide technical details
        includeSuggestions: false,      // Hide suggestions
        customTransformer: (error) => {
            // Send to monitoring service
            monitoringService.reportSSLError(error);
            return error;
        }
    }
});
```

### Custom SSL Error Handling
```typescript
import { createSSLErrorInterceptor, isSSLError } from '@myopentrip/fetch-client';

const client = new FetchClient({
    baseURL: 'https://api.example.com',
    sslErrorHandling: { enabled: false } // Disable automatic handling
});

// Add custom SSL error interceptor
client.addErrorInterceptor((error) => {
    if (isSSLError(error)) {
        // Your custom logic here
        error.message = `[MyApp] Security Error: ${error.message}`;
        
        // Add custom context
        error.customData = {
            timestamp: Date.now(),
            userAction: 'contact_support',
            errorCode: 'SSL_001'
        };
    }
    return error;
});
```

### Disable SSL Error Handling
```typescript
const client = new FetchClient({
    baseURL: 'https://api.example.com',
    sslErrorHandling: {
        enabled: false // Raw SSL errors, no transformation
    }
});

// You'll get original SSL errors like "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
```

## 🔍 **SSL Error Types Detected**

The system automatically detects and handles these SSL/certificate errors:

- `UNABLE_TO_VERIFY_LEAF_SIGNATURE` - Certificate verification failed
- `CERT_UNTRUSTED` - Untrusted certificate
- `CERT_INVALID` - Invalid certificate
- `CERT_EXPIRED` - Expired certificate
- `CERT_NOT_YET_VALID` - Certificate not yet valid
- `SELF_SIGNED_CERT_IN_CHAIN` - Self-signed certificate
- `DEPTH_ZERO_SELF_SIGNED_CERT` - Self-signed root certificate
- `SSL_ERROR_*` - Various SSL connection errors
- `TLS_ERROR_*` - TLS protocol errors

## 🛠️ **Advanced Usage**

### Manual SSL Error Analysis
```typescript
import { 
    isSSLError, 
    analyzeSSLError, 
    shouldRetrySSLError,
    getSSLErrorSuggestions 
} from '@myopentrip/fetch-client';

try {
    await client.get('/api/secure');
} catch (error) {
    if (isSSLError(error)) {
        const analysis = analyzeSSLError(error);
        
        console.log('Error Type:', analysis.type);
        console.log('User Message:', analysis.userFriendlyMessage);
        console.log('Retryable:', analysis.retryable);
        console.log('Suggestions:', analysis.suggestions);
        
        // Check if should retry
        if (shouldRetrySSLError(error)) {
            // Implement retry logic
        }
    }
}
```

### Enterprise Error Handling
```typescript
const enterpriseClient = new FetchClient({
    baseURL: 'https://enterprise-api.company.com',
    sslErrorHandling: {
        enabled: true,
        customTransformer: (error) => {
            if (isSSLError(error)) {
                // Log to enterprise monitoring
                enterpriseMonitoring.logSecurityEvent({
                    type: 'SSL_ERROR',
                    message: error.message,
                    timestamp: Date.now(),
                    severity: 'HIGH'
                });
                
                // Transform for enterprise users
                error.message = 'Security connection error. Please contact IT support.';
                error.supportTicket = `SSL-${Date.now()}`;
            }
            return error;
        }
    }
});
```

## 📋 **Configuration Options**

```typescript
interface SSLErrorHandlingConfig {
    /** Enable automatic SSL error transformation (default: true) */
    enabled?: boolean;
    
    /** Include technical details (default: false in production, true in debug) */
    includeTechnicalDetails?: boolean;
    
    /** Include actionable suggestions (default: true) */
    includeSuggestions?: boolean;
    
    /** Custom error transformer function */
    customTransformer?: (error: FetchError) => FetchError;
}
```

## 🎭 **Error Information Structure**

When SSL errors are processed, they include this additional information:

```typescript
error.sslError = {
    type: 'certificate' | 'network' | 'timeout' | 'unknown',
    retryable: boolean,
    suggestions?: string[],           // Only if includeSuggestions: true
    technicalDetails?: string,       // Only if includeTechnicalDetails: true
    originalError?: string           // Only in development mode
}
```

## 🚦 **Best Practices**

### ✅ **DO**
- Keep default SSL error handling enabled for better UX
- Use development mode during development for detailed debugging
- Use production mode in production to avoid exposing technical details
- Send SSL errors to monitoring services for enterprise applications
- Provide clear user guidance when SSL errors occur

### ❌ **DON'T**
- Don't expose raw SSL errors to end users
- Don't ignore SSL errors in production
- Don't include technical details in user-facing messages
- Don't retry non-retryable SSL errors (like expired certificates)

## 🔄 **Migration from Raw SSL Errors**

If you were previously handling raw SSL errors:

**Before:**
```typescript
try {
    await client.get('/api');
} catch (error) {
    if (error.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
        // Manual handling
        showError('Certificate error occurred');
    }
}
```

**After:**
```typescript
try {
    await client.get('/api');
} catch (error) {
    // SSL errors are automatically user-friendly!
    showError(error.message); // "SSL certificate verification failed..."
    
    // Access additional information if needed
    if (error.sslError) {
        logTechnicalDetails(error.sslError.technicalDetails);
        showSuggestions(error.sslError.suggestions);
    }
}
```

## 🧪 **Testing SSL Error Scenarios**

The package includes comprehensive tests for various SSL scenarios:

```bash
# Run SSL error tests
pnpm run test:ssl

# Test with real SSL error sites
pnpm run example:ssl
```

## 🎯 **Why This Approach?**

1. **Better User Experience** - Users see helpful messages instead of cryptic SSL codes
2. **Developer Friendly** - Detailed information available when needed
3. **Production Ready** - Configurable security for different environments
4. **Maintainable** - Centralized SSL error handling logic
5. **Flexible** - Can be customized or disabled entirely

## 📈 **Real-World Impact**

- ✅ **Before**: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
- ✅ **After**: "SSL certificate verification failed. The server's certificate could not be verified."

- ✅ **Before**: "DEPTH_ZERO_SELF_SIGNED_CERT" 
- ✅ **After**: "The server is using a self-signed certificate which cannot be verified."

Users get actionable information instead of technical jargon! 🎉

---

The SSL error handling system provides the **best of both worlds**: automatic user-friendly error handling with complete customization flexibility. Perfect for both beginners and enterprise applications! 🚀