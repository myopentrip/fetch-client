import { describe, expect, it } from 'vitest';
import { formatFileSize, formatTimeRemaining, formatUploadSpeed } from '../src/index';
import { createFileUploadData, validateFile } from '../src/upload';

describe('upload utilities', () => {
    it('validateFile enforces size, type, and extension', () => {
        const rules = {
            maxSize: 1024 * 1024,
            allowedTypes: ['text/plain', 'image/jpeg'],
            allowedExtensions: ['txt', 'jpg'],
        };

        expect(validateFile(new File(['a'], 'small.txt', { type: 'text/plain' }), rules).valid).toBe(true);
        expect(validateFile(new File(['b'], 'photo.jpg', { type: 'image/jpeg' }), rules).valid).toBe(true);

        const rejected = validateFile(new File(['c'], 'script.js', { type: 'application/javascript' }), rules);
        expect(rejected.valid).toBe(false);
        expect(rejected.error).toContain('not allowed');
    });

    it('rejects files over maxSize', () => {
        const file = new File([new Uint8Array(2000)], 'big.bin', { type: 'application/octet-stream' });
        const result = validateFile(file, { maxSize: 1000 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds maximum');
    });

    it('createFileUploadData sets fieldName', () => {
        const file = new File(['x'], 'doc.txt', { type: 'text/plain' });
        const data = createFileUploadData(file, { fieldName: 'doc' });
        expect(data.fieldName).toBe('doc');
        expect(data.file).toBe(file);
    });

    it('formatters produce human-readable strings', () => {
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatUploadSpeed(1048576)).toBe('1 MB/s');
        expect(formatTimeRemaining(90)).toBe('2m');
        expect(formatTimeRemaining(45)).toBe('45s');
    });
});
