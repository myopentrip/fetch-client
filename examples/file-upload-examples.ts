/**
 * Upload plugin examples (v3)
 */
import { FetchClient, formatUploadSpeed, formatTimeRemaining } from '../src/index';
import {
    createUploadPlugin,
    createFileUploadData,
    createProgressCallback,
    validateFile,
} from '../src/upload';

async function basicUploads() {
    const client = new FetchClient({ baseURL: 'https://httpbin.org', debug: true });
    const upload = createUploadPlugin(client);

    const file = new File(['Hello'], 'example.txt', { type: 'text/plain' });

    const single = await upload.uploadFile('/post', createFileUploadData(file, { fieldName: 'document' }));
    console.log('Single:', single.status);

    const multi = await upload.uploadFiles('/post', [file, file], { fieldName: 'files' });
    console.log('Multi:', multi.status);

    await upload.uploadFormData('/post', {
        name: 'John',
        avatar: file,
    });
}

async function uploadWithProgress() {
    const client = new FetchClient({ baseURL: 'https://httpbin.org' });
    const upload = createUploadPlugin(client);
    const file = new File(['x'.repeat(10000)], 'large.bin');

    await upload.uploadFile('/post', { file }, {
        onProgress: createProgressCallback(
            (pct) => console.log(`${pct}%`),
            (speed) => console.log(formatUploadSpeed(speed)),
            (eta) => console.log(formatTimeRemaining(eta))
        ),
    });
}

async function validateBeforeUpload() {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const result = validateFile(file, {
        maxSize: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png'],
    });
    if (!result.valid) throw new Error(result.error);
}

export { basicUploads, uploadWithProgress, validateBeforeUpload };
