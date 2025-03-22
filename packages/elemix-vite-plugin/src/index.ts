import type { Plugin } from 'vite';
import {
    buildTypeScriptMetadataCache,
    getTypescriptProgram,
} from './typescript';
import { runDiagnostics } from './diagnostics';
import * as ts from 'typescript';
import { transformSource } from './transform';

export default function typeCheckPlugin(): Plugin {
    let isBuild = false;
    return {
        name: 'elemix-vite-plugin',

        configResolved(config) {
            isBuild = config.command === 'build';
        },

        buildStart() {
            const program = getTypescriptProgram(this);
            buildTypeScriptMetadataCache(program, ts);
            const diagnostics = runDiagnostics(program);

            if (diagnostics && isBuild) {
                this.error(
                    'Build Aborted: TypeScript errors were detected. Please review the diagnostic output and fix the issues before retrying the build.',
                );
            }
        },

        handleHotUpdate() {
            const program = getTypescriptProgram(this);
            buildTypeScriptMetadataCache(program, ts);
            runDiagnostics(program);
        },

        transform(code, id) {
            if (!id.endsWith('.ts')) return code;
            return transformSource(id, code);
        },
    };
}
