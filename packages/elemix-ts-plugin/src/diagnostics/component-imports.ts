import type * as ts from 'typescript';
import {
    getNonImportedComponentDiagnostics,
    getUsedComponents,
    preserveCompoenentImportsDiagnostics,
} from '@neuralfog/elemix-analaser';

export const preserveComponentImports = (languageService: ts.LanguageService) => {
    const oldGetSemanticDiagnostics = languageService.getSemanticDiagnostics;
    languageService.getSemanticDiagnostics = (fileName: string) => {
        let baseDiags = oldGetSemanticDiagnostics.call(languageService, fileName) || [];
        const program = languageService.getProgram();
        if (!program) return baseDiags;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return baseDiags;

        const usedComponents = getUsedComponents(sourceFile);

        baseDiags = preserveCompoenentImportsDiagnostics(baseDiags, usedComponents);

        const pluginDiags = getNonImportedComponentDiagnostics(usedComponents);

        return [...baseDiags, ...pluginDiags];
    };
};
