import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { ClerkProviderWrapper } from "@/components/ClerkProviderWrapper";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryProvider } from "@/lib/QueryProvider";

// Force dynamic rendering for all pages to handle Clerk auth during CI builds
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Quizly",
    description: "AI-powered peer instruction platform",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Quizly",
    },
    other: {
        "apple-mobile-web-app-capable": "yes",
        "mobile-web-app-capable": "yes",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    themeColor: "#0A0A0A",
};

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${geist.variable}`} suppressHydrationWarning style={{ backgroundColor: "#0A0A0A" }}>
            <head>
                <meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
                <meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: light)" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <style dangerouslySetInnerHTML={{ __html: `
                    html, body {
                        background: #0A0A0A !important;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        min-height: 100vh;
                        min-height: 100dvh;
                    }
                    /* Fixed background layer for iOS overscroll */
                    #bg-layer {
                        position: fixed;
                        inset: -200vh -50vw;
                        background: #0A0A0A;
                        z-index: -9999;
                        pointer-events: none;
                    }
                ` }} />
            </head>
            <body style={{ background: "#0A0A0A", margin: 0 }}>
                <div id="bg-layer" aria-hidden="true" />
                <ClerkProviderWrapper>
                    <QueryProvider>
                        <ErrorBoundary>
                            <AuthProvider>{children}</AuthProvider>
                        </ErrorBoundary>
                    </QueryProvider>
                </ClerkProviderWrapper>
            </body>
        </html>
    );
}
