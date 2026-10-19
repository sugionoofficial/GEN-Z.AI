// Workers Builds runs this package lifecycle hook during dependency installation.
// Preview builds may omit the dashboard Build command, so prepare static assets
// before Wrangler's Preview command reads the assets directory.
if (process.env.WORKERS_CI === "1" && process.env.WORKERS_CI_BRANCH !== "main") {
    await import("./build-cloudflare-pages.mjs");
}
