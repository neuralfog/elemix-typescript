import * as ts from 'typescript';
import { useMetaDataCache } from './cache';
import {
    getComponentNameDiagnopstics,
    getEmitsTypeDiagnostics,
    getMissingPropsDiagnostics,
    getNonImportedComponentDiagnostics,
    getPropsTypeDiagnostics,
    preserveCompoenentImportsDiagnostics,
} from '@neuralfog/elemix-analaser';

export const runDiagnostics = (program: ts.Program): number => {
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const cache = useMetaDataCache();

    const filteredDiagnostics = preserveCompoenentImportsDiagnostics(
        diagnostics,
        cache.usedComponents,
    );

    filteredDiagnostics.push(
        ...getNonImportedComponentDiagnostics(cache.usedComponents),
    );

    filteredDiagnostics.push(...getComponentNameDiagnopstics(cache.components));

    for (const sourceFile of program.getSourceFiles()) {
        filteredDiagnostics.push(
            ...getMissingPropsDiagnostics(cache.components, sourceFile),
        );

        filteredDiagnostics.push(
            ...getPropsTypeDiagnostics(
                cache.components,
                sourceFile,
                program.getTypeChecker(),
            ),
        );

        filteredDiagnostics.push(
            ...getEmitsTypeDiagnostics(
                cache.components,
                sourceFile,
                program.getTypeChecker(),
            ),
        );
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
