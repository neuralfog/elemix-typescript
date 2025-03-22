import * as ts from 'typescript';
import { resetMetaDataCache } from './cache';
import { gatherTypescriptMetadata } from './utils';

export const getTypescriptProgram = (instance: any): ts.Program => {
    const configPath = ts.findConfigFile(
        './',
        ts.sys.fileExists,
        'tsconfig.json',
    );
    if (!configPath) {
        instance.error('tsconfig.json not found');
        throw Error('tsconfig.json not found');
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        './',
    );

    return ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
};

export const getSourceFiles = (program: ts.Program): ts.SourceFile[] => {
    return program
        .getSourceFiles()
        .filter(
            (sc) =>
                sc.fileName.endsWith('.ts') && !sc.fileName.endsWith('.d.ts'),
        );
};

export const buildTypeScriptMetadataCache = (
    program: ts.Program,
    ts: typeof import('typescript'),
): void => {
    resetMetaDataCache();
    gatherTypescriptMetadata(program, ts);
};
