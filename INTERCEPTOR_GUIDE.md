# Interceptor System Guide

The interceptor system in `@myopentrip/fetch-client` allows you to modify requests, responses, and handle errors globally across all HTTP calls. This guide demonstrates how to use all three types of interceptors effectively.

## Running Examples and Tests

```bash
# Run comprehensive interceptor tests
pnpm run test:interceptors

# Run real-world interceptor examples
pnpm run example:interceptors

# Or run them directly
npx tsx tests/interceptor-test.ts
npx tsx examples/interceptor-examples.ts
```

## Types of Interceptors

### 1. Request Interceptors
Modify outgoing requests before they are sent.

```typescript
import { FetchClient, createAuthInterceptor } from '@myopentrip/fetch-client';

const client = new FetchClient({ baseURL: 'https://api.example.com' });

// Add authentication
const removeAuth = client.addRequestInterceptor(
    createAuthInterceptor(() => localStorage.getItem('token'))
);

// Add custom headers
const removeHeaders = client.addRequestInterceptor((config) => {
    config.headers = {
        ...config.headers,
        'X-Client-Version': '2.4.1',
        'X-Request-ID': `req-${Date.now()}`
    };
    return config;
});

// Transform request data
const removeTransform = client.addRequestInterceptor((config) => {
    if (config.body && typeof config.body === 'string') {
        const data = JSON.parse(config.body);
        data.timestamp = new Date().toISOString();
        config.body = JSON.stringify(data);
    }
    return config;
});
```

### 2. Response Interceptors
Process responses after they are received.

```typescript
// Add metadata to responses
const removeResponseTransform = client.addResponseInterceptor((response) => {
    (response as any).metadata = {
        processedAt: new Date().toISOString(),
        size: JSON.stringify(response.data).length
    };
    return response;
});

// Validate response structure
const removeValidation = client.addResponseInterceptor((response) => {
    if (response.status >= 200 && response.status < 300) {
        console.log('✅ Response validation passed');
    }
    return response;
});

// Performance monitoring
const timing = createTimingInterceptor();
client.addRequestInterceptor(timing.request);
client.addResponseInterceptor(timing.response);
```

### 3. Error Interceptors ⚡ (Fixed Feature!)
Handle and transform errors consistently.

```typescript
// Log errors for monitoring
const removeErrorLogging = client.addErrorInterceptor((error) => {
    console.error('API Error:', {
        message: error.message,
        status: error.status,
        timestamp: new Date().toISOString()
    });
    
    // Send to monitoring service
    // monitoringService.reportError(error);
    
    return error;
});

// Enhance errors with context
const removeErrorEnhancement = client.addErrorInterceptor((error) => {
    (error as any).context = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };
    
    // Categorize errors
    if (!error.status) {
        (error as any).category = 'NETWORK_ERROR';
    } else if (error.status >= 400 && error.status < 500) {
        (error as any).category = 'CLIENT_ERROR';
    } else if (error.status >= 500) {
        (error as any).category = 'SERVER_ERROR';
    }
    
    return error;
});

// Transform error messages for better UX
const removeErrorTransform = client.addErrorInterceptor((error) => {
    switch (error.status) {
        case 401:
            error.message = 'Please log in to continue';
            break;
        case 403:
            error.message = 'You don\'t have permission to access this resource';
            break;
        case 404:
            error.message = 'The requested resource was not found';
            break;
        case 429:
            error.message = 'Too many requests. Please try again later';
            break;
        case 500:
            error.message = 'Server error. Our team has been notified';
            break;
        default:
            if (!error.status) {
                error.message = 'Network error. Please check your connection';
            }
    }
    return error;
});
```

## Built-in Interceptor Helpers

```typescript
import { 
    createAuthInterceptor, 
    createLoggingInterceptor,
    createTimingInterceptor 
} from '@myopentrip/fetch-client';

// Automatic authentication
client.addRequestInterceptor(
    createAuthInterceptor(() => getAuthToken())
);

// Request/response logging
client.addRequestInterceptor(createLoggingInterceptor(true));

// Performance timing
const timing = createTimingInterceptor();
client.addRequestInterceptor(timing.request);
client.addResponseInterceptor(timing.response);
```

## Real-World Use Cases

### Authentication with Token Refresh
```typescript
const client = new FetchClient({
    baseURL: 'https://api.example.com',
    auth: {
        loginUrl: '/auth/login',
        tokenRefreshUrl: '/auth/refresh',
        autoRefresh: true
    }
});

// The auth system automatically handles token refresh
// and adds interceptors for you!
```

### API Monitoring and Analytics
```typescript
// Track API performance
client.addRequestInterceptor((config) => {
    (config as any).__startTime = Date.now();
    return config;
});

client.addResponseInterceptor((response) => {
    const duration = Date.now() - (response as any).__startTime;
    
    // Send metrics to analytics
    analytics.track('api_request', {
        endpoint: response.url,
        duration,
        status: response.status
    });
    
    return response;
});

// Monitor errors
client.addErrorInterceptor((error) => {
    analytics.track('api_error', {
        message: error.message,
        status: error.status,
        endpoint: error.url
    });
    
    return error;
});
```

### Request Rate Limiting
```typescript
const requestTimes: number[] = [];
const MAX_REQUESTS = 10;
const WINDOW_MS = 60000; // 1 minute

client.addRequestInterceptor((config) => {
    const now = Date.now();
    
    // Remove old requests
    while (requestTimes.length > 0 && requestTimes[0] < now - WINDOW_MS) {
        requestTimes.shift();
    }
    
    // Check rate limit
    if (requestTimes.length >= MAX_REQUESTS) {
        throw new Error('Rate limit exceeded');
    }
    
    requestTimes.push(now);
    return config;
});
```

### Response Caching
```typescript
const cache = new Map();

client.addResponseInterceptor((response) => {
    if (response.method === 'GET' && response.status === 200) {
        const cacheKey = response.url;
        cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
            ttl: 5 * 60 * 1000 // 5 minutes
        });
    }
    return response;
});
```

## Interceptor Management

```typescript
// Remove specific interceptors
const removeAuth = client.addRequestInterceptor(authInterceptor);
removeAuth(); // Remove this specific interceptor

// Or store references and remove later
const interceptors = {
    auth: client.addRequestInterceptor(authInterceptor),
    logging: client.addRequestInterceptor(loggingInterceptor),
    timing: client.addResponseInterceptor(timingInterceptor)
};

// Clean up all interceptors
Object.values(interceptors).forEach(remove => remove());
```

## Execution Order

Interceptors execute in the order they were added:

1. **Request Interceptors**: First added → Last added
2. **HTTP Request Execution**
3. **Response Interceptors**: First added → Last added
4. **Error Interceptors** (if error occurs): First added → Last added

```typescript
client.addRequestInterceptor(config => {
    console.log('Request Interceptor 1');
    return config;
});

client.addRequestInterceptor(config => {
    console.log('Request Interceptor 2');
    return config;
});

client.addResponseInterceptor(response => {
    console.log('Response Interceptor 1');
    return response;
});

client.addResponseInterceptor(response => {
    console.log('Response Interceptor 2');
    return response;
});

// Output order:
// Request Interceptor 1
// Request Interceptor 2
// [HTTP Request]
// Response Interceptor 1
// Response Interceptor 2
```

## Error Handling in Interceptors

```typescript
// Interceptor errors will stop the request
client.addRequestInterceptor((config) => {
    if (!isValidRequest(config)) {
        throw new Error('Invalid request configuration');
    }
    return config;
});

// Handle errors gracefully in error interceptors
client.addErrorInterceptor((error) => {
    try {
        // Try to enhance error
        enhanceError(error);
    } catch (enhanceError) {
        // Don't let error enhancement break error handling
        console.warn('Failed to enhance error:', enhanceError);
    }
    return error;
});
```

## Testing Interceptors

See `tests/interceptor-test.ts` for comprehensive test examples:

- ✅ Request interceptor functionality
- ✅ Response interceptor functionality  
- ✅ Error interceptor functionality (newly fixed!)
- ✅ Interceptor chaining and execution order
- ✅ Interceptor management (add/remove)
- ✅ Integration with retry logic
- ✅ Network error handling

## Best Practices

1. **Keep interceptors focused**: Each interceptor should have a single responsibility
2. **Handle errors gracefully**: Don't let interceptor errors break your app
3. **Clean up interceptors**: Remove interceptors when components unmount
4. **Use built-in helpers**: Leverage `createAuthInterceptor`, `createLoggingInterceptor`, etc.
5. **Test interceptor integration**: Use the provided test files as examples
6. **Monitor performance**: Be aware that many interceptors can impact performance

## Fixed Issues ✨

- **Error interceptors now work!** Previously, error interceptors were defined but never called. They now integrate properly with the retry system.
- **Better TypeScript support** for response interceptors
- **Improved cleanup** for auth interceptors to prevent memory leaks

The interceptor system is now fully functional and production-ready! 🚀