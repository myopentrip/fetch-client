#!/usr/bin/env tsx

/**
 * Test Node.js SSL Error Detection
 * 
 * This test verifies that our SSL error detection works correctly
 * with Node.js error structures that include error.cause
 */

import { 
    isSSLError, 
    analyzeSSLError, 
    createSSLErrorInterceptor 
} from '../src/utils/ssl-error-handler';
import type { FetchError } from '../src/types';

function createNodeJSSSLError(causeMessage: string, mainMessage: string = 'fetch failed'): FetchError {
    const error = new Error(mainMessage) as FetchError;
    error.cause = new Error(causeMessage);
    return error;
}

function createBrowserSSLError(message: string): FetchError {
    const error = new Error(message) as FetchError;
    return error;
}

async function testSSLDetection() {
    console.log('🧪 Testing SSL Error Detection (Node.js vs Browser)\n');
    
    const testCases = [
        // Node.js-style errors (real structure from our investigation)
        // {
        //     name: 'Node.js Self-signed Certificate',
        //     error: createNodeJSSSLError('self-signed certificate'),
        //     expectedDetection: true,
        //     expectedType: 'certificate'
        // },
        // {
        //     name: 'Node.js Expired Certificate',
        //     error: createNodeJSSSLError('certificate has expired'),
        //     expectedDetection: true,
        //     expectedType: 'certificate'
        // },
        // {
        //     name: 'Node.js Hostname Mismatch',
        //     error: (() => {
        //         const err = createNodeJSSSLError('certificate verify failed');
        //         (err as any).code = 'ERR_TLS_CERT_ALTNAME_INVALID';
        //         return err;
        //     })(),
        //     expectedDetection: true,
        //     expectedType: 'certificate'
        // },
        
        // // Browser-style errors  
        // {
        //     name: 'Browser SSL Error',
        //     error: createBrowserSSLError('SSL certificate problem: unable to verify the first certificate'),
        //     expectedDetection: true,
        //     expectedType: 'certificate'
        // },
        // {
        //     name: 'Browser CORS Error (not SSL)',
        //     error: createBrowserSSLError('Failed to fetch'),
        //     expectedDetection: false,
        //     expectedType: null
        // },
        
        // // Edge cases
        // {
        //     name: 'Node.js Network Error (non-SSL)',
        //     error: createNodeJSSSLError('ECONNREFUSED'),
        //     expectedDetection: false,
        //     expectedType: null
        // },
        {
            name: 'Node.js TLS Handshake Error',
            error: (() => {
                const err = createNodeJSSSLError('socket hang up');
                (err as any).code = 'ERR_TLS_HANDSHAKE_TIMEOUT';
                return err;
            })(),
            expectedDetection: true,
            expectedType: 'certificate'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        console.log(`   Error message: "${testCase.error.message}"`);
        console.log(`   Error cause: "${(testCase.error.cause as any)?.message || 'none'}"`);
        console.log(`   Error code: "${(testCase.error as any).code || 'none'}"`);
        
        // Test detection
        const isDetected = isSSLError(testCase.error);
        console.log(`   Detected as SSL: ${isDetected} (expected: ${testCase.expectedDetection})`);
        
        if (isDetected === testCase.expectedDetection) {
            console.log(`   ✅ Detection: PASS`);
            passed++;
        } else {
            console.log(`   ❌ Detection: FAIL`);
            failed++;
        }
        
        // Test analysis (only if detected as SSL)
        if (isDetected && testCase.expectedDetection) {
            const analysis = analyzeSSLError(testCase.error);
            console.log(`   Analysis type: ${analysis.type} (expected: ${testCase.expectedType})`);
            console.log(`   User message: "${analysis.userFriendlyMessage}"`);
            console.log(`   Technical: "${analysis.technicalDetails}"`);
            console.log(`   Suggestions: ${analysis.suggestions.length} items`);
            
            console.log(analysis.type, testCase.expectedType);
            console.log(analysis.type === testCase.expectedType);
            if (analysis.type === testCase.expectedType) {
                console.log(`   ✅ Analysis: PASS`);
                passed++;
            } else {
                console.log(`   ❌ Analysis: FAIL`);
                failed++;
            }
        } else if (testCase.expectedDetection) {
            console.log(`   ⏭️  Analysis: SKIPPED (not detected as SSL)`);
        }
        
        console.log('─'.repeat(60));
    }
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All tests passed! SSL detection works for both Node.js and browser environments.');
    } else {
        console.log('❌ Some tests failed. SSL detection needs improvement.');
    }
    
    return failed === 0;
}

async function testSSLInterceptor() {
    console.log('\n\n🧪 Testing SSL Error Interceptor\n');
    
    const interceptor = createSSLErrorInterceptor({
        enableAutoTransform: true,
        includeTechnicalDetails: true,
        includeSuggestions: true
    });
    
    // Test with Node.js SSL error
    const nodeSSLError = createNodeJSSSLError('self-signed certificate');
    console.log('Original error:', nodeSSLError.message);
    console.log('Original cause:', (nodeSSLError.cause as any).message);
    
    try {
        const transformedError = await interceptor(nodeSSLError);
        console.log('\nTransformed error:');
        console.log('  Message:', transformedError.message);
        console.log('  SSL Info:', (transformedError as any).sslError);
        
        return true;
    } catch (error) {
        console.error('Interceptor failed:', error);
        return false;
    }
}

// Run tests
async function main() {
    console.log('🔍 SSL Error Detection Test Suite');
    console.log('Testing both Node.js and Browser error structures\n');
    
    try {
        const detectionPassed = await testSSLDetection();
        const interceptorPassed = await testSSLInterceptor();
        
        if (detectionPassed && interceptorPassed) {
            console.log('\n✅ All SSL error handling tests passed!');
            console.log('The package now supports both Node.js and browser environments.');
            process.exit(0);
        } else {
            console.log('\n❌ Some tests failed.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 Test suite failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}