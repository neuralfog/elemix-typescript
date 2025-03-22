import * as path from 'node:path';
import * as ts from 'typescript';

export const autoCompleteComponentTemplate = (languageService: ts.LanguageService) => {
    const oldGetCompletionsAtPosition = languageService.getCompletionsAtPosition;

    languageService.getCompletionsAtPosition = (fileName, position, options) => {
        const program = languageService.getProgram();
        let prior = oldGetCompletionsAtPosition.call(languageService, fileName, position, options);

        const sourceFile = program.getSourceFile(fileName);

        if (sourceFile) {
            const fileName = path.basename(sourceFile.fileName, path.extname(sourceFile.fileName));

            const snippetText = `import { Component, html, type Template } from '@neuralfog/elemix';
import { component } from '@neuralfog/elemix/decorators';

@component()
export class ${fileName} extends Component {
    template(): Template {
        return html\`\`;
    }
}`;

            const customEntry = {
                name: 'component~',
                kind: ts.ScriptElementKind.classElement,
                sortText: '0',
                insertText: snippetText,
            };
            if (prior?.entries) {
                prior.entries.push(customEntry);
            } else {
                prior = {
                    isGlobalCompletion: true,
                    isMemberCompletion: false,
                    isNewIdentifierLocation: false,
                    entries: [customEntry],
                };
            }
        }
        return prior;
    };
};
