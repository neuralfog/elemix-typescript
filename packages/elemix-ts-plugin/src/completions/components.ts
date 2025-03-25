import * as ts from 'typescript';
import { getAllComponents } from '@neuralfog/elemix-analaser';
import { findComponentAtCursor, getTokenAtPosition, isInsideHtmlTemplate } from '../utils';

export const autoCompleteComponentsInTemplate = (languageService: ts.LanguageService) => {
    const oldGetCompletionsAtPosition = languageService.getCompletionsAtPosition;

    languageService.getCompletionsAtPosition = (fileName, position, options) => {
        const program = languageService.getProgram();
        let prior = oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
        const sourceFile = program?.getSourceFile(fileName);
        if (sourceFile && isInsideHtmlTemplate(sourceFile, position)) {
            const components = getAllComponents(program);

            const customEntries = components.map((comp) => ({
                name: comp.name,
                kind: ts.ScriptElementKind.classElement,
                sortText: '0',
                insertText: comp.slots.length ? `<${comp.name}></${comp.name}>` : `<${comp.name} />`,
            }));

            if (prior?.entries) {
                prior.entries.push(...customEntries);
            } else {
                prior = {
                    isGlobalCompletion: false,
                    isMemberCompletion: false,
                    isNewIdentifierLocation: false,
                    entries: customEntries,
                };
            }
        }
        return prior;
    };
};

export const autoCompleteComponentProps = (languageService: ts.LanguageService) => {
    const oldGetCompletionsAtPosition = languageService.getCompletionsAtPosition;

    languageService.getCompletionsAtPosition = (fileName, position, options) => {
        try {
            const program = languageService.getProgram();
            if (!program) {
                return oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
            }
            const sourceFile = program.getSourceFile(fileName);
            if (!sourceFile || !isInsideHtmlTemplate(sourceFile, position)) {
                return oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
            }
            const prior = oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
            const token = getTokenAtPosition(sourceFile, position);
            if (!token) {
                return prior;
            }
            let templateExpr: ts.Node | undefined = token;
            while (templateExpr && !ts.isTaggedTemplateExpression(templateExpr)) {
                templateExpr = templateExpr.parent;
            }
            if (!templateExpr || !ts.isTaggedTemplateExpression(templateExpr)) {
                return prior;
            }
            const template = templateExpr.template;
            const fullText = template.getFullText();
            const templateStart = template.getStart();

            const { componentName } = findComponentAtCursor(fullText, position, templateStart);
            if (!componentName) {
                return prior;
            }
            const components = getAllComponents(program);
            const component = components.find((c) => c.name === componentName);
            if (component.props.length) {
                const propEntriesString = component.props.map((prop) => ({
                    name: `:${prop.key}~string`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '3',
                    insertText: `:${prop.key}=\"\${''}\"`,
                }));
                const propEntriesTrue = component.props.map((prop) => ({
                    name: `:${prop.key}~true`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '2',
                    insertText: `:${prop.key}=\"\${true}\"`,
                }));
                const propEntriesFalse = component.props.map((prop) => ({
                    name: `:${prop.key}~false`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '1',
                    insertText: `:${prop.key}=\"\${false}\"`,
                }));
                const propEntries = component.props.map((prop) => ({
                    name: `:${prop.key}`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '0',
                    insertText: `:${prop.key}=\"\${}\"`,
                }));

                prior.entries.push(...propEntriesString, ...propEntries, ...propEntriesFalse, ...propEntriesTrue);
            }
            if (component.emits.length) {
                const emitsEntries = component.emits.map((emit) => ({
                    name: `@emits:${emit.key}`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '0',
                    insertText: `@emits:${emit.key}=\"\${}\"`,
                }));

                prior.entries.push(...emitsEntries);
            }
            return prior;
        } catch (error) {
            return oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
        }
    };
};
