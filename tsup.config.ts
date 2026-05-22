import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        app: 'src/app.ts',
        auth: 'src/auth.ts',
        upload: 'src/upload.ts',
        ssl: 'src/ssl.ts',
    },
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            // tsup injects baseUrl: "." for DTS; only TS 6 accepts ignoreDeprecations: "6.0"
            ignoreDeprecations: '6.0',
        },
    },
    splitting: true,
    sourcemap: true,
    clean: true,
    minify: false,
});
