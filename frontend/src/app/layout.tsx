import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
    themeColor: "#030712",
};

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${geist.variable}`} suppressHydrationWarning style={{ backgroundColor: "#030712" }}>
            <head>
                <meta name="theme-color" content="#030712" media="(prefers-color-scheme: dark)" />
                <meta name="theme-color" content="#030712" media="(prefers-color-scheme: light)" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <style dangerouslySetInnerHTML={{ __html: `
                    html, body {
                        background: #030712 !important;
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
                        background: #030712;
                        z-index: -9999;
                        pointer-events: none;
                    }
                ` }} />
            </head>
            <body style={{ background: "#030712", margin: 0 }}>
                <div id="bg-layer" aria-hidden="true" />
                <ErrorBoundary>
                    <AuthProvider>{children}</AuthProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
