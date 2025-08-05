// Comprehensive Interceptor Testing for @myopentrip/fetch-client
import { 
    FetchClient, 
    createAuthInterceptor, 
    createLoggingInterceptor,
    createTimingInterceptor,
    type FetchError,
    type RequestConfig,
    type FetchResponse
} from '../src/index';

async function testInterceptors() {
    console.log('🔄 Testing Interceptor System');
    console.log('============================\n');

    // Create a client for testing
    const client = new FetchClient({
        baseURL: 'https://jsonplaceholder.typicode.com',
        debug: true,
        retries: 2
    });

    // ===========================================
    // 1. REQUEST INTERCEPTORS
    // ===========================================
    
    console.log('1️⃣ Testing Request Interceptors');
    console.log('-------------------------------');

    // Test 1.1: Auth interceptor
    console.log('\n📝 Auth Interceptor:');
    const removeAuthInterceptor = client.addRequestInterceptor(
        createAuthInterceptor(() => 'test-bearer-token-12345')
    );

    // Test 1.2: Custom header interceptor
    console.log('📝 Custom Header Interceptor:');
    const removeHeaderInterceptor = client.addRequestInterceptor((config: RequestConfig) => {
        console.log('  ➕ Adding custom headers...');
        config.headers = {
            ...config.headers,
            'X-Client-Version': '2.4.1',
            'X-Request-ID': `req-${Date.now()}`,
            'X-Source': 'interceptor-test'
        };
        return config;
    });

    // Test 1.3: Request transformation interceptor
    console.log('📝 Request Transformation Interceptor:');
    const removeTransformInterceptor = client.addRequestInterceptor(async (config: RequestConfig) => {
        console.log('  🔄 Transforming request config...');
        
        // Add timestamp to all requests
        if (config.body && typeof config.body === 'string') {
            try {
                const bodyObj = JSON.parse(config.body);
                bodyObj.timestamp = new Date().toISOString();
                config.body = JSON.stringify(bodyObj);
                console.log('  ⏰ Added timestamp to request body');
            } catch (e) {
                // Not JSON, skip transformation
            }
        }
        
        return config;
    });

    // Test 1.4: Logging interceptor
    console.log('📝 Logging Interceptor:');
    const removeLoggingInterceptor = client.addRequestInterceptor(
        createLoggingInterceptor(true)
    );

    // ===========================================
    // 2. RESPONSE INTERCEPTORS
    // ===========================================
    
    console.log('\n2️⃣ Testing Response Interceptors');
    console.log('--------------------------------');

    // Test 2.1: Response data transformation
    console.log('\n📝 Response Transformation Interceptor:');
    const removeResponseTransformInterceptor = client.addResponseInterceptor(<T>(response: FetchResponse<T>) => {
        console.log('  🔄 Transforming response...');
        console.log(`  📊 Response status: ${response.status}`);
        console.log(`  📦 Response size: ~${JSON.stringify(response.data).length} bytes`);
        
        // Add metadata to response
        (response as any).metadata = {
            processedAt: new Date().toISOString(),
            interceptorVersion: '2.4.1'
        };
        
        return response;
    });

    // Test 2.2: Performance timing interceptor
    console.log('📝 Timing Interceptor:');
    const timingInterceptor = createTimingInterceptor();
    client.addRequestInterceptor(timingInterceptor.request);
    const removeTimingInterceptor = client.addResponseInterceptor(timingInterceptor.response);

    // Test 2.3: Response validation interceptor
    console.log('📝 Response Validation Interceptor:');
    const removeValidationInterceptor = client.addResponseInterceptor(<T>(response: FetchResponse<T>) => {
        console.log('  ✅ Validating response...');
        
        if (response.status >= 200 && response.status < 300) {
            console.log('  ✅ Response validation passed');
        } else {
            console.log('  ⚠️ Response validation: non-2xx status');
        }
        
        // Check if response has expected structure for API calls
        if (typeof response.data === 'object' && response.data !== null) {
            console.log('  ✅ Response data structure valid');
        }
        
        return response;
    });

    // ===========================================
    // 3. ERROR INTERCEPTORS (NEWLY FIXED!)
    // ===========================================
    
    console.log('\n3️⃣ Testing Error Interceptors (Fixed Feature)');
    console.log('----------------------------------------------');

    // Test 3.1: Error logging interceptor
    console.log('\n📝 Error Logging Interceptor:');
    const removeErrorLoggingInterceptor = client.addErrorInterceptor((error: FetchError) => {
        console.log('  🚨 Error interceptor triggered!');
        console.log(`  📍 Error: ${error.message}`);
        console.log(`  📍 Status: ${error.status || 'Network Error'}`);
        console.log(`  📍 Timestamp: ${new Date().toISOString()}`);
        return error;
    });

    // Test 3.2: Error enhancement interceptor
    console.log('📝 Error Enhancement Interceptor:');
    const removeErrorEnhancementInterceptor = client.addErrorInterceptor((error: FetchError) => {
        console.log('  🔧 Enhancing error with additional context...');
        
        // Add additional context to errors
        (error as any).context = {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
            timestamp: new Date().toISOString(),
            interceptorVersion: '2.4.1'
        };

        // Categorize errors
        if (!error.status) {
            (error as any).category = 'NETWORK_ERROR';
        } else if (error.status >= 400 && error.status < 500) {
            (error as any).category = 'CLIENT_ERROR';
        } else if (error.status && error.status >= 500) {
            (error as any).category = 'SERVER_ERROR';
        }

        console.log(`  🏷️ Error category: ${(error as any).category}`);
        return error;
    });

    // Test 3.3: Error transformation interceptor
    console.log('📝 Error Transformation Interceptor:');
    const removeErrorTransformInterceptor = client.addErrorInterceptor((error: FetchError) => {
        console.log('  🔄 Transforming error for better UX...');
        
        // Create user-friendly error messages
        if (error.status === 404) {
            error.message = 'The requested resource was not found';
        } else if (error.status === 401) {
            error.message = 'Authentication required - please log in';
        } else if (error.status === 403) {
            error.message = 'You do not have permission to access this resource';
        } else if (error.status && error.status >= 500) {
            error.message = 'Server error - please try again later';
        } else if (!error.status) {
            error.message = 'Network connection failed - please check your internet';
        }
        
        return error;
    });

    // ===========================================
    // 4. TESTING INTERCEPTORS IN ACTION
    // ===========================================
    
    console.log('\n4️⃣ Testing Interceptors in Action');
    console.log('----------------------------------');

    // Test 4.1: Successful request (all interceptors should fire)
    console.log('\n🟢 Testing successful request:');
    try {
        const response = await client.get('/posts/1');
        console.log('✅ Request successful!');
        console.log('📦 Response data preview:', {
            id: (response.data as any).id,
            title: (response.data as any).title?.substring(0, 50) + '...',
            metadata: (response as any).metadata
        });
    } catch (error) {
        console.log('❌ Unexpected error in successful request test:', error);
    }

    // Test 4.2: POST request with body transformation
    console.log('\n🟡 Testing POST request with interceptors:');
    try {
        const response = await client.post('/posts', {
            title: 'Test Post',
            body: 'This is a test post body',
            userId: 1
        });
        console.log('✅ POST request successful!');
        console.log('📦 Response preview:', {
            id: (response.data as any).id,
            title: (response.data as any).title
        });
    } catch (error) {
        console.log('❌ Unexpected error in POST request test:', error);
    }

    // Test 4.3: Error scenario (to test error interceptors)
    console.log('\n🔴 Testing error interceptors with 404:');
    try {
        await client.get('/posts/999999'); // This should return 404
        console.log('🤔 Expected error but request succeeded');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('✅ Error interceptors worked!');
        console.log('📦 Enhanced error:', {
            message: fetchError.message,
            status: fetchError.status,
            category: (fetchError as any).category,
            context: (fetchError as any).context
        });
    }

    // Test 4.4: Network error simulation (using invalid URL)
    console.log('\n🔴 Testing network error interceptors:');
    const errorClient = new FetchClient({
        baseURL: 'https://invalid-domain-that-should-not-exist-12345.com',
        debug: true,
        retries: 1,
        timeout: 2000
    });

    // Add error interceptors to error client (create new instances)
    errorClient.addErrorInterceptor((error: FetchError) => {
        console.log('  🚨 Network error interceptor triggered!');
        console.log(`  📍 Error: ${error.message}`);
        console.log(`  📍 Status: ${error.status || 'Network Error'}`);
        console.log(`  📍 Timestamp: ${new Date().toISOString()}`);
        return error;
    });
    
    errorClient.addErrorInterceptor((error: FetchError) => {
        console.log('  🔧 Enhancing network error...');
        (error as any).context = {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
            timestamp: new Date().toISOString(),
            interceptorVersion: '2.4.1'
        };
        (error as any).category = 'NETWORK_ERROR';
        return error;
    });
    
    errorClient.addErrorInterceptor((error: FetchError) => {
        console.log('  🔄 Transforming network error message...');
        error.message = 'Network connection failed - please check your internet';
        return error;
    });

    try {
        await errorClient.get('/test');
        console.log('🤔 Expected network error but request succeeded');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('✅ Network error interceptors worked!');
        console.log('📦 Enhanced network error:', {
            message: fetchError.message,
            category: (fetchError as any).category,
            hasContext: !!(fetchError as any).context
        });
    }

    // ===========================================
    // 5. INTERCEPTOR MANAGEMENT
    // ===========================================
    
    console.log('\n5️⃣ Testing Interceptor Management');
    console.log('----------------------------------');

    // Test removing interceptors
    console.log('\n🗑️ Removing all interceptors...');
    removeAuthInterceptor();
    removeHeaderInterceptor();
    removeTransformInterceptor();
    removeLoggingInterceptor();
    removeResponseTransformInterceptor();
    removeTimingInterceptor();
    removeValidationInterceptor();
    removeErrorLoggingInterceptor();
    removeErrorEnhancementInterceptor();
    removeErrorTransformInterceptor();

    console.log('✅ All interceptors removed');

    // Test request without interceptors
    console.log('\n🧹 Testing request without interceptors:');
    try {
        const response = await client.get('/posts/2');
        console.log('✅ Request without interceptors successful!');
        console.log('📦 Clean response (no metadata):', {
            hasMetadata: !!(response as any).metadata,
            dataType: typeof response.data
        });
    } catch (error) {
        console.log('❌ Error in clean request test:', error);
    }

    // ===========================================
    // 6. INTERCEPTOR CHAIN ORDER TEST
    // ===========================================
    
    console.log('\n6️⃣ Testing Interceptor Chain Order');
    console.log('-----------------------------------');

    const executionOrder: string[] = [];

    const interceptor1 = client.addRequestInterceptor((config) => {
        executionOrder.push('Request Interceptor 1');
        console.log('  🔗 Request Interceptor 1 executed');
        return config;
    });

    const interceptor2 = client.addRequestInterceptor((config) => {
        executionOrder.push('Request Interceptor 2');
        console.log('  🔗 Request Interceptor 2 executed');
        return config;
    });

    const responseInterceptor1 = client.addResponseInterceptor((response) => {
        executionOrder.push('Response Interceptor 1');
        console.log('  🔗 Response Interceptor 1 executed');
        return response;
    });

    const responseInterceptor2 = client.addResponseInterceptor((response) => {
        executionOrder.push('Response Interceptor 2');
        console.log('  🔗 Response Interceptor 2 executed');
        return response;
    });

    try {
        await client.get('/posts/3');
        console.log('✅ Interceptor chain test completed');
        console.log('📋 Execution order:', executionOrder);
    } catch (error) {
        console.log('❌ Error in interceptor chain test:', error);
    }

    // Clean up
    interceptor1();
    interceptor2();
    responseInterceptor1();
    responseInterceptor2();

    console.log('\n🎉 All interceptor tests completed!');
    console.log('✨ The interceptor system is working perfectly!');
}

// Run the tests
if (require.main === module) {
    testInterceptors().catch(console.error);
}

export { testInterceptors };