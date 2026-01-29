"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { type ReactNode } from "react";

/**
 * Wrapper for ClerkProvider.
 * Note: Pages using Clerk auth should export `dynamic = 'force-dynamic'`
 * to prevent prerendering issues with placeholder keys in CI.
 */
export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
    return <ClerkProvider>{children}</ClerkProvider>;
}
