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
            if (component?.props) {
                const propEntries = component.props.map((prop) => ({
                    name: `:${prop.key}`,
                    kind: ts.ScriptElementKind.memberVariableElement,
                    sortText: '0',
                    insertText: `:${prop.key}=\${}`,
                }));
                prior.entries.push(...propEntries);
            }
            return prior;
        } catch (error) {
            return oldGetCompletionsAtPosition.call(languageService, fileName, position, options);
        }
    };
};
