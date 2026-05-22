/**
 * Core HTTP error message helpers (offline)
 * Run: pnpm run example:errors
 */
import {
    formatHTTPErrorMessage,
    getHTTPStatusDescription,
} from '../src/index';

function run() {
    console.log('📋 HTTP status descriptions\n');

    for (const code of [401, 404, 500, 503]) {
        console.log(`  ${code}: ${getHTTPStatusDescription(code)}`);
    }

    console.log('\n📋 formatHTTPErrorMessage\n');
    console.log('  ', formatHTTPErrorMessage(404));
    console.log('  ', formatHTTPErrorMessage(404, ''));
    console.log('  ', formatHTTPErrorMessage(500, 'Internal Server Error'));
    console.log('  ', formatHTTPErrorMessage(418, 'I\'m a teapot'));
}

run();
