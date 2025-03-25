import * as ts from 'typescript';
import {
    isNestedHTML,
    isWhitespace,
    type ComponentInfo,
    type UsedComponent,
} from '.';
import { logger } from './Logger';

type ExpressionMapping = {
    start: number;
    end: number;
    expression: ts.Expression;
    component?: string;
    invalidSyntax?: boolean;
    prop?: string;
    emit?: string;
    propQuoted?: boolean;
};

export const preserveCompoenentImportsDiagnostics = (
    diagnostics: readonly ts.Diagnostic[] | ts.Diagnostic[],
    components: Map<string | undefined, UsedComponent[]>,
): ts.Diagnostic[] => {
    return diagnostics.filter((diag) => {
        if (diag.code !== 6133 && diag.code !== 6192) return true;

        const fileName = diag.file?.fileName;
        if (!components.has(fileName)) return true;

        const comps = components.get(fileName);
        if (typeof diag.messageText !== 'string' || !comps) return true;

        for (const comp of comps) {
            if (diag.messageText.includes(comp.name)) return false;
        }

        return true;
    });
};

export const getNonImportedComponentDiagnostics = (
    components: Map<string | undefined, UsedComponent[]>,
): ts.Diagnostic[] => {
    const diagnostics = [];
    for (const [_, usedComponents] of components) {
        for (const comp of usedComponents) {
            if (comp.import) continue;
            const diag: ts.Diagnostic = {
                file: comp.sourceFile,
                start: comp.start,
                length: comp.name.length,
                messageText: `Component <${comp.name}> is used in template but not imported.`,
                category: ts.DiagnosticCategory.Error,
                code: 9999,
            };
            diagnostics.push(diag);
        }
    }

    return diagnostics;
};

export const getComponentNameDiagnopstics = (
    components: ComponentInfo[],
    sourceFile?: ts.SourceFile,
): ts.Diagnostic[] => {
    const diagnostics = [];

    for (const component of components) {
        if (
            sourceFile !== undefined &&
            sourceFile.fileName !== component.sourceFile.fileName
        )
            continue;

        if (!component.isMultiword) {
            diagnostics.push({
                file: component.sourceFile,
                start: component.start,
                length: component.name.length,
                messageText: `Component <${component.name}> must have a multiword name (e.g., "Fe AppComponents").`,
                category: ts.DiagnosticCategory.Error,
                code: 9996,
            });
        }

        if (component.isDuplicated) {
            diagnostics.push({
                file: component.sourceFile,
                start: component.start,
                length: component.name.length,
                messageText: `Duplicated component name detected: "<${component.name}>"`,
                category: ts.DiagnosticCategory.Error,
                code: 9995,
            });
        }
    }

    return diagnostics;
};

export const getMissingPropsDiagnostics = (
    components: ComponentInfo[],
    sourceFile: ts.SourceFile,
): ts.Diagnostic[] => {
    const diagnostics: ts.Diagnostic[] = [];

    function visit(node: ts.Node) {
        if (
            ts.isTaggedTemplateExpression(node) &&
            ts.isIdentifier(node.tag) &&
            node.tag.text === 'html' &&
            !isNestedHTML(node)
        ) {
            const templateNode = node.template;
            const templateFullText = templateNode.getFullText();
            if (!templateFullText) return;

            const tagRegex = /<([A-Z][A-Za-z0-9]*)\b([^>]*)>/g;
            let tagMatch: RegExpExecArray | null;

            // biome-ignore lint:
            while ((tagMatch = tagRegex.exec(templateFullText)) !== null) {
                const compName = tagMatch[1];
                const attrString = tagMatch[2].trim();

                const duplicatedProps = new Set<string>();
                const providedProps = new Set<string>();
                const attrRegex = /(?:^|\s):(\w+)=/g;
                let m: RegExpExecArray | null;

                const duplicatedEmits = new Set<string>();
                const providedEmits = new Set<string>();
                const emitsRegex = /(?:^|\s)@emits:(\w+)=/g;
                let n: RegExpExecArray | null;

                // biome-ignore lint:
                while ((n = emitsRegex.exec(attrString)) !== null) {
                    const emit = n[1].trim();
                    if (providedEmits.has(emit)) {
                        duplicatedEmits.add(emit);
                    } else {
                        providedEmits.add(emit);
                    }
                }

                // biome-ignore lint:
                while ((m = attrRegex.exec(attrString)) !== null) {
                    const prop = m[1].trim();
                    if (providedProps.has(prop)) {
                        duplicatedProps.add(prop);
                    } else {
                        providedProps.add(prop);
                    }
                }

                const component = components.find((c) => c.name === compName);
                if (!component) return;

                for (const prop of component.props) {
                    if (!prop.optional && !providedProps.has(prop.key)) {
                        diagnostics.push({
                            file: component.sourceFile,
                            start: templateNode.getStart() + tagMatch.index + 1,
                            length: compName.length,
                            messageText: `Component <${compName}> is missing required prop ':${prop.key}'.`,
                            category: ts.DiagnosticCategory.Error,
                            code: 9997,
                        });
                    }
                }

                for (const prop of providedProps) {
                    const matchingProp = component.props.find(
                        (p) => p.key === prop,
                    );
                    if (!matchingProp) {
                        diagnostics.push({
                            file: component.sourceFile,
                            start: templateNode.getStart() + tagMatch.index + 1,
                            length: compName.length,
                            messageText: `Component <${compName}> does not define prop ':${prop}'.`,
                            category: ts.DiagnosticCategory.Error,
                            code: 9995,
                        });
                    }
                }

                for (const emit of providedEmits) {
                    const matchingProp = component.emits.find(
                        (e) => e.key === emit,
                    );
                    if (!matchingProp) {
                        diagnostics.push({
                            file: component.sourceFile,
                            start: templateNode.getStart() + tagMatch.index + 1,
                            length: compName.length,
                            messageText: `Component <${compName}> does not define emit '@emit:${emit}'.`,
                            category: ts.DiagnosticCategory.Error,
                            code: 9993,
                        });
                    }
                }

                for (const emit of duplicatedEmits) {
                    diagnostics.push({
                        file: component.sourceFile,
                        start: templateNode.getStart() + tagMatch.index + 1,
                        length: compName.length,
                        messageText: `Component <${compName}> has duplicated emit declarations '@emit:${emit}'.`,
                        category: ts.DiagnosticCategory.Error,
                        code: 9992,
                    });
                }

                for (const prop of duplicatedProps) {
                    diagnostics.push({
                        file: component.sourceFile,
                        start: templateNode.getStart() + tagMatch.index + 1,
                        length: compName.length,
                        messageText: `Component <${compName}> has duplicated prop declarations ':${prop}'.`,
                        category: ts.DiagnosticCategory.Error,
                        code: 9992,
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return diagnostics;
};

export const getPropsTypeDiagnostics = (
    components: ComponentInfo[],
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): ts.Diagnostic[] => {
    const diagnostics: ts.Diagnostic[] = [];

    function visit(node: ts.Node) {
        if (
            ts.isTaggedTemplateExpression(node) &&
            ts.isIdentifier(node.tag) &&
            node.tag.text === 'html'
        ) {
            const templateText = node.template.getText();

            const expressionMapping: ExpressionMapping[] = [];
            const templateNode = node.template;
            const templateStart = templateNode.getStart();
            if (ts.isTemplateExpression(templateNode)) {
                for (const span of templateNode.templateSpans) {
                    const spanStart = span.getStart() - templateStart;
                    const spanEnd = span.getEnd() - templateStart;
                    expressionMapping.push({
                        start: spanStart,
                        end: spanEnd,
                        expression: span.expression,
                    });
                }
            }

            for (const expression of expressionMapping) {
                const part = templateText.slice(0, expression.start);

                let token = '';
                let i = part.length - 1;
                while (i >= 0 && !isWhitespace(part[i])) {
                    token = part[i] + token;
                    i--;
                }
                if (!token.startsWith(':') || token.indexOf('=') === -1)
                    continue;
                const eqIndex = token.indexOf('=');
                const prop = token.slice(1, eqIndex);
                const nextChar = token.charAt(eqIndex + 1);
                const propQuoted = nextChar === '"' || nextChar === "'";

                const lastBracketIndex = part.lastIndexOf('<');
                if (lastBracketIndex === -1) continue;
                let component = '';
                let j = lastBracketIndex + 1;
                while (j < part.length && !isWhitespace(part[j])) {
                    component += part[j];
                    j++;
                }

                expression.prop = prop;
                expression.propQuoted = propQuoted;
                expression.component = component;
            }

            for (const mapping of expressionMapping) {
                if (mapping.component && mapping.prop) {
                    const compInfo = components.find(
                        (c) => c.name === mapping.component,
                    );
                    if (!compInfo) return;

                    const propInfo = compInfo.props.find(
                        (p) => p.key === mapping.prop,
                    );
                    if (!propInfo) return;

                    const providedType = checker.getTypeAtLocation(
                        mapping.expression,
                    );
                    const expectedType = propInfo.typeObject;

                    if (
                        !checker.isTypeAssignableTo(providedType, expectedType)
                    ) {
                        const offset = mapping.propQuoted ? 0 : 1;
                        const diagStart =
                            node.getStart() +
                            mapping.start -
                            mapping.prop.length +
                            offset;

                        diagnostics.push({
                            file: sourceFile,
                            start: diagStart,
                            length: mapping.prop.length,
                            messageText: `Type mismatch for prop ':${mapping.prop}' on <${mapping.component}>. Expected ${propInfo.type}, but got ${checker.typeToString(providedType)}.`,
                            category: ts.DiagnosticCategory.Error,
                            code: 9998,
                        });
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return diagnostics;
};

export const getEmitsTypeDiagnostics = (
    components: ComponentInfo[],
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): ts.Diagnostic[] => {
    const diagnostics: ts.Diagnostic[] = [];

    function visit(node: ts.Node) {
        if (
            ts.isTaggedTemplateExpression(node) &&
            ts.isIdentifier(node.tag) &&
            node.tag.text === 'html'
        ) {
            const templateText = node.template.getText();

            const expressionMapping: ExpressionMapping[] = [];
            const templateNode = node.template;
            const templateStart = templateNode.getStart();
            if (ts.isTemplateExpression(templateNode)) {
                for (const span of templateNode.templateSpans) {
                    const spanStart = span.getStart() - templateStart;
                    const spanEnd = span.getEnd() - templateStart;
                    expressionMapping.push({
                        start: spanStart,
                        end: spanEnd,
                        expression: span.expression,
                    });
                }
            }

            for (const expression of expressionMapping) {
                const part = templateText.slice(0, expression.start);

                let token = '';
                let i = part.length - 1;
                while (i >= 0 && !isWhitespace(part[i])) {
                    token = part[i] + token;
                    i--;
                }
                if (!token.startsWith('@emits:') || token.indexOf('=') === -1)
                    continue;

                const eqIndex = token.indexOf('=');
                const emit = token.slice(7, eqIndex);
                const nextChar = token.charAt(eqIndex + 1);
                const emitQuoted = nextChar === '"' || nextChar === "'";

                const lastBracketIndex = part.lastIndexOf('<');
                if (lastBracketIndex === -1) continue;
                let component = '';
                let j = lastBracketIndex + 1;
                while (j < part.length && !isWhitespace(part[j])) {
                    component += part[j];
                    j++;
                }

                expression.emit = emit;
                expression.propQuoted = emitQuoted;
                expression.component = component;
            }

            for (const mapping of expressionMapping) {
                if (mapping.component && mapping.emit) {
                    const compInfo = components.find(
                        (c) => c.name === mapping.component,
                    );
                    if (!compInfo) return;

                    const propInfo = compInfo.emits.find(
                        (e) => e.key === mapping.emit,
                    );
                    if (!propInfo) return;

                    const providedType = checker.getTypeAtLocation(
                        mapping.expression,
                    );
                    const expectedType = propInfo.typeObject;

                    if (
                        !checker.isTypeAssignableTo(providedType, expectedType)
                    ) {
                        const offset = mapping.propQuoted ? 0 : 1;
                        const diagStart =
                            node.getStart() +
                            mapping.start -
                            mapping.emit.length +
                            offset;

                        diagnostics.push({
                            file: sourceFile,
                            start: diagStart,
                            length: mapping.emit.length,
                            messageText: `Type mismatch for emit '@emits:${mapping.emit}' on <${mapping.component}>. Expected ${propInfo.type}, but got ${checker.typeToString(providedType)}.`,
                            category: ts.DiagnosticCategory.Error,
                            code: 9994,
                        });
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return diagnostics;
};
