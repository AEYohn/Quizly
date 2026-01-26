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
                <meta name="theme-color" content="#030712" />
                <meta name="msapplication-navbutton-color" content="#030712" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <style dangerouslySetInnerHTML={{ __html: `
                    html, body, #__next { background: #030712 !important; }
                    * { margin: 0; padding: 0; }
                ` }} />
            </head>
            <body className="min-h-dvh" style={{ backgroundColor: "#030712", margin: 0, padding: 0 }}>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
