import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOpusCredential, listOpusCredentials, updateOpusCredentialCreditStatus, withStoredOpusCredentials, withSupabaseOpusCredentials, loadStoredOpusPool } from '../lib/opus/credential-store.js';
import { collectOpusCredentialEntries } from '../lib/social-publisher/opus.js';
import handler from '../api/opus-credentials.js';

const env = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'service', PROVIDER_CREDENTIAL_ENCRYPTION_KEY: 'test-only-encryption-key' };
test('credentials encrypted at rest and included alongside legacy slots', async () => {
    const original = globalThis.fetch; let row;
    globalThis.fetch = async (url, opts) => {
        if (opts.method === 'POST') { row = JSON.parse(opts.body); return new Response(null, {status: 201}); }
        return Response.json([{ id: 'id', label: row.label, ...row }]);
    };
    try {
        await saveOpusCredential(env, {slot: 1, credential: JSON.stringify({access_token:'secret-access', refresh_token:'secret-refresh', client_id:'client', expires_at:123})});
        assert.ok(!JSON.stringify(row).includes('secret-access')); assert.ok(!JSON.stringify(row).includes('secret-refresh'));
        const values = await listOpusCredentials(env, true);
        assert.equal(values[0].access_token, 'secret-access'); assert.equal(values[0].refresh_token, 'secret-refresh'); assert.equal(values[0].expires_at, 123);
        const pool = JSON.parse(await loadStoredOpusPool({...env, OPUS_AUTH_TOKEN:'legacy-secret'}));
        assert.equal(pool.opus_key_pool.length, 1); assert.equal(pool.opus_key_pool[0].refresh_token, 'secret-refresh');
        assert.ok(!JSON.stringify(pool).includes('legacy-secret'));
        const merged = await withStoredOpusCredentials({...env, OPUS_AUTH_TOKEN_42: 'legacy'});
        const entries = collectOpusCredentialEntries(merged);
        assert.equal(entries.length, 2); assert.ok(entries.some(x => x.includes('secret-refresh'))); assert.ok(entries.includes('legacy'));
        const supabaseOnly = await withSupabaseOpusCredentials({...env, OPUS_AUTH_TOKEN_42: 'legacy'});
        const strictEntries = collectOpusCredentialEntries(supabaseOnly);
        assert.equal(supabaseOnly.OPUS_CREDENTIALS_SOURCE, 'supabase');
        assert.equal(strictEntries.length, 1);
        assert.ok(strictEntries[0].includes('secret-refresh'));
        assert.ok(!strictEntries.includes('legacy'), 'Social Publisher must ignore Cloudflare/Worker tokens when Supabase is authoritative');
    } finally { globalThis.fetch = original; }
});
test('only database admin or owner can list credentials, even if user metadata claims admin', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; return calls === 1 ? Response.json({id:'user', user_metadata:{role:'admin'}}) : Response.json([{role:'user'}]); };
    const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
    try { await handler({method:'GET', headers:{authorization:'Bearer jwt'}, env}, res); assert.equal(res.code, 403); assert.equal(calls, 2); }
    finally { globalThis.fetch = original; }
});

test('admin credentials API exposes only credit-status metadata, never encrypted or decrypted token data', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async url => {
        calls++;
        if (String(url).includes('/auth/v1/user')) return Response.json({id: 'admin-user'});
        if (String(url).includes('/profiles?')) return Response.json([{role: 'admin'}]);
        return Response.json([{
            id: '00000000-0000-4000-8000-000000000001', slot: 1,
            updated_at: '2026-11-01T00:00:00Z', credit_status: 'exhausted',
            credit_status_updated_at: '2026-11-02T00:00:00Z',
            ciphertext: 'must-not-be-returned', tag: 'secret-tag', iv: 'secret-iv'
        }]);
    };
    const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
    try {
        await handler({method: 'GET', headers: {authorization: 'Bearer jwt'}, env}, res);
        assert.equal(res.code, 200);
        assert.equal(res.body.credentials[0].credit_status, 'exhausted');
        assert.equal(res.body.credentials[0].credit_status_updated_at, '2026-11-02T00:00:00Z');
        assert.ok(!JSON.stringify(res.body).includes('must-not-be-returned'));
        assert.ok(!JSON.stringify(res.body).includes('secret-tag'));
        assert.ok(!JSON.stringify(res.body).includes('secret-iv'));
    } finally { globalThis.fetch = original; }
});

test('empty or inaccessible Supabase vault never falls back to Worker credentials for generation', async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => Response.json([]);
        await assert.rejects(loadStoredOpusPool({...env, OPUS_AUTH_TOKEN: 'legacy'}), /belum dikonfigurasi/);
        globalThis.fetch = async () => new Response('', {status: 503});
        await assert.rejects(loadStoredOpusPool({...env, OPUS_AUTH_TOKEN: 'legacy'}), /Gagal mengakses/);
    } finally { globalThis.fetch = original; }
});

test('credit-status updates are validated and patched by credential UUID', async () => {
    const original = globalThis.fetch; let query, body;
    globalThis.fetch = async (url, opts) => {
        query = String(url); body = JSON.parse(opts.body);
        return new Response(null, {status: 204});
    };
    try {
        await updateOpusCredentialCreditStatus(env, {
            id: '00000000-0000-4000-8000-000000000001', status: 'exhausted'
        });
        assert.match(query, /id=eq\.00000000-0000-4000-8000-000000000001/);
        assert.equal(body.credit_status, 'exhausted');
        assert.ok(body.credit_status_updated_at);
        await assert.rejects(updateOpusCredentialCreditStatus(env, {id: 'bad', status: 'available'}), /ID slot/);
        await assert.rejects(updateOpusCredentialCreditStatus(env, {id: '00000000-0000-4000-8000-000000000001', status: 'invalid'}), /Status kredit/);
    } finally { globalThis.fetch = original; }
});

test('one secret field accepts the complete OAuth bundle and upserts by numbered slot', async () => {
    const original = globalThis.fetch; let query, row;
    globalThis.fetch = async (url, opts) => { query = url; row = JSON.parse(opts.body); return new Response(null, {status: 201}); };
    try {
        await saveOpusCredential(env, {slot: 27, credential: JSON.stringify({access_token:'access', refresh_token:'refresh', client_id:'id', expires_at:42})});
        assert.match(query, /on_conflict=slot/); assert.equal(row.slot, 27); assert.equal(row.label, 'OPUS_AUTH_TOKEN_27');
        assert.equal(row.credit_status, 'unknown'); assert.equal(row.credit_status_updated_at, null);
        assert.ok(!JSON.stringify(row).includes('refresh'));
        await assert.rejects(saveOpusCredential(env, {slot: 1, credential:'{bad json'}), /JSON token tidak valid/);
        await assert.rejects(saveOpusCredential(env, {slot: 0, credential:'x'}), /slot tidak valid/);
    } finally { globalThis.fetch = original; }
});
