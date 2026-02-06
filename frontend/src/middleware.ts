import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/auth/callback(.*)",  // Auth callback after sign-in/sign-up
    "/join(.*)",           // Student join page for live sessions
    "/play(.*)",           // Game play pages
    "/explore(.*)",        // Public explore/marketplace
    "/practice(.*)",       // Public quiz practice (shareable links)
    "/learn(.*)",          // Conversational learning + scroll mode
    "/compete(.*)",        // Leaderboard / compete
    "/feed(.*)",           // TikTok-style feed with tabs
    // "/v/(.*)" removed — single design, no variant routes
    "/progress(.*)",       // Learning progress dashboard
    "/api/webhooks(.*)",   // Webhooks
]);

// Define routes that should be completely ignored by Clerk
const isIgnoredRoute = createRouteMatcher([
    "/api/health(.*)",
    "/_next(.*)",
    "/favicon.ico",
    "/static(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
    // Skip ignored routes
    if (isIgnoredRoute(request)) {
        return;
    }

    // Protect non-public routes
    if (!isPublicRoute(request)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
