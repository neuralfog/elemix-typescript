import type * as ts from 'typescript';
import { getAllComponents, getComponentNameDiagnopstics } from '@neuralfog/elemix-analaser';

export const componentNameDiagnostics = (languageService: ts.LanguageService) => {
    const oldGetSemanticDiagnostics = languageService.getSemanticDiagnostics;
    languageService.getSemanticDiagnostics = (fileName: string) => {
        const baseDiags = oldGetSemanticDiagnostics.call(languageService, fileName) || [];
        const program = languageService.getProgram();
        if (!program) return baseDiags;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return baseDiags;

        return [...baseDiags, ...getComponentNameDiagnopstics(getAllComponents(program), sourceFile)];
    };
};
