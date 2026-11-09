import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import worker from '../functions/worker.mjs';

/* =========================================================
   TEMPMAIL — DIAGNOSTIK & KETERBACAAAN ERROR
   ---------------------------------------------------------
   Regresi untuk error generik "Gagal memproses TempMail.
   Periksa konfigurasi Supabase dan provider.":
   1. action=diagnostics melaporkan tiap tahap tanpa secret.
   2. Kegagalan PostgREST memberi hint migrasi (PGRST205).
   3. action=status kompatibel dengan action=alias.
   4. detail error disamarkan (token tidak bocor).
   5. Tombol "Cek Konfigurasi" terpasang di /email.html.
   6. 404 pada endpoint opsional /api/providers TIDAK dianggap rusak.
========================================================= */

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

function makeHarness(options = {}) {
    const state = {
        aliases: new Map(),
        providerCreates: [],
        calls: []
    };
    const providerPost = options.providerPost || (async () => Response.json({
        email: 'alias@gmail.com',
        token: 'tok-1',
        provider: 'gmail'
    }));
    const providerList = options.providerList || (async () => Response.json([
        { name: 'gmail', disabled: false, failures: 0 },
        { name: 'mail.tm', disabled: false, failures: 0 }
    ]));
    const healthProbe = options.healthProbe ||
        (async () => Response.json({ healthy: true, providers: {} }));
    const openapiProbe = options.openapiProbe || (async () => Response.json({
        paths: {
            '/api/email': {},
            '/api/email/{email}/messages': {},
            '/api/email/{email}/message/{message_id}': {},
            '/api/health': {},
            '/api/providers': {}
        }
    }));

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
                if (options.aliasGet) {
                    const override = options.aliasGet(url, state);
                    if (override) return override;
                }
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
                return Response.json([alias], { status: 201 });
            }
        }

        if (url.pathname === '/api/email' && method === 'POST') {
            state.providerCreates.push(url);
            return providerPost(url, fetchOptions, state);
        }

        if (url.pathname === '/api/health') {
            return healthProbe(url, fetchOptions, state);
        }

        if (url.pathname === '/openapi.json') {
            return openapiProbe(url, fetchOptions, state);
        }

        if (url.pathname === '/api/providers') {
            return providerList(url, fetchOptions, state);
        }

        if (url.pathname.includes('/messages') || url.pathname.includes('/message/')) {
            return Response.json([]);
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    return { state, restore: () => { globalThis.fetch = originalFetch; } };
}

test('action=diagnostics melaporkan config, Supabase, dan provider tanpa secret', async () => {
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
        assert.equal(data.config.preferred_provider, 'gmail,auto');
        assert.deepEqual(
            data.checks.map(check => check.name),
            ['supabase_profiles', 'supabase_aliases_table', 'tempmail_provider']
        );
        assert.ok(data.checks.every(check => check.ok));
        assert.ok(data.checks[2].providers.some(item => item.name === 'gmail'));
        assert.doesNotMatch(JSON.stringify(data), /service-role-key|public-key|tok-1/);
    } finally {
        h.restore();
    }
});

test('diagnostics tetap menjawab (bukan 500) saat TEMPMAIL_API_URL kosong', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv({ TEMPMAIL_API_URL: '' }));
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, false);
        assert.equal(data.config.tempmail_api_url, false);
        assert.match(
            data.checks.find(check => check.name === 'tempmail_provider').hint,
            /TEMPMAIL_API_URL/
        );
        assert.equal(h.state.providerCreates.length, 0);
    } finally {
        h.restore();
    }
});

test('diagnostics memberi hint migrasi saat PostgREST membalas PGRST205', async () => {
    const h = makeHarness({
        aliasGet: (url) => {
            // Hanya probe schema cache (tanpa user_id) yang gagal.
            if (url.searchParams.has('user_id')) return null;
            return Response.json({
                code: 'PGRST205',
                message: 'Could not find the table public.tempmail_user_aliases in the schema cache'
            }, { status: 404 });
        }
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'supabase_aliases_table');

        assert.equal(res.status, 200);
        assert.equal(data.ok, false);
        assert.equal(check.ok, false);
        assert.equal(check.status, 404);
        assert.match(check.detail, /PGRST205/);
        assert.match(check.hint, /tempmail-user-aliases\.sql/);
        assert.match(check.hint, /reload schema/);
    } finally {
        h.restore();
    }
});

test('diagnostics memperingatkan bila semua provider nonaktif', async () => {
    const h = makeHarness({
        providerList: async () => Response.json([
            { name: 'gmail', disabled: true, failures: 3 },
            { name: 'mail.tm', disabled: true, failures: 1 }
        ])
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(check.ok, true);
        assert.equal(check.providers.length, 2);
        assert.match(check.hint, /\/api\/providers\/\{name\}\/enable/);
    } finally {
        h.restore();
    }
});

test('action=status kompatibel dengan action=alias (tanpa membuat email baru)', async () => {
    const h = makeHarness();
    h.state.aliases.set('admin-a', {
        user_id: 'admin-a',
        email: 'saved@gmail.com',
        token: 'tok-saved',
        provider: 'gmail',
        created_at: '2026-11-08T10:00:00.000Z'
    });
    try {
        const statusRes = await worker.fetch(makeRequest('status'), baseEnv());
        const statusData = await statusRes.json();
        const aliasRes = await worker.fetch(makeRequest('alias'), baseEnv());
        const aliasData = await aliasRes.json();

        assert.equal(statusRes.status, 200);
        assert.equal(statusData.email, 'saved@gmail.com');
        assert.equal(statusData.provider, 'gmail');
        assert.deepEqual(statusData, aliasData);
        assert.equal(h.state.providerCreates.length, 0);
    } finally {
        h.restore();
    }
});

test('detail error provider disamarkan agar token tidak bocor ke browser', async () => {
    const h = makeHarness({
        providerPost: async () => Response.json({
            detail: "Provider 'gmail' failed: token=supersecret123 api_key=another-secret"
        }, { status: 503 })
    });
    try {
        const res = await worker.fetch(makeRequest('create'), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 502);
        assert.match(data.error, /Gagal membuat email TempMail/);
        assert.match(data.error, /HTTP 503/);
        assert.doesNotMatch(data.error, /supersecret123|another-secret/);
        assert.match(data.error, /disamarkan/);
        assert.equal(h.state.aliases.size, 0);
        assert.equal(h.state.providerCreates.length, 2, 'gmail lalu auto');
    } finally {
        h.restore();
    }
});

test('404 pada /api/providers tidak membatalkan diagnostik bila /api/health hidup', async () => {
    const h = makeHarness({
        providerList: async () => new Response('<html>Not Found</html>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' }
        })
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(res.status, 200);
        assert.equal(data.ok, true, 'endpoint opsional 404 bukan kerusakan');
        assert.equal(check.ok, true);
        assert.equal(check.status, 200, 'status utama diambil dari probe 2xx');
        assert.match(check.hint, /opsional/);
        assert.match(check.hint, /BUKAN kerusakan/);
        assert.ok(check.endpoints.some(item => item.path === '/api/providers' && item.status === 404));
        assert.equal(check.capabilities.create_email, true);
        assert.equal(check.providers.length, 0);
    } finally {
        h.restore();
    }
});

test('openapi.json saja cukup membuktikan API TempMail-MCP saat introspection 404', async () => {
    const html404 = async () => new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
    });
    const h = makeHarness({
        healthProbe: html404,
        providerList: html404,
        openapiProbe: async () => Response.json({ paths: { '/api/email': {}, '/api/email/{email}/messages': {} } })
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.ok, true);
        assert.equal(check.capabilities.create_email, true);
        assert.equal(check.capabilities.messages, true);
        assert.match(check.hint, /opsional/);
    } finally {
        h.restore();
    }
});

test('semua probe non-JSON 404 tetap dilaporkan gagal dengan petunjuk URL dasar', async () => {
    const html404 = async () => new Response('<html>Not Found</html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
    });
    const h = makeHarness({
        healthProbe: html404,
        providerList: html404,
        openapiProbe: html404
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.ok, false);
        assert.equal(check.ok, false);
        assert.match(check.hint, /URL dasar API TempMail-MCP/);
        assert.match(check.detail, /\/api\/providers=404 \(non-JSON\)/);
        assert.doesNotMatch(check.detail, /supersecret/);
    } finally {
        h.restore();
    }
});

test('TEMPMAIL_API_URL yang menunjuk ke domain aplikasi sendiri terdeteksi', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: 'https://app.test' })
        );
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.config.tempmail_api_self_reference, true);
        assert.equal(data.ok, false);
        assert.equal(check.ok, false);
        assert.match(check.hint, /domain aplikasi ini sendiri/);
    } finally {
        h.restore();
    }
});

test('tombol Cek Konfigurasi dan dokumentasi diagnostik terpasang', () => {
    const page = fs.readFileSync(path.join(ROOT, 'email.html'), 'utf8');
    assert.match(page, /id="btn-diagnostics"/);
    assert.match(page, /action=diagnostics/);
    assert.match(page, /renderDiagnostics/);
    assert.match(page, /textContent/);

    const nav = fs.readFileSync(path.join(ROOT, 'navigation/navigation.js'), 'utf8');
    assert.match(nav, /label: "TempMail", href: "\/email\.html"/);

    const setup = fs.readFileSync(path.join(ROOT, 'TEMPMAIL-SETUP.md'), 'utf8');
    assert.match(setup, /action=diagnostics/);
    assert.match(setup, /docs\/tempmail-setup\.md/);
    assert.match(setup, /api\/providers/);

    assert.match(page, /check\.endpoints/);
    assert.match(page, /endpoint opsional/);

    const doc = fs.readFileSync(path.join(ROOT, 'docs/tempmail-setup.md'), 'utf8');
    assert.match(doc, /action=diagnostics/);
    assert.match(doc, /api\/providers/);

    const example = fs.readFileSync(path.join(ROOT, '.dev.vars.example'), 'utf8');
    assert.match(example, /action=diagnostics/);

    const checker = fs.readFileSync(path.join(ROOT, 'scripts/check-local-dev-vars.mjs'), 'utf8');
    assert.match(checker, /FEATURE_FLAGS/);
    assert.match(checker, /TEMPMAIL_API_URL/);

    const sql = fs.readFileSync(path.join(ROOT, 'supabase/tempmail-user-aliases.sql'), 'utf8');
    assert.match(sql, /pg_notify\('pgrst', 'reload schema'\)/);

    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    assert.match(readme, /diagnostics/);
});
