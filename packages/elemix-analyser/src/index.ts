import * as ts from 'typescript';

export type UsedComponent = {
    name: string;
    start: number;
    end: number;
    import?: string;
    sourceFile: ts.SourceFile;
};

export type ComponentInfo = {
    name: string;
    file: string;
    start: number;
    props: PropInfo[];
    emits: PropInfo[];
    slots?: string[];
    isMultiword: boolean;
    isDuplicated: boolean;
    sourceFile: ts.SourceFile;
};

type PropInfo = {
    key: string;
    type: string;
    typeObject: ts.Type;
    optional: boolean;
};

export const getUsedComponents = (
    sourceFile: ts.SourceFile,
): Map<string, UsedComponent[]> => {
    const usedComponents = new Map<string, UsedComponent[]>();

    function visit(node: ts.Node) {
        if (ts.isTaggedTemplateExpression(node)) {
            if (ts.isIdentifier(node.tag) && node.tag?.text === 'html') {
                const templateText = extractTemplateText(node, ts);
                if (templateText) {
                    const templateStart = node.template.getStart(sourceFile);
                    const regex = /<([A-Z][A-Za-z0-9]*)\b/g;
                    let match: RegExpExecArray | null;
                    const components: UsedComponent[] = [];

                    // biome-ignore lint:
                    while ((match = regex.exec(templateText)) !== null) {
                        const compName = match[1];
                        const start = templateStart + match.index + 2;
                        const end = start + match[0].length;
                        components.push({
                            name: compName,
                            start,
                            end,
                            import: getComponentImport(sourceFile, compName),
                            sourceFile,
                        });
                    }

                    if (components.length) {
                        const exitstingComponents =
                            usedComponents.get(sourceFile.fileName) || [];

                        usedComponents.set(sourceFile.fileName, [
                            ...exitstingComponents,
                            ...components,
                        ]);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return usedComponents;
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

export const getAllComponents = (program: ts.Program): ComponentInfo[] => {
    const checker = program.getTypeChecker();
    const components: ComponentInfo[] = [];

    for (const sourceFile of program.getSourceFiles()) {
        ts.forEachChild(sourceFile, function visit(node) {
            if (isComponentClass(node, checker) && node.name) {
                components.push({
                    name: node.name.text,
                    start: node.name.getStart(),
                    file: sourceFile.fileName,
                    props: getComponentGenericType(node, checker, 0),
                    emits: getComponentGenericType(node, checker, 1),
                    slots: getComponentSlots(node, ts),
                    isMultiword: isComponentNameMultiword(node.name.text),
                    isDuplicated: false,
                    sourceFile: sourceFile,
                });
            }
            ts.forEachChild(node, visit);
        });
    }
    return markDuplicatedComponents(components);
};

const isComponentNameMultiword = (name: string): boolean => {
    const capitalWords = name.match(/[A-Z][a-z]+/g) || [];
    return capitalWords.length >= 2;
};

const markDuplicatedComponents = (
    components: ComponentInfo[],
): ComponentInfo[] => {
    const nameCount = new Map<string, number>();

    for (const component of components) {
        const compName = component.name;
        nameCount.set(compName, (nameCount.get(compName) || 0) + 1);
    }

    for (const component of components) {
        if ((nameCount.get(component.name) || 0) > 1) {
            component.isDuplicated = true;
        }
    }

    return components;
};

const getComponentSlots = (
    node: ts.ClassDeclaration,
    ts: typeof import('typescript'),
): string[] => {
    const slotsSet = new Set<string>();

    function visit(child: ts.Node) {
        if (ts.isTaggedTemplateExpression(child)) {
            const templateText = extractTemplateText(child, ts);
            if (templateText) {
                const slotRegex = /<slot\b([^>]*)>/g;
                let match: RegExpExecArray | null;
                // biome-ignore lint:
                while ((match = slotRegex.exec(templateText)) !== null) {
                    const attributes = match[1];
                    const nameMatch = /name\s*=\s*"([^"]+)"/.exec(attributes);
                    if (nameMatch) {
                        slotsSet.add(nameMatch[1]);
                    } else {
                        slotsSet.add('default');
                    }
                }
            }
        }
        ts.forEachChild(child, visit);
    }
    visit(node);
    return Array.from(slotsSet);
};

const isComponentClass = (
    node: ts.Node,
    typeChecker: ts.TypeChecker,
): node is ts.ClassDeclaration => {
    if (!node || !ts.isClassDeclaration(node)) return false;
    if (!node.heritageClauses) return false;

    const extendsClause = node.heritageClauses.find(
        (hc) => hc.token === ts.SyntaxKind.ExtendsKeyword,
    );
    if (!extendsClause || extendsClause.types.length === 0) return false;

    const baseTypeExpr = extendsClause.types[0].expression;
    if (!ts.isIdentifier(baseTypeExpr)) return false;

    let symbol = typeChecker.getSymbolAtLocation(baseTypeExpr);
    if (!symbol) return false;

    if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = typeChecker.getAliasedSymbol(symbol);
    }

    const declarations = symbol.getDeclarations();
    if (!declarations) return false;

    return declarations.some((decl) => {
        const sourceFile = decl.getSourceFile();
        return sourceFile.fileName.includes('@neuralfog/elemix');
    });
};

export const getComponentGenericType = (
    node: ts.ClassDeclaration,
    checker: ts.TypeChecker,
    typeArgumentsIndex: number,
): PropInfo[] => {
    if (!node.heritageClauses) return [];

    for (const heritage of node.heritageClauses) {
        if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
            const typeNode = heritage.types[0];
            if (
                ts.isExpressionWithTypeArguments(typeNode) &&
                typeNode.typeArguments
            ) {
                return getTypeProperties(
                    typeNode.typeArguments[typeArgumentsIndex],
                    checker,
                );
            }
        }
    }
    return [];
};

export const getTypeProperties = (
    typeNode: ts.TypeNode,
    checker: ts.TypeChecker,
): PropInfo[] => {
    const props: PropInfo[] = [];
    const type = checker.getTypeFromTypeNode(typeNode);

    for (const prop of type.getProperties()) {
        // Skip properties without a declaration.
        if (!prop.valueDeclaration) continue;
        const propType = checker.getTypeOfSymbolAtLocation(
            prop,
            prop.valueDeclaration,
        );

        const isOptional =
            (prop.getFlags() & ts.SymbolFlags.Optional) !== 0 ||
            (propType.isUnion() &&
                propType.types.some(
                    (t) => (t.flags & ts.TypeFlags.Undefined) !== 0,
                ));

        props.push({
            key: prop.getName(),
            type: checker.typeToString(propType),
            typeObject: propType,
            optional: isOptional,
        });
    }
    return props;
};

export const isNestedHTML = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current) {
        if (
            ts.isTaggedTemplateExpression(current) &&
            ts.isIdentifier(current.tag) &&
            current.tag.text === 'html'
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
};

export const isWhitespace = (char: string): boolean => {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
};
