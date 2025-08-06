#!/usr/bin/env tsx

/**
 * Node.js SSL Error Structure Test
 * 
 * This test investigates how Node.js actually reports SSL/certificate errors
 * to understand the real error object structures we need to handle.
 */

import { FetchClient } from '../src/index';

interface NodeSystemError extends Error {
    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
    path?: string;
    dest?: string;
}

async function testRealSSLErrors() {
    console.log('🧪 Testing Node.js SSL Error Structures...\n');
    
    const client = new FetchClient({
        debug: true,
        sslErrorHandling: { enabled: false }, // Disable our handling to see raw errors
        timeout: 5000
    });

    const testCases = [
        {
            name: 'Self-signed certificate',
            url: 'https://self-signed.badssl.com/',
            expectedCode: 'DEPTH_ZERO_SELF_SIGNED_CERT'
        },
        {
            name: 'Wrong hostname',
            url: 'https://wrong.host.badssl.com/',
            expectedCode: 'ERR_TLS_CERT_ALTNAME_INVALID'
        },
        {
            name: 'Expired certificate',
            url: 'https://expired.badssl.com/',
            expectedCode: 'CERT_HAS_EXPIRED'
        },
        {
            name: 'Untrusted root',
            url: 'https://untrusted-root.badssl.com/',
            expectedCode: 'SELF_SIGNED_CERT_IN_CHAIN'
        },
        {
            name: 'Invalid hostname (localhost with wrong cert)',
            url: 'https://localhost:8443/',
            expectedCode: 'ECONNREFUSED' // or certificate error
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        console.log(`🌐 URL: ${testCase.url}`);
        console.log(`🎯 Expected: ${testCase.expectedCode}`);
        
        try {
            const response = await client.get(testCase.url);
            console.log(`✅ Unexpected success: ${response.status}`);
        } catch (error: any) {
            console.log(`❌ Error caught:`);
            console.log(`   Type: ${typeof error}`);
            console.log(`   Constructor: ${error.constructor.name}`);
            console.log(`   Message: "${error.message}"`);
            
            // Check Node.js SystemError properties
            const sysError = error as NodeSystemError;
            if (sysError.code) console.log(`   Code: "${sysError.code}"`);
            if (sysError.errno) console.log(`   Errno: ${sysError.errno}`);
            if (sysError.syscall) console.log(`   Syscall: "${sysError.syscall}"`);
            if (sysError.address) console.log(`   Address: "${sysError.address}"`);
            if (sysError.port) console.log(`   Port: ${sysError.port}`);
            
            // Check all enumerable properties
            console.log(`   All properties:`, Object.keys(error));
            
            // Check if it's actually an SSL error
            const message = error.message?.toLowerCase() || '';
            const isSSLRelated = [
                'certificate', 'ssl', 'tls', 'cert', 'handshake',
                'unable_to_verify', 'self_signed', 'depth_zero',
                'cert_untrusted', 'cert_expired'
            ].some(pattern => message.includes(pattern));
            
            console.log(`   SSL-related: ${isSSLRelated}`);
        }
        
        console.log('─'.repeat(60));
    }
}

async function testFetchAPISSLErrors() {
    console.log('\n\n🧪 Testing Direct Node.js Fetch API SSL Errors...\n');
    
    const testUrls = [
        'https://self-signed.badssl.com/',
        'https://expired.badssl.com/'
    ];
    
    for (const url of testUrls) {
        console.log(`\n📋 Direct fetch test: ${url}`);
        
        try {
            const response = await fetch(url);
            console.log(`✅ Unexpected success: ${response.status}`);
        } catch (error: any) {
            console.log(`❌ Raw fetch error:`);
            console.log(`   Message: "${error.message}"`);
            console.log(`   Code: "${error.code}"`);
            console.log(`   Cause: ${error.cause}`);
            console.log(`   Stack preview: ${error.stack?.split('\n')[0]}`);
        }
    }
}

// Run the tests
async function main() {
    console.log('🔍 Node.js SSL Error Structure Investigation\n');
    console.log('This test helps us understand how Node.js reports SSL errors');
    console.log('so we can properly detect and handle them.\n');
    
    try {
        await testRealSSLErrors();
        await testFetchAPISSLErrors();
        
        console.log('\n\n📊 Summary:');
        console.log('This investigation shows us the actual error structures');
        console.log('that Node.js produces for SSL/certificate issues.');
        console.log('We can use this data to improve our SSL error detection.');
        
    } catch (error) {
        console.error('\n💥 Test failed:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}