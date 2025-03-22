import { useMetaDataCache } from './cache';
import { camelToKebabCase } from './utils';

export const transformSource = (file: string, source: string): string => {
    let src = source;

    const { usedComponents } = useMetaDataCache();

    if (!usedComponents.has(file)) return source;

    const components = usedComponents.get(file)?.filter((cmp) => cmp.import);
    if (!components) return src;

    const uniqueComponents = [
        ...new Map(components.map((item) => [item.name, item])).values(),
    ];

    for (const cmp of uniqueComponents) {
        src += `import ${cmp.import};`;
        src = src.replaceAll(`<${cmp.name}`, `<${camelToKebabCase(cmp.name)}`);
        src = src.replaceAll(`${cmp.name}>`, `${camelToKebabCase(cmp.name)}>`);
    }

    return src;
};
