import * as ts from 'typescript';
import { useMetaDataCache } from './cache';

export const runDiagnostics = (program: ts.Program): number => {
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const cache = useMetaDataCache();

    const filteredDiagnostics = diagnostics.filter((diag) => {
        if (diag.code !== 6133 && diag.code !== 6192) return true;

        const fileName = diag.file?.fileName;
        if (!cache.usedComponents.has(fileName)) return true;

        const comps = cache.usedComponents.get(fileName);
        if (typeof diag.messageText !== 'string' || !comps) return true;

        for (const comp of comps) {
            if (diag.messageText.includes(comp.name)) return false;
        }

        return true;
    });

    for (const [_, components] of cache.usedComponents) {
        for (const comp of components) {
            if (comp.import) continue;
            const diag: ts.Diagnostic = {
                file: comp.sourceFile,
                start: comp.start,
                length: comp.name.length,
                messageText: `Component <${comp.name}> is used in template but not imported.`,
                category: ts.DiagnosticCategory.Error,
                code: 9999,
            };
            filteredDiagnostics.push(diag);
        }
    }

    for (const diagnostic of filteredDiagnostics) {
        const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
        );
        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line, character } =
                diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            console.error(
                `[elemix-vite-plugin]: ${diagnostic.file.fileName} (${line + 1},${character + 1}): [TS${diagnostic.code}] ${message}`,
            );
        } else {
            console.error(`[${diagnostic.code}] ${message}`);
        }
    }

    return filteredDiagnostics.length;
};
