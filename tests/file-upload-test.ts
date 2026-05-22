// Upload plugin tests (v3)
import { FetchClient, formatFileSize, formatUploadSpeed, formatTimeRemaining } from '../src/index';
import {
    createUploadPlugin,
    createFileUploadData,
    validateFile,
    type UploadProgressEvent,
} from '../src/upload';

async function testFileUploadFeatures() {
    console.log('📁 Testing Upload Plugin (v3)\n');

    const client = new FetchClient({
        baseURL: 'https://httpbin.org',
        debug: true,
    });

    const upload = createUploadPlugin(client);
    const testFile = new File(['Hello, file upload!'], 'test.txt', { type: 'text/plain' });

    console.log('1️⃣ Basic upload');
    try {
        const response = await upload.uploadFile('/post', {
            file: testFile,
            fieldName: 'testfile',
            additionalFields: { description: 'Test upload' },
        });
        console.log('✅ Upload status:', response.status);
    } catch (error) {
        console.log('ℹ️', (error as Error).message);
    }

    console.log('\n2️⃣ Validation');
    const rules = {
        maxSize: 1024 * 1024,
        allowedTypes: ['text/plain', 'image/jpeg'],
        allowedExtensions: ['txt', 'jpg'],
    };
    [
        new File(['a'], 'small.txt', { type: 'text/plain' }),
        new File(['b'], 'photo.jpg', { type: 'image/jpeg' }),
        new File(['c'], 'script.js', { type: 'application/javascript' }),
    ].forEach((file) => {
        const v = validateFile(file, rules);
        console.log(v.valid ? '✅' : '❌', file.name, v.error ?? '');
    });

    console.log('\n3️⃣ Formatters');
    console.log(formatFileSize(1048576), formatUploadSpeed(1048576), formatTimeRemaining(90));

    console.log('\n4️⃣ createFileUploadData helper');
    const data = createFileUploadData(testFile, { fieldName: 'doc' });
    console.log('✅', data.fieldName);

    console.log('\n5️⃣ FormData object');
    try {
        await upload.uploadFormData('/post', { name: 'test', file: testFile });
        console.log('✅ FormData upload');
    } catch (error) {
        console.log('ℹ️', (error as Error).message);
    }

    console.log('\n🎉 Upload plugin tests completed');
}

export { testFileUploadFeatures };
