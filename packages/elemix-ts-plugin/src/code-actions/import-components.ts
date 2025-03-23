import type * as ts from 'typescript';
import { getAllComponents } from '@neuralfog/elemix-analaser';
import { getImportInsertionPosition, getImportPath } from '../utils';

export const codeFixesComponentImports = (languageService: ts.LanguageService) => {
    const oldGetCodeFixesAtPosition = languageService.getCodeFixesAtPosition;
    languageService.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
        if (errorCodes.includes(9999)) {
            const customFixes: ts.CodeFixAction[] = [];
            const program = languageService.getProgram();
            if (!program) return customFixes;

            const sourceFile = program.getSourceFile(fileName);
            if (!sourceFile) return customFixes;

            const insertionPos = getImportInsertionPosition(sourceFile);
            const fileText = sourceFile.getFullText();
            const needsNewLine = insertionPos === 0 || fileText[insertionPos - 1] === '\n' ? '' : '\n';

            const diags = languageService.getSemanticDiagnostics(fileName);
            const fixedComponents = new Set<string>();

            for (const diag of diags) {
                if (
                    diag.code === 9999 &&
                    diag.start !== undefined &&
                    diag.start <= start &&
                    diag.start + (diag.length || 0) >= end
                ) {
                    const match = /Component <(.*?)> is used in template but not imported/.exec(
                        diag.messageText.toString(),
                    );
                    if (match) {
                        const componentName = match[1];
                        if (fixedComponents.has(componentName)) {
                            continue;
                        }
                        fixedComponents.add(componentName);

                        const allComponents = getAllComponents(program);
                        const componentInfo = allComponents.find((c) => c.name === componentName);
                        if (componentInfo) {
                            const importPathText = getImportPath(fileName, componentInfo.file);
                            const newText = `${needsNewLine}import { ${componentName} } from '${importPathText}';`;
                            const fix: ts.CodeFixAction = {
                                fixName: 'importComponent',
                                fixId: 'importComponent',
                                fixAllDescription: 'Import all missing component imports',
                                description: `Import component ${componentName}`,
                                changes: [
                                    {
                                        fileName,
                                        textChanges: [
                                            {
                                                newText,
                                                span: {
                                                    start: insertionPos,
                                                    length: 0,
                                                },
                                            },
                                        ],
                                    },
                                ],
                                commands: [],
                            };
                            customFixes.push(fix);
                        }
                    }
                }
            }
            return customFixes;
        }
        return (
            oldGetCodeFixesAtPosition.call(
                languageService,
                fileName,
                start,
                end,
                errorCodes,
                formatOptions,
                preferences,
            ) || []
        );
    };
};
