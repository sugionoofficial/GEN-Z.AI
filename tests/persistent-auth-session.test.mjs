import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT = process.cwd();
const SUPABASE_URL = "https://ycovbqmezhrvzobxqnyp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dnOcQubqXG_iGvUMTPCuUw_fU0gkaYm";
const AUTH_STORAGE_KEY = "sb-ycovbqmezhrvzobxqnyp-auth-token";
const BACKUP_STORAGE_KEY = "genz-auth-session-v1";
const PROFILE_CACHE_KEY = "genz-auth-profile-cache-v1";

function makeJwt(payloadObj) {
    const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString(
        "base64url"
    );
    return `${header}.${payload}.signature`;
}

function createStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(String(key), String(value)),
        removeItem: key => store.delete(String(key)),
        clear: () => store.clear(),
        dump: () => Object.fromEntries(store.entries())
    };
}

function createMockElement(tagName = "div") {
    const classes = new Set();
    const attrs = new Map();
    const listeners = new Map();
    const el = {
        tagName: String(tagName).toUpperCase(),
        id: "",
        href: "",
        src: "",
        type: "",
        textContent: "",
        innerHTML: "",
        hidden: false,
        disabled: false,
        style: {},
        dataset: {},
        children: [],
        classList: {
            add: (...names) => names.forEach(n => classes.add(n)),
            remove: (...names) => names.forEach(n => classes.delete(n)),
            toggle: (name, force) => {
                if (force === undefined) {
                    if (classes.has(name)) {
                        classes.delete(name);
                        return false;
                    }
                    classes.add(name);
                    return true;
                }
                if (force) classes.add(name);
                else classes.delete(name);
                return Boolean(force);
            },
            contains: name => classes.has(name)
        },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        remove() {},
        addEventListener(event, fn) {
            const list = listeners.get(event) || [];
            list.push(fn);
            listeners.set(event, list);
        },
        removeEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        click() {
            for (const fn of listeners.get("click") || []) {
                fn({ preventDefault() {} });
            }
        }
    };
    return el;
}

function createDomSandbox({
    pathname = "/user/dashboard.html",
    search = "",
    storageSeed = {},
    fetchImpl,
    supabaseProfile,
    onCreateClient
}) {
    const localStorage = createStorage(storageSeed);
    const sessionStorage = createStorage();
    const elementsById = new Map();
    const redirects = [];
    const setSessionCalls = [];
    let signOutCount = 0;

    for (const id of [
        "loginForm",
        "loginButton",
        "loginButtonText",
        "loginSpinner",
        "loginMessage",
        "emailLinkButton",
        "loginStatusHologram",
        "loginStatusHologramText",
        "closeLoginStatusHologram",
        "genz-navigation"
    ]) {
        const el = createMockElement(id === "loginForm" ? "form" : "div");
        el.id = id;
        elementsById.set(id, el);
    }

    const navLoginAnchor = createMockElement("a");
    navLoginAnchor.href = "/login.html";
    navLoginAnchor.textContent = "Login";

    const location = {
        origin: "https://genzai.genzai-f37.workers.dev",
        pathname,
        search,
        hash: "",
        get href() {
            return `${this.origin}${this.pathname}${this.search}${this.hash}`;
        },
        set href(next) {
            redirects.push(String(next));
        },
        replace(next) {
            redirects.push(String(next));
        }
    };

    const document = {
        readyState: "complete",
        hidden: false,
        documentElement: createMockElement("html"),
        head: createMockElement("head"),
        body: createMockElement("body"),
        createElement: tag => createMockElement(tag),
        getElementById: id => elementsById.get(id) || null,
        querySelector: selector =>
            selector === ".nav-login" ? navLoginAnchor : null,
        querySelectorAll: () => [],
        addEventListener() {},
        removeEventListener() {}
    };

    const windowObj = {
        location,
        document,
        localStorage,
        sessionStorage,
        GENZ_CONFIG: {
            SITE_URL: location.origin,
            SUPABASE_URL,
            SUPABASE_KEY
        },
        crypto: {
            randomUUID: () => "00000000-0000-4000-8000-000000000001"
        },
        fetch: fetchImpl,
        atob: b64 => Buffer.from(b64, "base64").toString("binary"),
        btoa: bin => Buffer.from(bin, "binary").toString("base64"),
        setTimeout: (fn, _ms) => {
            fn();
            return 1;
        },
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        addEventListener() {},
        removeEventListener() {},
        supabase: {
            createClient(_url, _key, options) {
                onCreateClient?.(options, localStorage.dump());
                let currentSession = null;
                const raw = localStorage.getItem(AUTH_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    // Mirrors real @supabase/auth-js _isValidSession check!
                    if (
                        typeof parsed.access_token === "string" &&
                        typeof parsed.refresh_token === "string" &&
                        typeof parsed.expires_at === "number"
                    ) {
                        currentSession = parsed;
                    } else {
                        localStorage.removeItem(AUTH_STORAGE_KEY);
                    }
                }
                return {
                    realtime: { setAuth() {} },
                    auth: {
                        async getSession() {
                            return {
                                data: { session: currentSession },
                                error: null
                            };
                        },
                        async setSession({ access_token, refresh_token }) {
                            setSessionCalls.push({
                                access_token,
                                refresh_token
                            });
                            currentSession = {
                                ...(currentSession || {}),
                                access_token,
                                refresh_token
                            };
                            return {
                                data: { session: currentSession },
                                error: null
                            };
                        },
                        async getUser() {
                            return {
                                data: { user: currentSession?.user || null },
                                error: null
                            };
                        },
                        onAuthStateChange() {
                            return {
                                data: { subscription: { unsubscribe() {} } }
                            };
                        },
                        async signOut() {
                            signOutCount += 1;
                            currentSession = null;
                            localStorage.removeItem(AUTH_STORAGE_KEY);
                            return { error: null };
                        }
                    },
                    from(table) {
                        const row =
                            typeof supabaseProfile === "function"
                                ? supabaseProfile(table)
                                : supabaseProfile;
                        const query = {
                            select: () => query,
                            eq: () => query,
                            lt: async () => ({ error: null }),
                            delete: () => query,
                            upsert: async () => ({ error: null }),
                            maybeSingle: async () => ({
                                data: row || null,
                                error: null
                            }),
                            then(resolve, reject) {
                                return Promise.resolve({
                                    data: row ? [row] : [],
                                    error: null
                                }).then(resolve, reject);
                            }
                        };
                        return query;
                    }
                };
            }
        }
    };

    windowObj.window = windowObj;
    windowObj.URL = URL;
    windowObj.URLSearchParams = URLSearchParams;
    windowObj.Event = Event;
    windowObj.CustomEvent = CustomEvent;
    windowObj.dispatchEvent = () => true;
    windowObj.console = console;

    return {
        context: vm.createContext(windowObj),
        windowObj,
        localStorage,
        redirects,
        setSessionCalls,
        navLoginAnchor,
        getSignOutCount: () => signOutCount
    };
}

test("navigation.js refreshes expired access_token (secondsUntilExpiry < 0) without logging user out, deduplicates concurrent refreshes, and cleans everything on explicit Logout", async () => {
    const navCode = fs.readFileSync(
        path.join(ROOT, "navigation/navigation.js"),
        "utf8"
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const expiredJwt = makeJwt({ sub: "user-123", exp: nowSec - 86400 }); // expired 24 hours ago!
    const freshJwt = makeJwt({ sub: "user-123", exp: nowSec + 604800 }); // fresh 7-day token!

    let refreshNetworkCalls = 0;

    // Also omit expires_at intentionally to prove legacy corrupted sessions self-heal!
    const seedSession = {
        access_token: expiredJwt,
        refresh_token: "rt-initial-123",
        user: { id: "user-123", email: "member@genz.ai" }
    };

    const env = createDomSandbox({
        pathname: "/generate/index.html",
        storageSeed: {
            [AUTH_STORAGE_KEY]: JSON.stringify(seedSession)
        },
        supabaseProfile: {
            id: "user-123",
            email: "member@genz.ai",
            name: "Member",
            role: "USER",
            credits: 250,
            status: "active"
        },
        fetchImpl: async url => {
            assert.match(String(url), /grant_type=refresh_token/);
            refreshNetworkCalls += 1;
            await new Promise(r => setTimeout(r, 15));
            return {
                ok: true,
                status: 200,
                async json() {
                    // Real GoTrue response returns expires_in without expires_at!
                    return {
                        access_token: freshJwt,
                        token_type: "bearer",
                        expires_in: 604800,
                        refresh_token: "rt-rotated-456",
                        user: { id: "user-123", email: "member@genz.ai" }
                    };
                }
            };
        }
    });

    vm.runInContext(navCode, env.context);
    const ready = await env.windowObj.GENZNavigationReady;

    assert.equal(ready, true, "User must remain authenticated after 24h idle");
    assert.equal(env.redirects.length, 0, "Must NOT redirect away to login");
    assert.equal(refreshNetworkCalls, 1, "Must exchange refresh_token exactly once");

    const saved = JSON.parse(env.localStorage.getItem(AUTH_STORAGE_KEY));
    assert.equal(saved.access_token, freshJwt);
    assert.equal(saved.refresh_token, "rt-rotated-456");
    assert.equal(typeof saved.expires_at, "number");
    assert.ok(saved.expires_at > nowSec + 600000);
    assert.ok(env.localStorage.getItem(BACKUP_STORAGE_KEY));
    assert.ok(env.localStorage.getItem(PROFILE_CACHE_KEY));

    // Fire 5 parallel forced refreshes to verify single-flight deduplication
    const parallel = await Promise.all([
        env.windowObj.GENZSession.ensureFreshSession({ force: true }),
        env.windowObj.GENZSession.ensureFreshSession({ force: true }),
        env.windowObj.GENZSession.ensureFreshSession({ force: true }),
        env.windowObj.GENZSession.ensureFreshSession({ force: true }),
        env.windowObj.GENZSession.ensureFreshSession({ force: true })
    ]);
    assert.equal(
        refreshNetworkCalls,
        2,
        "5 concurrent refresh requests must deduplicate into 1 HTTP call"
    );
    assert.equal(parallel.length, 5);

    // Explicit Logout must wipe ALL auth & backup keys completely
    await env.windowObj.GENZNavigation.logout();
    assert.equal(env.localStorage.getItem(AUTH_STORAGE_KEY), null);
    assert.equal(env.localStorage.getItem(BACKUP_STORAGE_KEY), null);
    assert.equal(env.localStorage.getItem(PROFILE_CACHE_KEY), null);
    assert.deepEqual(env.redirects, ["/index.html"]);
});

test("assets/js/auth.js automatically resumes refreshable session on /login.html and redirects directly to dashboard without asking email & password", async () => {
    const authCode = fs.readFileSync(
        path.join(ROOT, "assets/js/auth.js"),
        "utf8"
    );
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredAdminJwt = makeJwt({
        sub: "admin-001",
        exp: nowSec - 172800
    });
    const freshAdminJwt = makeJwt({
        sub: "admin-001",
        exp: nowSec + 604800
    });

    const env = createDomSandbox({
        pathname: "/login.html",
        storageSeed: {
            [AUTH_STORAGE_KEY]: JSON.stringify({
                access_token: expiredAdminJwt,
                expires_at: nowSec - 172800,
                refresh_token: "admin-rt-1",
                user: { id: "admin-001", email: "admin@genz.ai" }
            })
        },
        supabaseProfile: {
            id: "admin-001",
            email: "admin@genz.ai",
            name: "Admin",
            role: "ADMIN",
            credits: 9999,
            status: "active"
        },
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
                return {
                    access_token: freshAdminJwt,
                    token_type: "bearer",
                    expires_in: 604800,
                    refresh_token: "admin-rt-2",
                    user: { id: "admin-001", email: "admin@genz.ai" }
                };
            }
        })
    });

    vm.runInContext(authCode, env.context);
    await new Promise(r => setTimeout(r, 30));

    assert.deepEqual(
        env.redirects,
        ["admin/dashboard/index.html"],
        "Opening /login.html with an active/refreshable session must go straight to dashboard"
    );
});

test("index.html auto-resume script immediately redirects returning logged-in users to their dashboard and stays on landing after Logout", async () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const match = indexHtml.match(
        /<script>\s*(\/\* =========================================================\s*GEN-Z\.AI PERSISTENT SESSION AUTO-RESUME[\s\S]*?)<\/script>/
    );
    assert.ok(match, "Auto-resume script must exist in index.html <head>");
    const headScript = match[1];

    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Logged-in user opens "/" after 3 days (expired JWT + valid refresh_token) -> auto refresh + redirect!
    const loggedInEnv = createDomSandbox({
        pathname: "/",
        storageSeed: {
            [AUTH_STORAGE_KEY]: JSON.stringify({
                access_token: makeJwt({ sub: "u-99", exp: nowSec - 259200 }),
                expires_at: nowSec - 259200,
                refresh_token: "user-rt-valid",
                user: { id: "u-99", email: "u99@genz.ai" }
            })
        },
        fetchImpl: async url => {
            if (String(url).includes("grant_type=refresh_token")) {
                return {
                    ok: true,
                    status: 200,
                    async json() {
                        return {
                            access_token: makeJwt({
                                sub: "u-99",
                                exp: nowSec + 604800
                            }),
                            expires_in: 604800,
                            refresh_token: "user-rt-next",
                            user: { id: "u-99", email: "u99@genz.ai" }
                        };
                    }
                };
            }
            return {
                ok: true,
                status: 200,
                async json() {
                    return [
                        {
                            id: "u-99",
                            email: "u99@genz.ai",
                            role: "USER",
                            credits: 100,
                            status: "active"
                        }
                    ];
                }
            };
        }
    });

    vm.runInContext(headScript, loggedInEnv.context);
    await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(loggedInEnv.redirects, ["/user/dashboard.html"]);

    // 2. Logged-out visitor opens "/" -> stays on landing page with 0 redirects!
    const loggedOutEnv = createDomSandbox({
        pathname: "/",
        storageSeed: {},
        fetchImpl: async () => {
            throw new Error("Should not fetch for anonymous visitor");
        }
    });
    vm.runInContext(headScript, loggedOutEnv.context);
    assert.deepEqual(loggedOutEnv.redirects, []);
});

test("transient network/503 failure never wipes refresh_token, whereas explicit HTTP 401 invalid_grant cleans session cleanly", async () => {
    const navCode = fs.readFileSync(
        path.join(ROOT, "navigation/navigation.js"),
        "utf8"
    );
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredJwt = makeJwt({ sub: "user-777", exp: nowSec - 7200 });

    // Case A: Transient 503 during token refresh preserves refresh_token & session
    const offlineEnv = createDomSandbox({
        pathname: "/user/dashboard.html",
        storageSeed: {
            [AUTH_STORAGE_KEY]: JSON.stringify({
                access_token: expiredJwt,
                expires_at: nowSec - 7200,
                refresh_token: "rt-survives-offline",
                user: { id: "user-777", email: "resilient@genz.ai" }
            }),
            [PROFILE_CACHE_KEY]: JSON.stringify({
                id: "user-777",
                email: "resilient@genz.ai",
                role: "USER",
                credits: 50,
                status: "active"
            })
        },
        supabaseProfile: {
            id: "user-777",
            email: "resilient@genz.ai",
            role: "USER",
            credits: 50,
            status: "active"
        },
        fetchImpl: async () => ({
            ok: false,
            status: 503,
            async json() {
                return { message: "Service temporarily unavailable" };
            }
        })
    });

    vm.runInContext(navCode, offlineEnv.context);
    const survived = await offlineEnv.windowObj.GENZNavigationReady;
    assert.equal(survived, true);
    assert.equal(offlineEnv.redirects.length, 0);
    assert.equal(
        JSON.parse(offlineEnv.localStorage.getItem(AUTH_STORAGE_KEY))
            .refresh_token,
        "rt-survives-offline"
    );

    // Case B: Server 401 (revoked refresh token) cleans all keys and redirects to /index.html
    const revokedEnv = createDomSandbox({
        pathname: "/user/dashboard.html",
        storageSeed: {
            [AUTH_STORAGE_KEY]: JSON.stringify({
                access_token: expiredJwt,
                expires_at: nowSec - 7200,
                refresh_token: "rt-revoked",
                user: { id: "user-777", email: "resilient@genz.ai" }
            })
        },
        fetchImpl: async () => ({
            ok: false,
            status: 401,
            async json() {
                return { error: "invalid_grant" };
            }
        })
    });

    vm.runInContext(navCode, revokedEnv.context);
    const revokedReady = await revokedEnv.windowObj.GENZNavigationReady;
    assert.equal(revokedReady, false);
    assert.equal(revokedEnv.localStorage.getItem(AUTH_STORAGE_KEY), null);
    assert.equal(revokedEnv.localStorage.getItem(BACKUP_STORAGE_KEY), null);
    assert.deepEqual(revokedEnv.redirects, ["/index.html"]);
});

