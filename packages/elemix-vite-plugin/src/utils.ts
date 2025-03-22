import * as ts from 'typescript';
import { useMetaDataCache } from './cache';

export type ComponentInfo = {
    name: string;
    file: string;
};

export const gatherTypescriptMetadata = (
    program: ts.Program,
    ts: typeof import('typescript'),
): void => {
    const cache = useMetaDataCache();

    for (const sourceFile of program.getSourceFiles()) {
        ts.forEachChild(sourceFile, function visit(node) {
            if (isComponentClass(node) && node.name) {
                cache.components.push({
                    name: node.name.text,
                    file: sourceFile.fileName,
                });
            }
            ts.forEachChild(node, visit);
        });
        getUsedComponents(sourceFile, ts);
    }
};

const isComponentClass = (node: ts.Node): node is ts.ClassDeclaration => {
    if (!node || !ts.isClassDeclaration(node)) return false;
    const decorators = ts.getDecorators(node);
    return (
        !!decorators &&
        decorators.some((dec) => {
            if (ts.isCallExpression(dec.expression)) {
                return (
                    ts.isIdentifier(dec.expression.expression) &&
                    dec.expression.expression.text === 'component'
                );
            }
            return false;
        })
    );
};

export type UsedComponent = {
    name: string;
    start: number;
    end: number;
    import?: string;
    sourceFile: ts.SourceFile;
};

export const getUsedComponents = (
    sourceFile: ts.SourceFile,
    ts: typeof import('typescript'),
) => {
    const cache = useMetaDataCache();

    function visit(node: ts.Node) {
        if (ts.isTaggedTemplateExpression(node)) {
            if (ts.isIdentifier(node.tag) && node.tag?.text === 'html') {
                const templateText = extractTemplateText(node, ts);
                if (templateText) {
                    const templateStart = node.template.getStart(sourceFile);
                    const regex = /<([A-Z][A-Za-z0-9]*)\b/g;
                    let match: RegExpExecArray | null;
                    const compoenents = [];

                    // biome-ignore lint:
                    while ((match = regex.exec(templateText)) !== null) {
                        const compName = match[1];
                        const start = templateStart + match.index;
                        const end = start + match[0].length;
                        compoenents.push({
                            name: compName,
                            start,
                            end,
                            import: getComponentImport(sourceFile, compName),
                            sourceFile,
                        });
                    }

                    if (compoenents.length) {
                        const exitstingComponents =
                            cache.usedComponents.get(sourceFile.fileName) || [];

                        cache.usedComponents.set(sourceFile.fileName, [
                            ...exitstingComponents,
                            ...compoenents,
                        ]);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
};

export const extractTemplateText = (
    node: ts.TaggedTemplateExpression,
    ts: typeof import('typescript'),
): string | undefined => {
    if (ts.isNoSubstitutionTemplateLiteral(node.template)) {
        return node.template.text;
    }

    if (ts.isTemplateExpression(node.template)) {
        let text = node.template.head.text;
        for (const span of node.template.templateSpans) {
            text += span.literal.text;
        }
        return text;
    }
    return undefined;
};

export const getComponentImport = (
    sourceFile: ts.SourceFile,
    componentName: string,
): string | undefined => {
    for (const node of sourceFile.statements) {
        if (!ts.isImportDeclaration(node) || !node.importClause) continue;

        const moduleText = node.moduleSpecifier.getText(sourceFile);

        const { namedBindings } = node.importClause;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
            if (
                namedBindings.elements.some(
                    (element) => element.name.text === componentName,
                )
            ) {
                return moduleText;
            }
        }

        if (
            node.importClause.name &&
            node.importClause.name.text === componentName
        ) {
            return moduleText;
        }
    }
    return undefined;
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
