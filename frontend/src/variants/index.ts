import type { VariantComponents } from "./contracts";

const brilliantLoader = async () => (await import("./brilliant")).variantComponents;

export async function loadVariant(): Promise<VariantComponents> {
    return brilliantLoader();
}
