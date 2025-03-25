import * as ts from 'typescript';
import { findFullComponentAtCursor, getImportPath, getTokenAtPosition, isInsideHtmlTemplate } from '../utils';
import { getAllComponents } from '@neuralfog/elemix-analaser';

export const autoCompleteComponentHover = (languageService: ts.LanguageService) => {
    const oldGetQuickInfoAtPosition = languageService.getQuickInfoAtPosition;

    languageService.getQuickInfoAtPosition = (fileName, position) => {
        const program = languageService.getProgram();
        if (!program) {
            return oldGetQuickInfoAtPosition.call(languageService, fileName, position);
        }
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            return oldGetQuickInfoAtPosition.call(languageService, fileName, position);
        }

        if (isInsideHtmlTemplate(sourceFile, position)) {
            const token = getTokenAtPosition(sourceFile, position);
            if (!token) {
                return oldGetQuickInfoAtPosition.call(languageService, fileName, position);
            }

            let templateExpression: ts.Node | undefined = token;
            while (templateExpression && !ts.isTaggedTemplateExpression(templateExpression)) {
                templateExpression = templateExpression.parent;
            }
            if (!templateExpression || !ts.isTaggedTemplateExpression(templateExpression)) {
                return oldGetQuickInfoAtPosition.call(languageService, fileName, position);
            }

            const templateNode = templateExpression.template;
            const templateFullText = templateNode.getFullText();
            const templateStart = templateNode.getStart();

            const { componentName, insideTag } = findFullComponentAtCursor(templateFullText, position, templateStart);

            if (insideTag && componentName) {
                const components = getAllComponents(program);
                const component = components.find((c) => c.name === componentName);
                if (component) {
                    let helpText = `(alias) class ${component.name}\n\n`;

                    if (component.props.length) {
                        helpText += 'type Props = {\n';
                        for (const prop of component.props) {
                            helpText += `  ${prop.key}: ${prop.type}\n`;
                        }
                        helpText += '}\n';
                    }

                    if (component.emits.length) {
                        helpText += '\ntype Emits = {\n';
                        for (const emit of component.emits) {
                            helpText += `  ${emit.key}: ${emit.type}\n`;
                        }
                        helpText += '}\n';
                    }

                    if (component.slots.length) {
                        helpText += '\nSlots:\n';
                        for (const slot of component.slots) {
                            helpText += `  • ${slot}\n`;
                        }
                        helpText += '\n';
                    }
                    helpText += `\nimport { ${component.name} } from '${getImportPath(fileName, component.file)}';`;

                    const displayParts: ts.SymbolDisplayPart[] = [{ text: helpText, kind: 'text' }];
                    return {
                        kind: ts.ScriptElementKind.classElement,
                        kindModifiers: 'export',
                        textSpan: {
                            start: token.getStart(),
                            length: token.getWidth(),
                        },
                        displayParts,
                        documentation: displayParts,
                    };
                }
            }
        }

        return oldGetQuickInfoAtPosition.call(languageService, fileName, position);
    };
};
