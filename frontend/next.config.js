/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    async redirects() {
        return [
            { source: "/learn/scroll", destination: "/feed", permanent: true },
            { source: "/compete", destination: "/feed", permanent: true },
            { source: "/student/learning", destination: "/student/dashboard", permanent: true },
            { source: "/student/inbox", destination: "/student/dashboard", permanent: true },
            { source: "/student/study", destination: "/student/dashboard", permanent: true, missing: [{ type: "query", key: "redirect", value: "false" }] },
            { source: "/login", destination: "/sign-in", permanent: true },
            { source: "/register", destination: "/sign-up", permanent: true },
            { source: "/progress", destination: "/feed", permanent: true },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "img.clerk.com",
            },
            {
                protocol: "https",
                hostname: "images.clerk.dev",
            },
            {
                protocol: "https",
                hostname: "*.googleusercontent.com",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
    },
};

export default config;
