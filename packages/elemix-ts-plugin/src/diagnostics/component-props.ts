import type * as ts from 'typescript';
import {
    getAllComponents,
    getEmitsTypeDiagnostics,
    getMissingPropsDiagnostics,
    getPropsTypeDiagnostics,
} from '@neuralfog/elemix-analaser';

export const validateProps = (languageService: ts.LanguageService) => {
    const oldGetSemanticDiagnostics = languageService.getSemanticDiagnostics;
    languageService.getSemanticDiagnostics = (fileName: string) => {
        const baseDiags = oldGetSemanticDiagnostics.call(languageService, fileName) || [];

        const program = languageService.getProgram();
        if (!program) return baseDiags;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return baseDiags;

        return [...baseDiags, ...getMissingPropsDiagnostics(getAllComponents(program), sourceFile)];
    };
};

export const validatePropsTypes = (languageService: ts.LanguageService) => {
    const oldGetSemanticDiagnostics = languageService.getSemanticDiagnostics;
    languageService.getSemanticDiagnostics = (fileName: string) => {
        const baseDiags = oldGetSemanticDiagnostics.call(languageService, fileName) || [];
        const program = languageService.getProgram();
        if (!program) return baseDiags;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return baseDiags;

        return [
            ...baseDiags,
            ...getPropsTypeDiagnostics(getAllComponents(program), sourceFile, program.getTypeChecker()),
        ];
    };
};

export const validateEmitsTypes = (languageService: ts.LanguageService) => {
    const oldGetSemanticDiagnostics = languageService.getSemanticDiagnostics;
    languageService.getSemanticDiagnostics = (fileName: string) => {
        const baseDiags = oldGetSemanticDiagnostics.call(languageService, fileName) || [];
        const program = languageService.getProgram();
        if (!program) return baseDiags;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return baseDiags;

        return [
            ...baseDiags,
            ...getEmitsTypeDiagnostics(getAllComponents(program), sourceFile, program.getTypeChecker()),
        ];
    };
};
