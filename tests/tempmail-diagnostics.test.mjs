import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import worker from '../functions/worker.mjs';

const ROOT = process.cwd();

function baseEnv(overrides = {}) {
    return {
        TEMPMAIL_API_URL: 'https://tempmail.test',
        SUPABASE_URL: 'https://supabase.test',
        SUPABASE_ANON_KEY: 'public-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        ...overrides
    };
}

function makeRequest(action, params = {}, { method, userId = 'admin-a' } = {}) {
    const url = new URL('https://app.test/api/tempmail');
    url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return new Request(url, {
        method: method || (action === 'create' ? 'POST' : 'GET'),
        headers: { Authorization: `Bearer ${userId}` }
    });
}

/** Mock fetch untuk Supabase Auth/REST + server TempMail-MCP. */
function makeHarness(options = {}) {
    const state = {
        aliases: new Map(),
        providerCreates: [],
        providerMessages: [],
        calls: []
    };
    const providerPost = options.providerPost || (async () => Response.json({
        email: 'alias@gmail.com',
        token: 'tok-1',
        provider: 'gmail'
    }));
    const providerGet = options.providerGet || (async () => Response.json([]));
    const providerList = options.providerList || (async () => Response.json([
        { name: 'gmail', disabled: false, failures: 0 },
        { name: 'mail.tm', disabled: false, failures: 0 }
    ]));

    const fetchImpl = async (input, fetchOptions = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = fetchOptions.method || 'GET';
        state.calls.push({ url: url.toString(), method });

        if (url.pathname === '/auth/v1/user') {
            const token = String(fetchOptions.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
            return Response.json({ id: token || 'admin-a', email: 'admin@example.com' });
        }

        if (url.pathname === '/rest/v1/profiles') {
            return Response.json([{ role: options.role || 'admin' }]);
        }

        if (url.pathname === '/rest/v1/tempmail_user_aliases') {
            if (method === 'GET') {
                if (options.aliasGet) return options.aliasGet(url, state);
                // Diagnostik memanggil tabel tanpa filter user_id.
                const userId = String(url.searchParams.get('user_id') || 'eq.admin-a').slice(3);
                const emailFilter = url.searchParams.get('email');
                const alias = state.aliases.get(userId);
                return Response.json(
                    alias && (!emailFilter || emailFilter === `eq.${alias.email}`) ? [alias] : []
                );
            }
            if (method === 'POST') {
                const alias = JSON.parse(fetchOptions.body);
                if (!state.aliases.has(alias.user_id)) state.aliases.set(alias.user_id, alias);
                return new Response(null, { status: 201 });
            }
        }

        if (url.pathname === '/api/email' && method === 'POST') {
            state.providerCreates.push(url);
            return providerPost(url, fetchOptions, state);
        }

        if (url.pathname === '/api/providers') {
            return providerList(url, fetchOptions, state);
        }

        if (url.pathname.includes('/messages') || url.pathname.includes('/message/')) {
            state.providerMessages.push(url);
            return providerGet(url, fetchOptions, state);
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    return { state, restore: () => { globalThis.fetch = originalFetch; } };
}

const GENERIC_ERROR = /Gagal memproses TempMail\. Periksa konfigurasi Supabase dan provider\./;

test('balasan HTML dari provider tidak lagi jadi error generik dan tidak menyimpan alias', async () => {
    const h = makeHarness({
        providerPost: async () => new Response('<html><h1>Bad Gateway</h1></html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' }
        })
    });
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 502);
        assert.match(data.error, /menolak pembuatan email/);
        assert.match(data.error, /HTTP 502/);
        assert.doesNotMatch(data.error, GENERIC_ERROR);
        assert.match(data.detail, /Bad Gateway/);
        assert.match(data.hint, /api\/providers/);
        assert.equal(h.state.aliases.size, 0);
        assert.equal(h.state.providerCreates.length, 1);
    } finally {
        h.restore();
    }
});

test('provider gmail nonaktif (503) otomatis fallback ke provider sehat', async () => {
    const h = makeHarness({
        providerPost: async (url) => {
            if (url.searchParams.get('name') === 'gmail') {
                return Response.json(
                    { detail: "Provider 'gmail' failed: IMAP login failed" },
                    { status: 503 }
                );
            }
            return Response.json({
                email: 'fallback@mail.tm',
                token: 'tok-fallback',
                provider: 'mail.tm'
            });
        }
    });
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.email, 'fallback@mail.tm');
        assert.equal(data.provider, 'mail.tm');
        assert.equal(h.state.providerCreates.length, 2);
        assert.equal(h.state.aliases.get('admin-a').provider, 'mail.tm');

        const inbox = await worker.fetch(
            makeRequest('messages', { email: data.email }),
            baseEnv()
        );
        assert.equal(inbox.status, 200);
        assert.equal(h.state.providerMessages[0].searchParams.get('name'), 'mail.tm');
        assert.equal(h.state.providerMessages[0].searchParams.get('token'), 'tok-fallback');
    } finally {
        h.restore();
    }
});

test('TEMPMAIL_PROVIDER=auto tidak memaksa query name=gmail', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv({ TEMPMAIL_PROVIDER: 'auto' }));
        assert.equal(res.status, 200);
        assert.equal(h.state.providerCreates.length, 1);
        assert.equal(h.state.providerCreates[0].searchParams.has('name'), false);
    } finally {
        h.restore();
    }
});

test('Supabase REST 404/PGRST205 memberi petunjuk migrasi tabel alias', async () => {
    const h = makeHarness({
        aliasGet: async () => Response.json({
            code: 'PGRST205',
            message: 'Could not find the table public.tempmail_user_aliases in the schema cache'
        }, { status: 404 })
    });
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 502);
        assert.match(data.error, /tempmail_user_aliases/);
        assert.match(data.error, /HTTP 404/);
        assert.match(data.detail, /PGRST205/);
        assert.match(data.hint, /tempmail-user-aliases\.sql/);
        assert.equal(h.state.providerCreates.length, 0);
    } finally {
        h.restore();
    }
});

test('action=status memulihkan alias tersimpan tanpa membuat email baru', async () => {
    const h = makeHarness();
    h.state.aliases.set('admin-a', {
        user_id: 'admin-a',
        email: 'saved@gmail.com',
        token: 'tok-saved',
        provider: 'gmail'
    });
    try {
        const res = await worker.fetch(makeRequest('status'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.email, 'saved@gmail.com');
        assert.equal(data.provider, 'gmail');
        assert.equal(h.state.providerCreates.length, 0);
    } finally {
        h.restore();
    }
});

test('action=diagnostics melaporkan config, Supabase, dan provider tanpa membocorkan secret', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, true);
        assert.equal(data.config.supabase_url, true);
        assert.equal(data.config.supabase_anon_key, true);
        assert.equal(data.config.supabase_service_role_key, true);
        assert.equal(data.config.tempmail_api_url, true);
        assert.equal(data.config.tempmail_api_host, 'tempmail.test');
        assert.equal(data.config.preferred_provider, 'gmail');
        assert.deepEqual(
            data.checks.map(check => check.name),
            ['supabase_profiles', 'supabase_aliases_table', 'tempmail_provider']
        );
        assert.ok(data.checks.every(check => check.ok));
        assert.ok(data.checks[2].providers.some(item => item.name === 'gmail'));
        assert.doesNotMatch(JSON.stringify(data), /service-role-key|public-key/);

        const broken = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: '' })
        );
        const brokenData = await broken.json();
        assert.equal(broken.status, 200);
        assert.equal(brokenData.ok, false);
        assert.equal(brokenData.config.tempmail_api_url, false);
        assert.match(
            brokenData.checks.find(check => check.name === 'tempmail_provider').hint,
            /TEMPMAIL_API_URL/
        );
    } finally {
        h.restore();
    }
});

test('balasan inbox non-JSON diubah menjadi JSON error yang bisa dibaca browser', async () => {
    const h = makeHarness({
        providerGet: async () => new Response('<html>nginx error</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        })
    });
    h.state.aliases.set('admin-a', {
        user_id: 'admin-a',
        email: 'saved@gmail.com',
        token: 'tok-saved',
        provider: 'gmail'
    });
    try {
        const res = await worker.fetch(
            makeRequest('messages', { email: 'saved@gmail.com' }),
            baseEnv()
        );
        const data = await res.json();

        assert.equal(res.status, 502);
        assert.match(data.error, /bukan JSON/);
        assert.match(data.detail, /nginx error/);
        assert.match(res.headers.get('content-type') || '', /application\/json/);
    } finally {
        h.restore();
    }
});

test('timeout provider dilaporkan sebagai 504, bukan error generik', async () => {
    const h = makeHarness({
        providerPost: async (url, fetchOptions) => new Promise((_, reject) => {
            fetchOptions.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    });
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv({ TEMPMAIL_TIMEOUT_MS: 60 }));
        const data = await res.json();

        assert.equal(res.status, 504);
        assert.match(data.error, /tidak merespons/);
        assert.doesNotMatch(data.error, GENERIC_ERROR);
        assert.equal(h.state.aliases.size, 0);
    } finally {
        h.restore();
    }
});

test('tautan navigasi TempMail, build asset, dan halaman tetap terpasang', () => {
    const nav = fs.readFileSync(path.join(ROOT, 'navigation/navigation.js'), 'utf8');
    assert.match(nav, /label: "TempMail", href: "\/email\.html"/);

    const build = fs.readFileSync(path.join(ROOT, 'scripts/build-cloudflare-pages.mjs'), 'utf8');
    assert.match(build, /"email\.html"/);

    const page = fs.readFileSync(path.join(ROOT, 'email.html'), 'utf8');
    assert.match(page, /\/navigation\/navigation\.js/);
    assert.match(page, /action=status/);
    assert.match(page, /action=diagnostics/);
    assert.match(page, /response\.text\(\)/);
    assert.match(page, /JSON\.parse/);
    assert.match(page, /setAttribute\('sandbox'/);
    assert.doesNotMatch(page, /message-content'\)\.innerHTML/);
});

test('konfigurasi TempMail terdokumentasi untuk dev lokal dan schema cache', () => {
    const example = fs.readFileSync(path.join(ROOT, '.dev.vars.example'), 'utf8');
    assert.match(example, /# TEMPMAIL_API_URL=/);

    const checker = fs.readFileSync(path.join(ROOT, 'scripts/check-local-dev-vars.mjs'), 'utf8');
    assert.match(checker, /FEATURE_FLAGS/);
    assert.match(checker, /TEMPMAIL_API_URL/);

    const sql = fs.readFileSync(path.join(ROOT, 'supabase/tempmail-user-aliases.sql'), 'utf8');
    assert.match(sql, /pg_notify\('pgrst', 'reload schema'\)/);
});
