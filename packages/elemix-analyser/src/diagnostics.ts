import * as ts from 'typescript';
import {
    isNestedHTML,
    isWhitespace,
    type ComponentInfo,
    type UsedComponent,
} from '.';

type ExpressionMapping = {
    start: number;
    end: number;
    expression: ts.Expression;
    component?: string;
    prop?: string;
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
            if (templateFullText) {
                const tagRegex = /<([A-Z][A-Za-z0-9]*)\b([^>]*)>/g;
                let tagMatch: RegExpExecArray | null;

                // biome-ignore lint:
                while ((tagMatch = tagRegex.exec(templateFullText)) !== null) {
                    const compName = tagMatch[1];
                    const attrString = tagMatch[2].trim();

                    const providedProps = new Set<string>();
                    const attrRegex = /:(\w+)=/g;
                    let m: RegExpExecArray | null;

                    // biome-ignore lint:
                    while ((m = attrRegex.exec(attrString)) !== null) {
                        providedProps.add(m[1].trim());
                    }

                    const component = components.find(
                        (c) => c.name === compName,
                    );
                    if (component?.props) {
                        for (const prop of component.props) {
                            if (
                                !prop.optional &&
                                !providedProps.has(prop.key)
                            ) {
                                diagnostics.push({
                                    file: component.sourceFile,
                                    start:
                                        templateNode.getStart() +
                                        tagMatch.index +
                                        1,
                                    length: compName.length,
                                    messageText: `Component <${compName}> is missing required prop ':${prop.key}'.`,
                                    category: ts.DiagnosticCategory.Error,
                                    code: 9997,
                                });
                            }
                        }
                    }
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
                const prop = token.slice(1, token.indexOf('='));

                const lastBracketIndex = part.lastIndexOf('<');
                if (lastBracketIndex === -1) continue;
                let component = '';
                let j = lastBracketIndex + 1;
                while (j < part.length && !isWhitespace(part[j])) {
                    component += part[j];
                    j++;
                }

                expression.prop = prop;
                expression.component = component;
            }

            for (const mapping of expressionMapping) {
                if (mapping.component && mapping.prop) {
                    const compInfo = components.find(
                        (c) => c.name === mapping.component,
                    );
                    if (compInfo?.props) {
                        const propInfo = compInfo.props.find(
                            (p) => p.key === mapping.prop,
                        );
                        if (propInfo) {
                            const providedType = checker.getTypeAtLocation(
                                mapping.expression,
                            );
                            const expectedType = propInfo.typeObject;
                            if (
                                !checker.isTypeAssignableTo(
                                    providedType,
                                    expectedType,
                                )
                            ) {
                                const diagStart =
                                    node.getStart() +
                                    mapping.start -
                                    mapping.prop.length +
                                    1;
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
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return diagnostics;
};
