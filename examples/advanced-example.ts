// Advanced fetch-client example showcasing the 3 critical features

import { 
  FetchClient, 
  createFetchClient, 
  createAuthInterceptor, 
  createLoggingInterceptor,
  createTimingInterceptor,
  type RequestConfig,
  type FetchError
} from '../src/index';

async function demonstrateNewFeatures() {
  console.log('🚀 Demonstrating Critical Features: Request Cancellation, Interceptors, Better Retry Logic\n');

  // ===========================================
  // 1. REQUEST CANCELLATION FEATURE
  // ===========================================
  
  console.log('1️⃣ REQUEST CANCELLATION');
  console.log('========================');

  const client = new FetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    debug: true, // Enable debug logging
    retries: 2
  });

  // Example: Cancel a request after 2 seconds
  const controller = new AbortController();
  
  setTimeout(() => {
    console.log('⏹️ Cancelling request after 2 seconds...');
    controller.abort();
  }, 2000);

  try {
    const response = await client.get('/posts/1', {
      signal: controller.signal
    });
    console.log('✅ Request completed:', response.data);
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.log('🛑 Request was cancelled successfully');
    } else {
      console.log('❌ Request failed:', (error as Error).message);
    }
  }

  console.log('\n');

  // ===========================================
  // 2. REQUEST/RESPONSE INTERCEPTOR SYSTEM
  // ===========================================
  
  console.log('2️⃣ INTERCEPTOR SYSTEM');
  console.log('=====================');

  const advancedClient = createFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    debug: true,
    retries: 1
  });

  // Add authentication interceptor
  const removeAuthInterceptor = advancedClient.addRequestInterceptor(
    createAuthInterceptor(() => 'fake-jwt-token-12345')
  );

  // Add logging interceptor
  const removeLoggingInterceptor = advancedClient.addRequestInterceptor(
    createLoggingInterceptor(true)
  );

  // Add custom header interceptor
  const removeCustomHeaderInterceptor = advancedClient.addRequestInterceptor((config) => {
    config.headers = {
      ...config.headers,
      'X-Client-Version': '2.0.0',
      'X-Request-ID': `req-${Date.now()}`,
    };
    return config;
  });

  // Add response interceptor to log response details
  const removeResponseInterceptor = advancedClient.addResponseInterceptor((response) => {
    console.log('📥 Response received:', {
      status: response.status,
      size: JSON.stringify(response.data).length + ' bytes',
    });
    return response;
  });

  // Add error interceptor to enhance error messages
  const removeErrorInterceptor = advancedClient.addErrorInterceptor((error) => {
    console.log('🔥 Enhanced error handling:', {
      message: error.message,
      status: error.status,
      timestamp: new Date().toISOString(),
    });
    // You could transform the error here, add context, etc.
    return error;
  });

  try {
    const response = await advancedClient.get('/posts/1');
    console.log('✅ Intercepted request successful');
  } catch (error) {
    console.log('❌ Intercepted request failed');
  }

  // Clean up interceptors
  removeAuthInterceptor();
  removeLoggingInterceptor();
  removeCustomHeaderInterceptor();
  removeResponseInterceptor();
  removeErrorInterceptor();

  console.log('\n');

  // ===========================================
  // 3. IMPROVED RETRY LOGIC
  // ===========================================
  
  console.log('3️⃣ IMPROVED RETRY LOGIC');
  console.log('=======================');

  const retryClient = createFetchClient({
    baseURL: 'https://httpstat.us', // Service that returns specific HTTP status codes
    debug: true,
    retries: 3,
  });

  // Configure advanced retry settings
  retryClient.updateRetryConfig({
    maxRetries: 3,
    baseDelay: 1000,      // Start with 1 second
    maxDelay: 10000,      // Max 10 seconds
    backoffFactor: 2,     // Double delay each time
    jitter: true,         // Add randomness to prevent thundering herd
    retryCondition: (error: FetchError, attempt: number) => {
      console.log(`🔄 Retry condition check: attempt ${attempt + 1}, status: ${error.status}`);
      
      // Retry on network errors or 5xx server errors, but not 4xx client errors
      if (!error.status) {
        return true; // Network error, retry
      }
      
      if (error.status >= 500 && error.status < 600) {
        return true; // Server error, retry
      }
      
      // Don't retry on client errors (4xx)
      return false;
    }
  });

  // Test with a 500 error (should retry)
  console.log('Testing with 500 error (should retry 3 times with exponential backoff):');
  try {
    await retryClient.get('/500'); // This will return a 500 status
  } catch (error) {
    console.log('❌ All retries exhausted for 500 error');
  }

  console.log('\n');

  // Test with a 404 error (should NOT retry)
  console.log('Testing with 404 error (should NOT retry):');
  try {
    await retryClient.get('/404'); // This will return a 404 status
  } catch (error) {
    console.log('❌ 404 error - no retries attempted (correct behavior)');
  }

  console.log('\n');

  // ===========================================
  // 4. COMBINED FEATURES DEMO
  // ===========================================
  
  console.log('4️⃣ COMBINED FEATURES DEMO');
  console.log('=========================');

  const powerClient = createFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    debug: true,
    retries: 2,
  });

  // Add multiple interceptors
  powerClient.addRequestInterceptor(createAuthInterceptor(() => 'super-secret-token'));
  powerClient.addRequestInterceptor((config) => {
    console.log('🔧 Adding correlation ID to request');
    config.headers = {
      ...config.headers,
      'X-Correlation-ID': `corr-${Math.random().toString(36).substr(2, 9)}`,
    };
    return config;
  });

  // Enhanced retry config
  powerClient.updateRetryConfig({
    maxRetries: 2,
    baseDelay: 500,
    backoffFactor: 1.5,
    jitter: true,
  });

  // Request with cancellation capability
  const powerController = new AbortController();
  
  // Cancel after 10 seconds as a safety net
  setTimeout(() => powerController.abort(), 10000);

  try {
    const response = await powerClient.post('/posts', {
      title: 'Advanced Fetch Client Demo',
      body: 'Demonstrating cancellation, interceptors, and retry logic',
      userId: 1
    }, {
      signal: powerController.signal,
      timeout: 5000, // 5 second timeout
    });
    
    console.log('✅ Combined features demo successful!');
    console.log('📦 Created post:', response.data);
  } catch (error) {
    console.log('❌ Combined features demo failed:', (error as Error).message);
  }

  console.log('\n✨ All demonstrations completed!');
}

// Uncomment to run the demonstration
// demonstrateNewFeatures().catch(console.error);

export { demonstrateNewFeatures };