import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/lib/auth";

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
                    html {
                        background: #030712;
                        height: 100%;
                    }
                    body {
                        background: #030712;
                        min-height: 100%;
                        min-height: 100dvh;
                        margin: 0;
                        padding: 0;
                    }
                    /* iOS Safari overscroll areas */
                    @supports (-webkit-touch-callout: none) {
                        body::before {
                            content: "";
                            position: fixed;
                            top: -100vh;
                            left: 0;
                            right: 0;
                            height: 200vh;
                            background: #030712;
                            z-index: -1;
                        }
                    }
                ` }} />
            </head>
            <body style={{ background: "#030712", margin: 0 }}>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
