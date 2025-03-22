import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: [resolve('src/index.ts')],
            name: 'elemix-vite-plugin',
            fileName: (_, entryName) => `${entryName}.js`,
            formats: ['cjs'],
        },
        rollupOptions: {
            external: ['vite', 'typescript'],
        },
    },
});
