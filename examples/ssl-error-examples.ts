// SSL/Certificate Error Handling Examples for @myopentrip/fetch-client
import { 
    FetchClient,
    createSSLErrorInterceptor,
    createDevelopmentSSLErrorInterceptor,
    createProductionSSLErrorInterceptor,
    isSSLError,
    analyzeSSLError,
    shouldRetrySSLError,
    getSSLErrorSuggestions,
    type FetchError
} from '../src/index';

async function demonstrateSSLErrorHandling() {
    console.log('🔒 SSL/Certificate Error Handling Examples');
    console.log('==========================================\n');

    // ===========================================
    // 1. DEFAULT SSL ERROR HANDLING
    // ===========================================
    
    console.log('1️⃣ Default SSL Error Handling (Enabled by Default)');
    console.log('---------------------------------------------------');

    // SSL error handling is enabled by default
    const defaultClient = new FetchClient({
        baseURL: 'https://self-signed.badssl.com', // Known bad SSL site for testing
        debug: true
    });

    try {
        await defaultClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('✅ Default SSL error handling worked!');
        console.log('📦 Enhanced error:', {
            message: fetchError.message,
            hasSslInfo: !!(fetchError as any).sslError,
            suggestions: (fetchError as any).sslError?.suggestions?.length || 0
        });
    }

    // ===========================================
    // 2. CUSTOM SSL ERROR CONFIGURATION
    // ===========================================
    
    console.log('\n2️⃣ Custom SSL Error Configuration');
    console.log('----------------------------------');

    const customClient = new FetchClient({
        baseURL: 'https://expired.badssl.com', // Expired certificate for testing
        debug: true,
        sslErrorHandling: {
            enabled: true,
            includeTechnicalDetails: true,
            includeSuggestions: true,
            customTransformer: (error: FetchError) => {
                // Add custom branding to error messages
                error.message = `[MyApp] ${error.message}`;
                (error as any).customField = 'Added by custom transformer';
                return error;
            }
        }
    });

    try {
        await customClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('✅ Custom SSL error handling worked!');
        console.log('📦 Custom enhanced error:', {
            message: fetchError.message,
            customField: (fetchError as any).customField,
            technicalDetails: (fetchError as any).sslError?.technicalDetails,
            suggestions: (fetchError as any).sslError?.suggestions
        });
    }

    // ===========================================
    // 3. DEVELOPMENT VS PRODUCTION MODES
    // ===========================================
    
    console.log('\n3️⃣ Development vs Production SSL Error Handling');
    console.log('------------------------------------------------');

    // Development mode - shows all details
    const devClient = new FetchClient({
        baseURL: 'https://self-signed.badssl.com',
        debug: true
    });

    devClient.addErrorInterceptor(createDevelopmentSSLErrorInterceptor());

    try {
        await devClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('🔧 Development SSL error (verbose):');
        console.log('📦 Dev error info:', {
            message: fetchError.message,
            technicalDetails: (fetchError as any).sslError?.technicalDetails,
            originalError: (fetchError as any).sslError?.originalError,
            suggestionCount: (fetchError as any).sslError?.suggestions?.length
        });
    }

    // Production mode - minimal details
    const prodClient = new FetchClient({
        baseURL: 'https://self-signed.badssl.com',
        debug: false
    });

    prodClient.addErrorInterceptor(createProductionSSLErrorInterceptor());

    try {
        await prodClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('🚀 Production SSL error (minimal):');
        console.log('📦 Prod error info:', {
            message: fetchError.message,
            hasTechnicalDetails: !!(fetchError as any).sslError?.technicalDetails,
            hasSuggestions: !!(fetchError as any).sslError?.suggestions
        });
    }

    // ===========================================
    // 4. DISABLING SSL ERROR HANDLING
    // ===========================================
    
    console.log('\n4️⃣ Disabling Automatic SSL Error Handling');
    console.log('------------------------------------------');

    const rawClient = new FetchClient({
        baseURL: 'https://self-signed.badssl.com',
        debug: true,
        sslErrorHandling: {
            enabled: false // Disable automatic SSL error handling
        }
    });

    try {
        await rawClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        console.log('⚠️ Raw SSL error (no transformation):');
        console.log('📦 Raw error:', {
            message: fetchError.message,
            hasSSLInfo: !!(fetchError as any).sslError,
            isSSLError: isSSLError(fetchError)
        });
    }

    // ===========================================
    // 5. MANUAL SSL ERROR ANALYSIS
    // ===========================================
    
    console.log('\n5️⃣ Manual SSL Error Analysis');
    console.log('-----------------------------');

    const manualClient = new FetchClient({
        baseURL: 'https://wrong.host.badssl.com',
        debug: true,
        sslErrorHandling: { enabled: false }
    });

    try {
        await manualClient.get('/');
    } catch (error) {
        const fetchError = error as FetchError;
        
        if (isSSLError(fetchError)) {
            console.log('🔍 Manual SSL error analysis:');
            
            const analysis = analyzeSSLError(fetchError);
            console.log('📊 SSL Analysis Result:', {
                type: analysis.type,
                userFriendlyMessage: analysis.userFriendlyMessage,
                retryable: analysis.retryable,
                suggestionCount: analysis.suggestions.length
            });
            
            // Get suggestions
            const suggestions = getSSLErrorSuggestions(fetchError);
            console.log('💡 Suggestions:', suggestions.slice(0, 2)); // Show first 2
            
            // Check if should retry
            const shouldRetry = shouldRetrySSLError(fetchError);
            console.log('🔄 Should retry:', shouldRetry);
        } else {
            console.log('ℹ️ Not an SSL error:', fetchError.message);
        }
    }

    // ===========================================
    // 6. REAL-WORLD USAGE PATTERNS
    // ===========================================
    
    console.log('\n6️⃣ Real-World Usage Patterns');
    console.log('-----------------------------');

    // Pattern 1: API client with SSL error monitoring
    const apiClient = new FetchClient({
        baseURL: 'https://api.example.com',
        debug: false,
        sslErrorHandling: {
            enabled: true,
            includeSuggestions: false, // Don't confuse end users
            customTransformer: (error: FetchError) => {
                // Send SSL errors to monitoring service
                if (isSSLError(error)) {
                    console.log('📡 SSL error reported to monitoring service');
                    // monitoringService.reportSSLError(error);
                }
                return error;
            }
        }
    });

    // Pattern 2: Development client with detailed SSL debugging
    const debugClient = new FetchClient({
        baseURL: 'https://localhost:8443', // Development server
        debug: true,
        sslErrorHandling: {
            enabled: true,
            includeTechnicalDetails: true,
            includeSuggestions: true
        }
    });

    // Pattern 3: Enterprise client with custom SSL error handling
    const enterpriseClient = new FetchClient({
        baseURL: 'https://enterprise-api.company.com',
        debug: false
    });

    enterpriseClient.addErrorInterceptor((error: FetchError) => {
        if (isSSLError(error)) {
            // Custom enterprise SSL error handling
            const analysis = analyzeSSLError(error);
            
            // Log to enterprise monitoring
            console.log('🏢 Enterprise SSL error logged');
            
            // Transform for enterprise users
            error.message = `Security connection error. Please contact IT support. (Ref: ${Date.now()})`;
            
            // Add enterprise-specific error info
            (error as any).enterpriseError = {
                category: 'SSL_CERTIFICATE',
                severity: analysis.retryable ? 'WARNING' : 'CRITICAL',
                supportContactRequired: true,
                referenceId: `SSL-${Date.now()}`
            };
        }
        return error;
    });

    // ===========================================
    // 7. TESTING SSL ERROR SCENARIOS
    // ===========================================
    
    console.log('\n7️⃣ Testing Different SSL Error Scenarios');
    console.log('-----------------------------------------');

    const testScenarios = [
        { name: 'Self-signed certificate', url: 'https://self-signed.badssl.com' },
        { name: 'Expired certificate', url: 'https://expired.badssl.com' },
        { name: 'Wrong hostname', url: 'https://wrong.host.badssl.com' },
        { name: 'Untrusted root', url: 'https://untrusted-root.badssl.com' }
    ];

    for (const scenario of testScenarios) {
        const testClient = new FetchClient({
            baseURL: scenario.url,
            debug: false,
            timeout: 5000,
            sslErrorHandling: {
                enabled: true,
                includeTechnicalDetails: false,
                includeSuggestions: true
            }
        });

        try {
            await testClient.get('/');
        } catch (error) {
            const fetchError = error as FetchError;
            if (isSSLError(fetchError)) {
                const analysis = analyzeSSLError(fetchError);
                console.log(`🧪 ${scenario.name}:`, {
                    type: analysis.type,
                    message: analysis.userFriendlyMessage.substring(0, 50) + '...',
                    retryable: analysis.retryable
                });
            }
        }
    }

    console.log('\n🎉 SSL error handling examples completed!');
    console.log('💡 Key takeaways:');
    console.log('   - SSL errors are handled automatically by default');
    console.log('   - Can be customized for development vs production');
    console.log('   - Manual analysis tools available for advanced use cases');
    console.log('   - Enterprise-grade error transformation supported');
}

// Run the demo
if (require.main === module) {
    demonstrateSSLErrorHandling().catch(console.error);
}

export { demonstrateSSLErrorHandling };