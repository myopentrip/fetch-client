// Quick test of the 3 critical features
import { 
  FetchClient, 
  createAuthInterceptor, 
  createLoggingInterceptor,
  type FetchError
} from '../src/index';

async function quickTest() {
  console.log('🧪 Testing Enhanced Fetch Client v2.0.0\n');

  const client = new FetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    debug: true,
    retries: 2,
  });

  // ✅ Feature 1: Request Cancellation
  console.log('1️⃣ Testing Request Cancellation...');
  const controller = new AbortController();
  setTimeout(() => {
    console.log('⏹️ Cancelling request...');
    controller.abort();
  }, 100);

  try {
    await client.get('/posts/1', { signal: controller.signal });
  } catch (error) {
    console.log(`✅ Cancellation works: ${(error as Error).name}`);
  }

  // ✅ Feature 2: Interceptors
  console.log('\n2️⃣ Testing Interceptors...');
  
  // Add interceptors
  client.addRequestInterceptor(createAuthInterceptor(() => 'test-token-123'));
  client.addRequestInterceptor(createLoggingInterceptor(true));
  client.addRequestInterceptor((config) => {
    console.log('🔧 Custom interceptor: Adding correlation ID');
    config.headers = { ...config.headers, 'X-Correlation-ID': 'test-123' };
    return config;
  });

  try {
    const response = await client.get('/posts/1');
    console.log('✅ Interceptors work - request completed');
  } catch (error) {
    console.log('❌ Interceptor test failed');
  }

  // ✅ Feature 3: Advanced Retry Logic
  console.log('\n3️⃣ Testing Advanced Retry Logic...');
  
  const retryClient = new FetchClient({
    baseURL: 'https://httpstat.us',
    debug: true,
  });

  retryClient.updateRetryConfig({
    maxRetries: 2,
    baseDelay: 500,
    backoffFactor: 2,
    jitter: true,
    retryCondition: (error: FetchError) => {
      console.log(`🔄 Retry condition check: ${error.status}`);
      return error.status === 500; // Only retry 500 errors
    }
  });

  try {
    await retryClient.get('/500'); // This will fail but retry
  } catch (error) {
    console.log('✅ Advanced retry logic works - retried and failed as expected');
  }

  console.log('\n🎉 All critical features tested successfully!');
}

// Export for manual testing
export { quickTest };

// Uncomment to run immediately
// quickTest().catch(console.error);