/**
 * SSL plugin examples (v3)
 */
import { FetchClient } from '../src/index';
import {
    createSSLErrorPlugin,
    createSSLErrorInterceptor,
    isSSLError,
    analyzeSSLError,
    type FetchError,
} from '../src/ssl';

async function defaultSSLHandling() {
    const client = new FetchClient({ baseURL: 'https://self-signed.badssl.com', debug: true });
    await client.use(createSSLErrorPlugin());

    try {
        await client.get('/');
    } catch (error) {
        const e = error as FetchError & { sslError?: { suggestions?: string[] } };
        console.log('Message:', e.message);
        console.log('Suggestions:', e.sslError?.suggestions?.length ?? 0);
    }
}

async function customSSLPlugin() {
    const client = new FetchClient({ baseURL: 'https://expired.badssl.com', debug: true });
    await client.use(
        createSSLErrorPlugin({
            includeTechnicalDetails: true,
            includeSuggestions: true,
            customTransformer: (error) => {
                error.message = `[MyApp] ${error.message}`;
                return error;
            },
        })
    );

    try {
        await client.get('/');
    } catch (error) {
        console.log((error as Error).message);
    }
}

async function manualInterceptor() {
    const client = new FetchClient({ baseURL: 'https://api.example.com' });
    client.addErrorInterceptor(createSSLErrorInterceptor({}, true));

    try {
        await client.get('/data');
    } catch (error) {
        if (isSSLError(error as FetchError)) {
            console.log(analyzeSSLError(error as FetchError));
        }
    }
}

export { defaultSSLHandling, customSSLPlugin, manualInterceptor };

// defaultSSLHandling().catch(console.error);
