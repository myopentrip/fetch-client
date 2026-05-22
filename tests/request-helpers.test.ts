import { describe, expect, it } from 'vitest';
import { mergeHeaders, prepareRequestBody, resolveURL } from '../src/index';

describe('request helpers', () => {
    it('resolveURL handles absolute paths and trailing slashes', () => {
        expect(resolveURL('https://api.test/', '/v1')).toBe('https://api.test/v1');
        expect(resolveURL('https://api.test', 'v1')).toBe('https://api.test/v1');
        expect(resolveURL('', 'https://full.url/x')).toBe('https://full.url/x');
    });

    it('mergeHeaders combines multiple header sources', () => {
        const merged = mergeHeaders({ 'X-A': '1' }, new Headers({ 'X-B': '2' }), { 'X-C': '3' });
        expect(merged['X-A']).toBe('1');
        expect(merged['x-b'] ?? merged['X-B']).toBe('2');
        expect(merged['X-C']).toBe('3');
    });

    it('prepareRequestBody serializes objects and passes through FormData', () => {
        const fd = new FormData();
        fd.append('a', '1');
        expect(prepareRequestBody(fd)).toBe(fd);
        expect(prepareRequestBody({ x: 1 })).toBe(JSON.stringify({ x: 1 }));
        expect(prepareRequestBody(undefined)).toBeUndefined();
    });
});
