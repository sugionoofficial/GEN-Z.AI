import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/admin-copilot.js";

const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

function setSupabaseEnv() {
    process.env.SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
}

function makeResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: "",
        status(code) {
            this.statusCode = code;
            return this;
        },
        setHeader(name, value) {
            this.headers[name] = value;
        },
        end(value = "") {
            this.body = value;
            return this;
        }
    };
}

function makeSupabaseFetch(role = "ADMIN") {
    return async url => {
        const requestUrl = new URL(url);
        if (requestUrl.pathname === "/auth/v1/user") {
            return Response.json({ id: "admin-1" });
        }
        if (requestUrl.pathname === "/rest/v1/profiles") {
            return Response.json([{
                id: "admin-1",
                role,
                status: "active"
            }]);
        }
        throw new Error(`Unexpected Supabase request: ${requestUrl.pathname}`);
    };
}

test("Admin Copilot denies non-admin users before accessing GitHub", async () => {
    setSupabaseEnv();
    const previousFetch = globalThis.fetch;
    let githubCalls = 0;
    globalThis.fetch = async (url, options) => {
        if (String(url).startsWith("https://supabase.example/")) {
            return makeSupabaseFetch("USER")(url, options);
        }
        githubCalls += 1;
        throw new Error("GitHub must not be accessed");
    };

    try {
        const response = makeResponse();
        await handler({
            method: "GET",
            query: { action: "tree" },
            headers: { authorization: "Bearer supabase-token" },
            env: { GITHUB_PAT: "secret-test-token" }
        }, response);

        assert.equal(response.statusCode, 403);
        assert.equal(githubCalls, 0);
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test("Admin Copilot creates file commits only on copilot branches", async () => {
    setSupabaseEnv();
    const previousFetch = globalThis.fetch;
    const githubCalls = [];
    globalThis.fetch = async (url, options = {}) => {
        const requestUrl = new URL(url);
        if (requestUrl.origin === "https://supabase.example") {
            return makeSupabaseFetch()(url, options);
        }

        githubCalls.push({ url: requestUrl, options });
        if (requestUrl.pathname.endsWith("/git/ref/heads/main")) {
            return Response.json({ object: { sha: "main-sha" } });
        }
        if (requestUrl.pathname.endsWith("/git/refs")) {
            return Response.json({ ref: "refs/heads/copilot/test-branch" });
        }
        if (requestUrl.pathname.endsWith("/contents/README.md")) {
            if (options.method !== "PUT") {
                return Response.json({ message: "Not Found" }, { status: 404 });
            }
            return Response.json({
                commit: {
                    sha: "commit-sha",
                    html_url: "https://github.com/sugionoofficial/GEN-Z.AI/commit/commit-sha"
                }
            });
        }
        return Response.json({ message: "Not Found" }, { status: 404 });
    };

    try {
        const response = makeResponse();
        await handler({
            method: "POST",
            headers: { authorization: "Bearer supabase-token" },
            env: { GITHUB_PAT: "secret-test-token" },
            body: {
                action: "commit_file",
                path: "README.md",
                content: "Admin Copilot change",
                message: "Update README"
            }
        }, response);

        assert.equal(response.statusCode, 200);
        const result = JSON.parse(response.body);
        assert.equal(result.success, true);
        assert.match(result.branch, /^copilot\/admin-/);
        assert.equal(result.commit.sha, "commit-sha");
        assert.equal(JSON.stringify(result).includes("secret-test-token"), false);

        const createRef = githubCalls.find(call =>
            call.url.pathname.endsWith("/git/refs")
        );
        assert.equal(createRef.options.method, "POST");
        assert.equal(
            JSON.parse(createRef.options.body).ref.startsWith("refs/heads/copilot/"),
            true
        );
        const updateFile = githubCalls.find(call =>
            call.options.method === "PUT"
        );
        assert.equal(updateFile.url.pathname.endsWith("/contents/README.md"), true);
        assert.match(JSON.parse(updateFile.options.body).branch, /^copilot\/admin-/);
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test("Admin Copilot refuses to merge a pull request while CI is failing", async () => {
    setSupabaseEnv();
    const previousFetch = globalThis.fetch;
    const githubPaths = [];
    globalThis.fetch = async (url, options = {}) => {
        const requestUrl = new URL(url);
        if (requestUrl.origin === "https://supabase.example") {
            return makeSupabaseFetch()(url, options);
        }

        githubPaths.push(requestUrl.pathname);
        if (requestUrl.pathname.endsWith("/pulls/42")) {
            return Response.json({
                state: "open",
                base: { ref: "main" },
                head: { ref: "copilot/test", sha: "head-sha" },
                mergeable: true,
                mergeable_state: "clean"
            });
        }
        if (requestUrl.pathname.endsWith("/check-runs")) {
            return Response.json({
                total_count: 1,
                check_runs: [{
                    status: "completed",
                    conclusion: "failure"
                }]
            });
        }
        if (requestUrl.pathname.endsWith("/status")) {
            return Response.json({
                state: "failure",
                total_count: 1,
                statuses: [{ state: "failure" }]
            });
        }
        throw new Error(`Unexpected GitHub request: ${requestUrl.pathname}`);
    };

    try {
        const response = makeResponse();
        await handler({
            method: "POST",
            headers: { authorization: "Bearer supabase-token" },
            env: { GITHUB_PAT: "secret-test-token" },
            body: {
                action: "merge_pull_request",
                pullRequestNumber: 42
            }
        }, response);

        assert.equal(response.statusCode, 409, response.body);
        assert.equal(JSON.parse(response.body).success, false);
        assert.equal(
            githubPaths.some(path => path.endsWith("/pulls/42/merge")),
            false
        );
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test("Admin Copilot checks every CI page before merging", async () => {
    setSupabaseEnv();
    const previousFetch = globalThis.fetch;
    const githubPaths = [];
    globalThis.fetch = async (url, options = {}) => {
        const requestUrl = new URL(url);
        if (requestUrl.origin === "https://supabase.example") {
            return makeSupabaseFetch()(url, options);
        }

        githubPaths.push(requestUrl.pathname + requestUrl.search);
        if (requestUrl.pathname.endsWith("/pulls/43")) {
            return Response.json({
                state: "open",
                base: { ref: "main" },
                head: { ref: "copilot/test", sha: "head-sha" },
                mergeable: true,
                mergeable_state: "clean"
            });
        }
        if (requestUrl.pathname.endsWith("/check-runs")) {
            const page = Number(requestUrl.searchParams.get("page"));
            return Response.json({
                total_count: 101,
                check_runs: page === 1
                    ? Array.from({ length: 100 }, () => ({
                        status: "completed",
                        conclusion: "success"
                    }))
                    : [{
                        status: "in_progress",
                        conclusion: null
                    }]
            });
        }
        if (requestUrl.pathname.endsWith("/status")) {
            return Response.json({
                state: "success",
                total_count: 0,
                statuses: []
            });
        }
        throw new Error(`Unexpected GitHub request: ${requestUrl.pathname}`);
    };

    try {
        const response = makeResponse();
        await handler({
            method: "POST",
            headers: { authorization: "Bearer copilot-test-session" },
            env: { GITHUB_PAT: "secret-test-token" },
            body: {
                action: "merge_pull_request",
                pullRequestNumber: 43
            }
        }, response);

        assert.equal(response.statusCode, 409, response.body);
        assert.equal(JSON.parse(response.body).success, false);
        assert.equal(
            githubPaths.some(path => path.includes("check-runs?per_page=100&page=2")),
            true
        );
        assert.equal(
            githubPaths.some(path => path.endsWith("/pulls/43/merge")),
            false
        );
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});
