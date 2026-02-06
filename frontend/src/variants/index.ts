import type { VariantComponents } from "./contracts";

const cosmicLoader = async () => (await import("./cosmic")).variantComponents;

export async function loadVariant(): Promise<VariantComponents> {
    return cosmicLoader();
}
