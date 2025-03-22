import type * as ts from 'typescript';
import { useMetaDataCache } from './cache';
import {
    getAllComponents,
    getUsedComponents,
} from '@neuralfog/elemix-analaser';

export const gatherTypescriptMetadata = (program: ts.Program): void => {
    const cache = useMetaDataCache();

    cache.components = getAllComponents(program);

    for (const sourceFile of program.getSourceFiles()) {
        cache.setUsedComponents(getUsedComponents(sourceFile));
    }
};

export const camelToKebabCase = (input: string): string => {
    return (
        input.match(
            /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|[0-9]*$)|[A-Z]?[a-z]+|[A-Z]|[0-9]+/g,
        ) || []
    )
        .map((x) => x.toLowerCase())
        .join('-');
};
