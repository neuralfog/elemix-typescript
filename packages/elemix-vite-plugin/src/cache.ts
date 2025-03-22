import type { ComponentInfo, UsedComponent } from './utils';

class MetadataCache {
    constructor(
        public components: ComponentInfo[] = [],
        public usedComponents: Map<
            string | undefined,
            UsedComponent[]
        > = new Map(),
    ) {}
}

export const cache = {
    value: new MetadataCache(),
};

export const resetMetaDataCache = (): void => {
    cache.value = new MetadataCache();
};

export const useMetaDataCache = (): MetadataCache => {
    return cache.value;
};
