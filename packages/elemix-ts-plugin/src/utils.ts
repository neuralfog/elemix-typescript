import * as ts from 'typescript';
import * as path from 'node:path';

export const getTokenAtPosition = (sourceFile: ts.SourceFile, position: number): ts.Node | undefined => {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getFullStart() && position < node.getEnd()) {
            let found: ts.Node | undefined;
            node.forEachChild((child) => {
                const result = find(child);
                if (result) {
                    found = result;
                }
            });
            return found || node;
        }
        return undefined;
    }
    return find(sourceFile);
};

export const isInsideHtmlTemplate = (sourceFile: ts.SourceFile, position: number): boolean => {
    const token = getTokenAtPosition(sourceFile, position);
    if (!token) return false;
    let node: ts.Node | undefined = token;
    while (node) {
        if (ts.isTaggedTemplateExpression(node)) {
            if (ts.isIdentifier(node.tag) && node.tag.text === 'html') {
                return true;
            }
        }
        node = node.parent;
    }
    return false;
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

export const findComponentAtCursor = (
    fullTemplateText: string,
    position: number,
    templateStart: number,
): { componentName: string | null } => {
    const relativePos = position - templateStart;
    if (relativePos < 0 || relativePos > fullTemplateText.length) {
        return { componentName: null };
    }
    const textBefore = fullTemplateText.substring(0, relativePos);
    const lastLt = textBefore.lastIndexOf('<');
    if (lastLt === -1) {
        return { componentName: null };
    }
    const gtIndex = fullTemplateText.indexOf('>', lastLt);
    const tagFragment = gtIndex !== -1 ? fullTemplateText.substring(lastLt, gtIndex + 1) : textBefore.substring(lastLt);

    const match = /^<\s*([A-Z][A-Za-z0-9]*)/.exec(tagFragment);
    return { componentName: match ? match[1] : null };
};

export const isComponentImported = (sourceFile: ts.SourceFile, componentName: string): boolean => {
    let imported = false;
    sourceFile.forEachChild((node) => {
        if (ts.isImportDeclaration(node) && node.importClause) {
            const { namedBindings } = node.importClause;
            if (namedBindings && ts.isNamedImports(namedBindings)) {
                for (const element of namedBindings.elements) {
                    if (element.name.text === componentName) {
                        imported = true;
                    }
                }
            }
            if (node.importClause.name && node.importClause.name.text === componentName) {
                imported = true;
            }
        }
    });
    return imported;
};

export const isComponentDefinedInFile = (sourceFile: ts.SourceFile, componentName: string): boolean => {
    let defined = false;
    sourceFile.forEachChild((node) => {
        if (ts.isClassDeclaration(node) && node.name && node.name.text === componentName) {
            defined = true;
        }
    });
    return defined;
};

export const getImportPath = (currentFile: string, targetFile: string): string => {
    let relativePath = path.relative(path.dirname(currentFile), targetFile);
    relativePath = relativePath.replace(/\.[tj]sx?$/, '');
    if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
    }
    return relativePath;
};

export const getImportInsertionPosition = (sourceFile: ts.SourceFile): number => {
    let lastImportEnd = 0;
    sourceFile.forEachChild((node) => {
        if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
            lastImportEnd = node.getEnd();
        }
    });
    return lastImportEnd;
};

export const findFullComponentAtCursor = (
    templateText: string,
    position: number,
    templateStart: number,
): { componentName: string | null; insideTag: boolean } => {
    const relativePosition = position - templateStart;
    if (relativePosition < 0 || relativePosition > templateText.length) {
        return { componentName: null, insideTag: false };
    }

    const textBeforeCursor = templateText.substring(0, relativePosition);
    const lastOpenAngle = textBeforeCursor.lastIndexOf('<');
    if (lastOpenAngle === -1) {
        return { componentName: null, insideTag: false };
    }

    const closingAngle = templateText.indexOf('>', lastOpenAngle);
    let tagFragment: string;
    if (closingAngle !== -1) {
        tagFragment = templateText.substring(lastOpenAngle, closingAngle + 1);
    } else {
        tagFragment = templateText.substring(lastOpenAngle);
    }

    const insideTag = closingAngle === -1 ? true : relativePosition <= closingAngle + 1;

    const match = /^<\s*([A-Z][A-Za-z0-9]*)/.exec(tagFragment);
    if (match) {
        return { componentName: match[1], insideTag };
    }
    return { componentName: null, insideTag: false };
};
