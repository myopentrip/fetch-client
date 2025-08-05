// Comprehensive Interceptor Examples for @myopentrip/fetch-client
import { 
    FetchClient, 
    createAuthInterceptor, 
    createLoggingInterceptor,
    createTimingInterceptor,
    type FetchError,
    type RequestConfig,
    type FetchResponse
} from '../src/index';

// ===========================================
// REAL-WORLD INTERCEPTOR EXAMPLES
// ===========================================

async function demonstrateInterceptors() {
    console.log('🌟 Real-World Interceptor Examples');
    console.log('==================================\n');

    const client = new FetchClient({
        baseURL: 'https://jsonplaceholder.typicode.com',
        debug: true
    });

    // ===========================================
    // 1. AUTHENTICATION INTERCEPTOR
    // ===========================================
    
    console.log('1️⃣ Authentication Interceptor');
    console.log('-----------------------------');

    // Simulate token storage
    let authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

    const removeAuthInterceptor = client.addRequestInterceptor(
        createAuthInterceptor(async () => {
            // In real app, you might:
            // - Get token from localStorage/sessionStorage
            // - Check if token is expired
            // - Refresh token if needed
            console.log('  🔑 Adding authentication token...');
            return authToken;
        })
    );

    // ===========================================
    // 2. API VERSIONING INTERCEPTOR
    // ===========================================
    
    console.log('\n2️⃣ API Versioning Interceptor');
    console.log('-----------------------------');

    const removeVersionInterceptor = client.addRequestInterceptor((config: RequestConfig) => {
        console.log('  📋 Adding API version headers...');
        config.headers = {
            ...config.headers,
            'Accept': 'application/vnd.api+json',
            'API-Version': 'v2',
            'Client-Version': '2.4.1'
        };
        return config;
    });

    // ===========================================
    // 3. REQUEST ID TRACKING INTERCEPTOR
    // ===========================================
    
    console.log('\n3️⃣ Request Tracking Interceptor');
    console.log('-------------------------------');

    const removeTrackingInterceptor = client.addRequestInterceptor((config: RequestConfig) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`  🏷️ Adding request ID: ${requestId}`);
        
        config.headers = {
            ...config.headers,
            'X-Request-ID': requestId,
            'X-Correlation-ID': requestId
        };
        
        // Store request ID for later use in response/error interceptors
        (config as any).__requestId = requestId;
        return config;
    });

    // ===========================================
    // 4. RESPONSE CACHING INTERCEPTOR
    // ===========================================
    
    console.log('\n4️⃣ Response Caching Interceptor');
    console.log('-------------------------------');

    // Simple in-memory cache
    const responseCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

    const removeCacheInterceptor = client.addResponseInterceptor(<T>(response: FetchResponse<T>) => {
        const url = (response as any).__url || 'unknown';
        const cacheKey = `${url}`;
        
        // Cache GET requests for 5 minutes
        if ((response as any).__method === 'GET') {
            console.log(`  💾 Caching response for: ${cacheKey}`);
            responseCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now(),
                ttl: 5 * 60 * 1000 // 5 minutes
            });
        }
        
        return response;
    });

    // ===========================================
    // 5. ERROR HANDLING & MONITORING
    // ===========================================
    
    console.log('\n5️⃣ Error Monitoring Interceptor');
    console.log('-------------------------------');

    const removeErrorMonitoringInterceptor = client.addErrorInterceptor((error: FetchError) => {
        console.log('  📊 Monitoring error...');
        
        // Simulate sending error to monitoring service
        const errorReport = {
            message: error.message,
            status: error.status,
            timestamp: new Date().toISOString(),
            url: (error as any).url || 'unknown',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
            requestId: (error as any).__requestId
        };

        // In real app, you would send this to your monitoring service
        console.log('  📡 Error reported to monitoring:', {
            status: errorReport.status,
            requestId: errorReport.requestId
        });

        // Add user-friendly error messages
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

    // ===========================================
    // 6. RETRY WITH EXPONENTIAL BACKOFF
    // ===========================================
    
    console.log('\n6️⃣ Advanced Retry Interceptor');
    console.log('-----------------------------');

    const removeRetryInterceptor = client.addErrorInterceptor(async (error: FetchError) => {
        const retryableStatus = [408, 429, 500, 502, 503, 504];
        const shouldRetry = retryableStatus.includes(error.status || 0);
        
        if (shouldRetry) {
            console.log(`  🔄 Retryable error detected: ${error.status}`);
            // The retry logic is handled by the RetryManager, 
            // but we can add context here
            (error as any).retryable = true;
        }
        
        return error;
    });

    // ===========================================
    // 7. PERFORMANCE MONITORING
    // ===========================================
    
    console.log('\n7️⃣ Performance Monitoring');
    console.log('-------------------------');

    const performanceData = new Map<string, number>();

    const removePerformanceInterceptor = client.addRequestInterceptor((config: RequestConfig) => {
        const requestId = (config as any).__requestId || `req_${Date.now()}`;
        performanceData.set(requestId, Date.now());
        console.log(`  ⏱️ Starting performance monitoring for: ${requestId}`);
        return config;
    });

    const removePerformanceResponseInterceptor = client.addResponseInterceptor(<T>(response: FetchResponse<T>) => {
        const requestId = (response as any).__requestId || 'unknown';
        const startTime = performanceData.get(requestId);
        
        if (startTime) {
            const duration = Date.now() - startTime;
            console.log(`  📈 Request ${requestId} took: ${duration}ms`);
            
            // Log slow requests
            if (duration > 1000) {
                console.log(`  ⚠️ Slow request detected: ${duration}ms`);
            }
            
            performanceData.delete(requestId);
        }
        
        return response;
    });

    // ===========================================
    // 8. REQUEST/RESPONSE TRANSFORMATION
    // ===========================================
    
    console.log('\n8️⃣ Data Transformation');
    console.log('----------------------');

    const removeTransformInterceptor = client.addRequestInterceptor((config: RequestConfig) => {
        if (config.body && typeof config.body === 'string') {
            try {
                const data = JSON.parse(config.body);
                
                // Add metadata to all requests
                data._metadata = {
                    clientVersion: '2.4.1',
                    timestamp: new Date().toISOString(),
                    source: 'fetch-client'
                };
                
                config.body = JSON.stringify(data);
                console.log('  🔄 Added metadata to request body');
            } catch (e) {
                // Not JSON, skip transformation
            }
        }
        return config;
    });

    const removeResponseTransformInterceptor = client.addResponseInterceptor(<T>(response: FetchResponse<T>) => {
        // Transform API response format to match client expectations
        if (typeof response.data === 'object' && response.data !== null) {
            const transformed = {
                ...response.data,
                _receivedAt: new Date().toISOString(),
                _status: response.status
            };
            
            response.data = transformed as T;
            console.log('  🔄 Transformed response data structure');
        }
        
        return response;
    });

    // ===========================================
    // 9. TESTING THE INTERCEPTORS
    // ===========================================
    
    console.log('\n9️⃣ Testing All Interceptors Together');
    console.log('------------------------------------');

    try {
        // Test successful request
        console.log('\n🟢 Testing successful request with all interceptors:');
        const response = await client.get('/posts/1');
        console.log('✅ Success! Response received with all interceptors applied');
        
        // Test POST request
        console.log('\n🟡 Testing POST request with transformations:');
        const postResponse = await client.post('/posts', {
            title: 'Test Post',
            body: 'Testing interceptor transformations',
            userId: 1
        });
        console.log('✅ POST request successful with transformations');
        
    } catch (error) {
        console.log('❌ Error in interceptor testing:', error);
    }

    // Test error scenario
    console.log('\n🔴 Testing error handling with interceptors:');
    try {
        await client.get('/posts/nonexistent');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('✅ Error interceptors worked!');
        console.log(`📦 Enhanced error message: "${fetchError.message}"`);
    }

    // ===========================================
    // 10. CLEANUP
    // ===========================================
    
    console.log('\n🧹 Cleaning up interceptors...');
    removeAuthInterceptor();
    removeVersionInterceptor();
    removeTrackingInterceptor();
    removeCacheInterceptor();
    removeErrorMonitoringInterceptor();
    removeRetryInterceptor();
    removePerformanceInterceptor();
    removePerformanceResponseInterceptor();
    removeTransformInterceptor();
    removeResponseTransformInterceptor();
    
    console.log('✅ All interceptors removed');
    console.log('\n🎉 Interceptor examples completed!');
}

// ===========================================
// UTILITY FUNCTIONS FOR INTERCEPTORS
// ===========================================

/**
 * Create a rate limiting interceptor
 */
export function createRateLimitInterceptor(maxRequests: number, windowMs: number) {
    const requestTimes: number[] = [];
    
    return (config: RequestConfig) => {
        const now = Date.now();
        
        // Remove old requests outside the window
        while (requestTimes.length > 0 && requestTimes[0] < now - windowMs) {
            requestTimes.shift();
        }
        
        // Check if we're at the rate limit
        if (requestTimes.length >= maxRequests) {
            throw new Error(`Rate limit exceeded: ${maxRequests} requests per ${windowMs}ms`);
        }
        
        requestTimes.push(now);
        console.log(`  🚦 Rate limit: ${requestTimes.length}/${maxRequests} requests in window`);
        
        return config;
    };
}

/**
 * Create a request size validation interceptor
 */
export function createRequestSizeInterceptor(maxSizeBytes: number) {
    return (config: RequestConfig) => {
        if (config.body) {
            const size = typeof config.body === 'string' 
                ? new Blob([config.body]).size 
                : JSON.stringify(config.body).length;
                
            if (size > maxSizeBytes) {
                throw new Error(`Request size (${size} bytes) exceeds maximum (${maxSizeBytes} bytes)`);
            }
            
            console.log(`  📏 Request size: ${size} bytes (limit: ${maxSizeBytes})`);
        }
        
        return config;
    };
}

/**
 * Create a response validation interceptor
 */
export function createResponseValidationInterceptor<T>(validator: (data: T) => boolean) {
    return (response: FetchResponse<T>) => {
        if (!validator(response.data)) {
            console.log('  ⚠️ Response validation failed');
            throw new Error('Response data validation failed');
        }
        
        console.log('  ✅ Response validation passed');
        return response;
    };
}

// Run the demo
if (require.main === module) {
    demonstrateInterceptors().catch(console.error);
}

export { 
    demonstrateInterceptors
};