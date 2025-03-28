import { useMetaDataCache } from './cache';
import { camelToKebabCase, getMatchingKey } from './utils';

export const transformSource = (file: string, source: string): string => {
    let src = source;

    const { usedComponents } = useMetaDataCache();

    const keys = Array.from(usedComponents.keys());
    const matchingKey = getMatchingKey(file, keys);

    const components = matchingKey
        ? usedComponents.get(matchingKey)?.filter((cmp) => cmp.import)
        : undefined;

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
