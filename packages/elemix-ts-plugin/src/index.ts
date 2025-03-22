import type * as tsServer from 'typescript/lib/tsserverlibrary.js';
import { autoCompleteComponentProps, autoCompleteComponentsInTemplate } from './completions/components';
import { codeFixesComponentImports } from './code-actions/import-components';
import { preserveComponentImports } from './diagnostics/component-imports';
import { autoCompleteComponentHover } from './completions/componentInfo';
import { validateProps, validatePropsTypes } from './diagnostics/component-props';
import { componentNameDiagnostics } from './diagnostics/component-name';
import { autoCompleteComponentTemplate } from './completions/component-template';

function init(): tsServer.server.PluginModule {
    return {
        create(info: tsServer.server.PluginCreateInfo) {
            const languageService = info.languageService;

            // run ts analytics once here and cache it

            autoCompleteComponentsInTemplate(languageService);
            autoCompleteComponentProps(languageService);
            autoCompleteComponentHover(languageService);
            autoCompleteComponentTemplate(languageService);

            preserveComponentImports(languageService);

            codeFixesComponentImports(languageService);
            validateProps(languageService);
            validatePropsTypes(languageService);
            componentNameDiagnostics(languageService);

            return languageService;
        },
    };
}

export = init;
