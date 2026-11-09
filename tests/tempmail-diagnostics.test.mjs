import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
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
   7. 404 HTML pada semua probe membawa cuplikan body + langkah perbaikan.
   8. URL repo GitHub / JSON 404 / UI "endpoint opsional" tidak menyesatkan.
   9. Host port-forward GitHub Codespaces terdeteksi sebagai ephemeral.
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

        if (url.host === 'api.mail.tm' && url.pathname === '/domains') {
            return Response.json({
                'hydra:member': [{ domain: 'mailtm.test', isActive: true, isPrivate: false }]
            });
        }

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

        if (url.pathname.endsWith('/api/health')) {
            return healthProbe(url, fetchOptions, state);
        }

        if (url.pathname.endsWith('/openapi.json')) {
            return openapiProbe(url, fetchOptions, state);
        }

        if (url.pathname.endsWith('/api/providers')) {
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

function extractFunctionSource(source, signature) {
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `Expected to find ${signature}`);
    const openBrace = source.indexOf('{', start);
    assert.notEqual(openBrace, -1, `Expected opening brace for ${signature}`);

    let depth = 0;
    for (let index = openBrace; index < source.length; index += 1) {
        const ch = source[index];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }

    assert.fail(`Unclosed function body for ${signature}`);
}

function renderDiagnosticsLines(data) {
    const page = fs.readFileSync(path.join(ROOT, 'email.html'), 'utf8');
    const appendSrc = extractFunctionSource(page, 'function appendDiagnosticsLine');
    const renderSrc = extractFunctionSource(page, 'function renderDiagnostics');
    const lines = [];
    const makeNode = () => ({
        className: '',
        textContent: '',
        children: [],
        appendChild(child) {
            this.children.push(child);
            lines.push(child);
        },
        replaceChildren() {
            this.children.length = 0;
        },
        classList: { remove() {} }
    });
    const diagnosticsList = makeNode();
    const diagnosticsBox = makeNode();
    const context = vm.createContext({
        document: { createElement: makeNode },
        diagnosticsList,
        diagnosticsBox
    });
    vm.runInContext(
        `let lastDiagnosticsConfig = null;\n${appendSrc}\n${renderSrc}\nthis.renderDiagnostics = renderDiagnostics;`,
        context
    );
    context.renderDiagnostics(data);
    return lines.map(node => String(node.textContent));
}

function allFailDiagnostics() {
    return {
        ok: false,
        config: {
            tempmail_api_url: true,
            tempmail_api_host: 'dead.example.com',
            tempmail_api_base_url: 'https://dead.example.com',
            app_host: 'app.test',
            preferred_provider: 'gmail'
        },
        checks: [{
            name: 'tempmail_provider',
            ok: false,
            status: 404,
            detail: '/api/health=404 (non-JSON)',
            hint: 'Semua endpoint diagnostik membalas non-JSON.',
            endpoints: [
                { path: '/api/health', status: 404, json: false, content_type: 'text/html', sample: 'nginx 404' },
                { path: '/api/providers', status: 404, json: false, content_type: 'text/html', sample: 'nginx 404' },
                { path: '/openapi.json', status: 404, json: false, content_type: 'text/html', sample: 'nginx 404' }
            ],
            steps: ['Verifikasi host', 'Set ulang secret'],
            capabilities: { create_email: false, messages: false, providers: false, health: false },
            providers: []
        }]
    };
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

test('diagnostics tanpa secret dan tanpa flag mailtm tetap minta host persisten untuk @gmail.com', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv({ TEMPMAIL_API_URL: '' }));
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, false);
        assert.equal(data.config.tempmail_api_url, false);
        assert.equal(data.config.builtin_mailtm, false);
        assert.deepEqual(
            data.checks.map(check => check.name),
            ['supabase_profiles', 'supabase_aliases_table', 'tempmail_provider']
        );
        assert.match(data.checks[2].hint, /@gmail\.com/);
        assert.match(data.checks[2].hint, /persisten/);
        assert.equal(h.state.providerCreates.length, 0);
    } finally {
        h.restore();
    }
});

test('diagnostics dengan TEMPMAIL_PROVIDER=mailtm memakai builtin_mailtm', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: '', TEMPMAIL_PROVIDER: 'mailtm' })
        );
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, true);
        assert.equal(data.config.builtin_mailtm, true);
        assert.deepEqual(
            data.checks.map(check => check.name),
            ['supabase_profiles', 'supabase_aliases_table', 'builtin_mailtm']
        );
        assert.ok(data.checks.every(check => check.ok));
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
        assert.match(check.hint, /domain aplikasi GEN-Z\.AI sendiri/);
    } finally {
        h.restore();
    }
});

test('404 HTML pada semua probe membawa content-type, cuplikan body, dan langkah perbaikan', async () => {
    const html404 = async () => new Response(
        '<html><head><title>nginx 404 Not Found</title></head><body><h1>404</h1></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
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
        assert.match(check.endpoints[0].content_type, /text\/html/);
        assert.match(check.endpoints[0].sample, /nginx 404 Not Found/);
        assert.doesNotMatch(check.endpoints[0].sample, /<html>|<title>/);
        assert.match(check.detail, /Cuplikan: nginx 404 Not Found/);
        assert.match(check.hint, /URL dasar API TempMail-MCP/);
        assert.ok(Array.isArray(check.steps) && check.steps.length >= 4);
        assert.ok(check.steps.some(step => step.includes('curl -i')));
        assert.ok(check.steps.some(step => step.includes('secret put TEMPMAIL_API_URL')));
        assert.ok(check.steps.some(step => step.includes('Jangan isi dengan domain aplikasi')));
    } finally {
        h.restore();
    }
});

test('self-reference terdeteksi lewat META_REDIRECT_URI walau host request berbeda', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({
                TEMPMAIL_API_URL: 'https://genzai.genzai-f37.workers.dev',
                META_REDIRECT_URI: 'https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback'
            })
        );
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.config.app_host, 'app.test');
        assert.equal(data.config.tempmail_api_host, 'genzai.genzai-f37.workers.dev');
        assert.equal(data.config.tempmail_api_self_reference, true);
        assert.equal(data.ok, false);
        assert.match(check.hint, /domain aplikasi GEN-Z.AI sendiri/);
        assert.ok(check.steps.some(step => step.includes('curl -i https://genzai')));
    } finally {
        h.restore();
    }
});

test('semua balasan JSON 404 tetap memberi langkah perbaikan, bukan hint generik', async () => {
    const json404 = async () => Response.json({ error: 'Not Found' }, { status: 404 });
    const h = makeHarness({
        healthProbe: json404,
        providerList: json404,
        openapiProbe: json404
    });
    try {
        const res = await worker.fetch(makeRequest('diagnostics'), baseEnv());
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(check.ok, false);
        assert.match(check.hint, /JSON error\/404/);
        assert.match(check.detail, /Not Found/);
        assert.ok(Array.isArray(check.steps) && check.steps.length >= 4);
        assert.ok(check.steps.some(step => step.includes('curl -i')));
        assert.ok(check.steps.some(step => step.includes('secret put TEMPMAIL_API_URL')));
    } finally {
        h.restore();
    }
});

test('URL repo GitHub terdeteksi sebagai bukan host API', async () => {
    const json404 = async () => Response.json({ error: 'Not Found' }, { status: 404 });
    const h = makeHarness({
        healthProbe: json404,
        providerList: json404,
        openapiProbe: json404
    });
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: 'https://github.com/sugionoofficial/Tempmail-MCP' })
        );
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.config.tempmail_api_repository_url, true);
        assert.equal(data.config.tempmail_api_base_url, 'https://github.com/sugionoofficial/Tempmail-MCP');
        assert.equal(check.ok, false);
        assert.match(check.hint, /URL repositori kode/);
        assert.ok(check.steps.some(step => step.includes('git clone')));
        assert.ok(check.steps.some(step => step.includes('docker compose up -d')));
        assert.ok(check.steps.some(step => step.includes('localhost')));
    } finally {
        h.restore();
    }
});

test('config tidak membocorkan userinfo/query secret dan mendukung sub-path', async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: 'https://user:rahasia@tempmail.test/prefix/?token=abc#frag' })
        );
        const data = await res.json();

        assert.equal(data.config.tempmail_api_base_url, 'https://tempmail.test/prefix');
        assert.doesNotMatch(JSON.stringify(data.config), /rahasia|token=abc|frag/);
        assert.ok(data.checks.find(item => item.name === 'tempmail_provider').steps.some(step =>
            step.includes('https://tempmail.test/prefix/api/health')
        ));
    } finally {
        h.restore();
    }
});

test('UI tidak menyebut /api/providers "bukan kerusakan" ketika semua probe gagal', () => {
    const lines = renderDiagnosticsLines(allFailDiagnostics());
    const providerLine = lines.find(line => line.startsWith('Provider:'));

    assert.ok(providerLine, 'Baris Provider harus dirender');
    assert.match(providerLine, /periksa TEMPMAIL_API_URL/);
    assert.doesNotMatch(providerLine, /endpoint opsional|bukan kerusakan/);
});

test('UI tetap menyebut endpoint opsional saat API inti terdeteksi', () => {
    const data = allFailDiagnostics();
    data.ok = false; // Supabase check boleh gagal; provider check yang penting
    const check = data.checks[0];
    check.ok = true;
    check.status = 200;
    check.endpoints[0] = { path: '/api/health', status: 200, json: true };
    check.endpoints[1] = { path: '/api/providers', status: 404, json: false };
    check.endpoints[2] = { path: '/openapi.json', status: 200, json: true };
    check.capabilities = { create_email: true, messages: true, providers: false, health: true };

    const lines = renderDiagnosticsLines(data);
    const providerLine = lines.find(line => line.startsWith('Provider:'));

    assert.ok(providerLine);
    assert.match(providerLine, /endpoint opsional, bukan kerusakan/);
});

test('host *.app.github.dev terdeteksi sebagai port-forward Codespaces yang ephemeral', async () => {
    const html404 = async () => new Response(
        '<html><body><h1>404 Not Found</h1></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
    const h = makeHarness({
        healthProbe: html404,
        providerList: html404,
        openapiProbe: html404
    });
    const codespace = 'https://supreme-goggles-wvx9q5x9jrwq3gqv5-8000.app.github.dev';
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: codespace })
        );
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.config.tempmail_api_codespaces_url, true);
        assert.equal(data.config.tempmail_api_port, '8000');
        assert.equal(data.config.tempmail_api_scheme, 'https');
        assert.equal(data.config.tempmail_api_base_url, codespace);
        assert.equal(check.ok, false);
        assert.match(check.hint, /GitHub Codespaces/);
        assert.match(check.hint, /port 8000/);
        assert.ok(check.steps.some(step => step.includes('curl -i http://localhost:8000/api/health')));
        assert.ok(check.steps.some(step => step.includes('Public')));
        assert.ok(check.steps.some(step => step.includes('docker compose up -d')));
        assert.ok(check.steps.some(step => step.includes('npx wrangler@4 secret put TEMPMAIL_API_URL')));
        assert.ok(check.steps.some(step => step.includes(codespace + '/api/health')));
    } finally {
        h.restore();
    }
});

test('skema http pada host Codespaces diberi peringatan https', async () => {
    const html404 = async () => new Response('404', { status: 404 });
    const h = makeHarness({
        healthProbe: html404,
        providerList: html404,
        openapiProbe: html404
    });
    try {
        const res = await worker.fetch(
            makeRequest('diagnostics'),
            baseEnv({ TEMPMAIL_API_URL: 'http://supreme-goggles-wvx9q5x9jrwq3gqv5-8000.app.github.dev' })
        );
        const data = await res.json();
        const check = data.checks.find(item => item.name === 'tempmail_provider');

        assert.equal(data.config.tempmail_api_scheme, 'http');
        assert.equal(data.config.tempmail_api_codespaces_url, true);
        assert.match(check.hint, /pakai https/);
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
    assert.match(setup, /Mode A/);

    assert.match(page, /check\.endpoints/);
    assert.match(page, /endpoint opsional/);
    assert.match(page, /apiDetected/);
    assert.match(page, /periksa TEMPMAIL_API_URL/);
    assert.match(page, /tempmail_api_base_url/);
    assert.match(page, /URL repo, bukan host API/);
    assert.match(page, /Codespaces\/ephemeral/);
    assert.match(page, /tempmail_api_scheme/);
    assert.match(page, /pakai https/);
    assert.match(page, /check\.steps/);
    assert.match(page, /Cuplikan/);
    assert.match(page, /btn-copy-probe/);
    assert.match(page, /curl -i/);
    assert.match(page, /built-in mail\.tm/);
    assert.match(page, /api\.mail\.tm\/domains/);

    const doc = fs.readFileSync(path.join(ROOT, 'docs/tempmail-setup.md'), 'utf8');
    assert.match(doc, /action=diagnostics/);
    assert.match(doc, /api\/providers/);
    assert.match(doc, /semua probe|Semua probe|404 \(non-JSON\)/);
    assert.match(doc, /github\.com\/sugionoofficial\/Tempmail-MCP/);
    assert.match(doc, /BUKAN host API/);
    assert.match(doc, /app\.github\.dev/);
    assert.match(doc, /githubpreview\.dev/);
    assert.match(doc, /Dua mode/);
    assert.match(doc, /@gmail\.com/);

    const example = fs.readFileSync(path.join(ROOT, '.dev.vars.example'), 'utf8');
    assert.match(example, /action=diagnostics/);
    assert.match(example, /app\.github\.dev/);
    assert.match(example, /built-in mail\.tm/);

    const checker = fs.readFileSync(path.join(ROOT, 'scripts/check-local-dev-vars.mjs'), 'utf8');
    assert.match(checker, /FEATURE_FLAGS/);
    assert.match(checker, /TEMPMAIL_API_URL/);
    assert.match(checker, /built-in mail\.tm/);

    const sql = fs.readFileSync(path.join(ROOT, 'supabase/tempmail-user-aliases.sql'), 'utf8');
    assert.match(sql, /pg_notify\('pgrst', 'reload schema'\)/);

    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    assert.match(readme, /diagnostics/);
    assert.match(readme, /built-in mail\.tm/);

    const handler = fs.readFileSync(path.join(ROOT, 'functions/_shared/tempmail-handler.js'), 'utf8');
    assert.match(handler, /mailtm-provider\.js/);
    assert.match(handler, /builtin_mailtm/);
});
