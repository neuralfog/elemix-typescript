import type { ComponentInfo, UsedComponent } from '@neuralfog/elemix-analaser';

class MetadataCache {
    constructor(
        public components: ComponentInfo[] = [],
        public usedComponents: Map<
            string | undefined,
            UsedComponent[]
        > = new Map(),
    ) {}

    public setUsedComponents(components: Map<string, UsedComponent[]>): void {
        this.usedComponents = new Map([...this.usedComponents, ...components]);
    }
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
