import type { Plugin } from 'vite';
import {
    buildTypeScriptMetadataCache,
    getTypescriptProgram,
} from './typescript';
import { runDiagnostics } from './diagnostics';
import { transformSource } from './transform';

export default function typeCheckPlugin(): Plugin {
    let isBuild = false;
    return {
        name: 'elemix-vite-plugin',

        configResolved(config) {
            isBuild = config.command === 'build';
        },

        buildStart() {
            console.log('[elemix-vite-plugin]: Build Start...');
            const program = getTypescriptProgram(this);
            buildTypeScriptMetadataCache(program);
            const diagnostics = runDiagnostics(program);

            if (diagnostics && isBuild) {
                this.error(
                    'Build Aborted: TypeScript errors were detected. Please review the diagnostic output and fix the issues before retrying the build.',
                );
            }
        },

        handleHotUpdate() {
            console.log('[elemix-vite-plugin]: HMR...');
            const program = getTypescriptProgram(this);
            buildTypeScriptMetadataCache(program);
            runDiagnostics(program);
        },

        transform(code, id) {
            console.log('[elemix-vite-plugin]: Transform...');
            if (!id.endsWith('.ts')) return code;
            return transformSource(id, code);
        },
    };
}
