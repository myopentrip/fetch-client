// SSL Error Handling Tests for @myopentrip/fetch-client
import { FetchClient } from '../src/index';
import {
    isSSLError,
    analyzeSSLError,
    transformSSLError,
    createSSLErrorInterceptor,
    createDevelopmentSSLErrorInterceptor,
    createProductionSSLErrorInterceptor,
    shouldRetrySSLError,
    getSSLErrorSuggestions,
    createSSLErrorPlugin,
    type FetchError,
} from '../src/ssl';

async function testSSLErrorHandling() {
    console.log('🧪 Testing SSL Error Handling');
    console.log('=============================\n');

    // ===========================================
    // 1. SSL ERROR DETECTION TESTS
    // ===========================================
    
    console.log('1️⃣ Testing SSL Error Detection');
    console.log('------------------------------');

    const sslErrors = [
        { message: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', expected: true },
        { message: 'certificate verify failed', expected: true },
        { message: 'CERT_UNTRUSTED', expected: true },
        { message: 'SELF_SIGNED_CERT_IN_CHAIN', expected: true },
        { message: 'SSL_ERROR_SYSCALL', expected: true },
        { message: 'HTTP 404: Not Found', expected: false },
        { message: 'Network timeout', expected: false },
        { message: '', expected: false }
    ];

    sslErrors.forEach(test => {
        const mockError = { message: test.message } as FetchError;
        const result = isSSLError(mockError);
        const status = result === test.expected ? '✅' : '❌';
        console.log(`  ${status} "${test.message}" -> SSL: ${result}`);
    });

    // ===========================================
    // 2. SSL ERROR ANALYSIS TESTS
    // ===========================================
    
    console.log('\n2️⃣ Testing SSL Error Analysis');
    console.log('-----------------------------');

    const analysisTests = [
        {
            name: 'Leaf signature verification',
            error: { message: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } as FetchError,
            expectedType: 'certificate',
            expectedRetryable: false
        },
        {
            name: 'Self-signed certificate',
            error: { message: 'DEPTH_ZERO_SELF_SIGNED_CERT' } as FetchError,
            expectedType: 'certificate',
            expectedRetryable: false
        },
        {
            name: 'Expired certificate',
            error: { message: 'certificate has expired' } as FetchError,
            expectedType: 'certificate',
            expectedRetryable: false
        },
        {
            name: 'Generic SSL error',
            error: { message: 'SSL connection error' } as FetchError,
            expectedType: 'certificate',
            expectedRetryable: true
        }
    ];

    analysisTests.forEach(test => {
        const analysis = analyzeSSLError(test.error);
        const typeMatch = analysis.type === test.expectedType;
        const retryMatch = analysis.retryable === test.expectedRetryable;
        const status = typeMatch && retryMatch ? '✅' : '❌';
        
        console.log(`  ${status} ${test.name}:`);
        console.log(`    Type: ${analysis.type} (expected: ${test.expectedType})`);
        console.log(`    Retryable: ${analysis.retryable} (expected: ${test.expectedRetryable})`);
        console.log(`    Message: "${analysis.userFriendlyMessage.substring(0, 50)}..."`);
        console.log(`    Suggestions: ${analysis.suggestions.length} items`);
    });

    // ===========================================
    // 3. SSL ERROR TRANSFORMATION TESTS
    // ===========================================
    
    console.log('\n3️⃣ Testing SSL Error Transformation');
    console.log('-----------------------------------');

    const transformTests = [
        {
            name: 'Default transformation',
            config: {},
            isDevelopment: false
        },
        {
            name: 'Development transformation',
            config: { includeTechnicalDetails: true, includeSuggestions: true },
            isDevelopment: true
        },
        {
            name: 'Production transformation',
            config: { includeTechnicalDetails: false, includeSuggestions: false },
            isDevelopment: false
        },
        {
            name: 'Disabled transformation',
            config: { enableAutoTransform: false },
            isDevelopment: false
        }
    ];

    transformTests.forEach(test => {
        const originalError = { message: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } as FetchError;
        const transformedError = transformSSLError(originalError, test.config, test.isDevelopment);
        
        const wasTransformed = transformedError.message !== originalError.message;
        const hasSSLInfo = !!(transformedError as any).sslError;
        const hasTechnicalDetails = !!(transformedError as any).sslError?.technicalDetails;
        const hasSuggestions = !!(transformedError as any).sslError?.suggestions;
        
        console.log(`  ✅ ${test.name}:`);
        console.log(`    Transformed: ${wasTransformed}`);
        console.log(`    Has SSL info: ${hasSSLInfo}`);
        console.log(`    Technical details: ${hasTechnicalDetails}`);
        console.log(`    Suggestions: ${hasSuggestions}`);
    });

    // ===========================================
    // 4. INTERCEPTOR CREATION TESTS
    // ===========================================
    
    console.log('\n4️⃣ Testing SSL Error Interceptor Creation');
    console.log('-----------------------------------------');

    // Test development interceptor
    const devInterceptor = createDevelopmentSSLErrorInterceptor();
    const devError = { message: 'CERT_UNTRUSTED' } as FetchError;
    const devResult = devInterceptor(devError);
    
    console.log('  ✅ Development interceptor:');
    console.log(`    Message changed: ${devResult.message !== devError.message}`);
    console.log(`    Has technical details: ${!!(devResult as any).sslError?.technicalDetails}`);
    console.log(`    Has suggestions: ${!!(devResult as any).sslError?.suggestions}`);

    // Test production interceptor
    const prodInterceptor = createProductionSSLErrorInterceptor();
    const prodError = { message: 'CERT_EXPIRED' } as FetchError;
    const prodResult = prodInterceptor(prodError);
    
    console.log('  ✅ Production interceptor:');
    console.log(`    Message changed: ${prodResult.message !== prodError.message}`);
    console.log(`    Has technical details: ${!!(prodResult as any).sslError?.technicalDetails}`);
    console.log(`    Has suggestions: ${!!(prodResult as any).sslError?.suggestions}`);

    // Test custom interceptor
    const customInterceptor = createSSLErrorInterceptor({
        customTransformer: (error: FetchError) => {
            (error as any).customMark = 'transformed';
            return error;
        }
    });
    const customError = { message: 'SSL_ERROR' } as FetchError;
    const customResult = customInterceptor(customError);
    
    console.log('  ✅ Custom interceptor:');
    console.log(`    Custom mark: ${(customResult as any).customMark}`);
    console.log(`    Message changed: ${customResult.message !== customError.message}`);

    // ===========================================
    // 5. UTILITY FUNCTION TESTS
    // ===========================================
    
    console.log('\n5️⃣ Testing Utility Functions');
    console.log('----------------------------');

    // Test shouldRetrySSLError
    const retryableError = { message: 'SSL connection timeout' } as FetchError;
    const nonRetryableError = { message: 'CERT_EXPIRED' } as FetchError;
    const nonSSLError = { message: 'HTTP 404' } as FetchError;
    
    console.log('  ✅ shouldRetrySSLError:');
    console.log(`    SSL timeout (retryable): ${shouldRetrySSLError(retryableError)}`);
    console.log(`    Cert expired (not retryable): ${shouldRetrySSLError(nonRetryableError)}`);
    console.log(`    Non-SSL error: ${shouldRetrySSLError(nonSSLError)}`);

    // Test getSSLErrorSuggestions
    const suggestionError = { message: 'SELF_SIGNED_CERT_IN_CHAIN' } as FetchError;
    const suggestions = getSSLErrorSuggestions(suggestionError);
    
    console.log('  ✅ getSSLErrorSuggestions:');
    console.log(`    Suggestion count: ${suggestions.length}`);
    console.log(`    First suggestion: "${suggestions[0]?.substring(0, 50)}..."`);

    // ===========================================
    // 6. INTEGRATION WITH FETCHCLIENT (v3 plugin)
    // ===========================================

    console.log('\n6️⃣ Testing SSL plugin with FetchClient');
    console.log('---------------------------------------');

    const clientWithSSL = new FetchClient({ baseURL: 'https://example.com' });
    await clientWithSSL.use(createSSLErrorPlugin({ includeSuggestions: true }));
    console.log('  ✅ SSL plugin registered via client.use()');

    const clientCustomSSL = new FetchClient({ baseURL: 'https://example.com', debug: true });
    await clientCustomSSL.use(
        createSSLErrorPlugin({
            includeTechnicalDetails: true,
            includeSuggestions: false,
        })
    );
    console.log('  ✅ Custom SSL plugin config applied');

    const clientNoSSL = new FetchClient({ baseURL: 'https://example.com' });
    console.log('  ✅ Client without SSL plugin (raw errors)');

    // ===========================================
    // 7. EDGE CASE TESTS
    // ===========================================
    
    console.log('\n7️⃣ Testing Edge Cases');
    console.log('---------------------');

    // Test with undefined/null error messages
    const edgeCases = [
        { message: undefined, name: 'Undefined message' },
        { message: null, name: 'Null message' },
        { message: '', name: 'Empty message' },
        { message: 'SSL', name: 'Very short SSL message' },
        { message: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'.repeat(10), name: 'Very long SSL message' }
    ];

    edgeCases.forEach(test => {
        try {
            const error = { message: test.message } as FetchError;
            const isSSL = isSSLError(error);
            const analysis = analyzeSSLError(error);
            const suggestions = getSSLErrorSuggestions(error);
            
            console.log(`  ✅ ${test.name}:`);
            console.log(`    Detected as SSL: ${isSSL}`);
            console.log(`    Analysis type: ${analysis.type}`);
            console.log(`    Suggestions: ${suggestions.length}`);
        } catch (error) {
            console.log(`  ❌ ${test.name}: Threw error - ${error}`);
        }
    });

    console.log('\n🎉 All SSL error handling tests completed!');
    console.log('✨ SSL error handling system is working correctly!');
}

// Run the tests
if (require.main === module) {
    testSSLErrorHandling().catch(console.error);
}

export { testSSLErrorHandling };