import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOpusCredential, listOpusCredentials, withStoredOpusCredentials, loadStoredOpusPool } from '../lib/opus/credential-store.js';
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
    } finally { globalThis.fetch = original; }
});
test('only database admin or owner can list credentials, even if user metadata claims admin', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; return calls === 1 ? Response.json({id:'user', user_metadata:{role:'admin'}}) : Response.json([{role:'user'}]); };
    const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
    try { await handler({method:'GET', headers:{authorization:'Bearer jwt'}, env}, res); assert.equal(res.code, 403); assert.equal(calls, 2); }
    finally { globalThis.fetch = original; }
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

test('one secret field accepts the complete OAuth bundle and upserts by numbered slot', async () => {
    const original = globalThis.fetch; let query, row;
    globalThis.fetch = async (url, opts) => { query = url; row = JSON.parse(opts.body); return new Response(null, {status: 201}); };
    try {
        await saveOpusCredential(env, {slot: 27, credential: JSON.stringify({access_token:'access', refresh_token:'refresh', client_id:'id', expires_at:42})});
        assert.match(query, /on_conflict=slot/); assert.equal(row.slot, 27); assert.equal(row.label, 'OPUS_AUTH_TOKEN_27');
        assert.ok(!JSON.stringify(row).includes('refresh'));
        await assert.rejects(saveOpusCredential(env, {slot: 1, credential:'{bad json'}), /JSON token tidak valid/);
        await assert.rejects(saveOpusCredential(env, {slot: 0, credential:'x'}), /slot tidak valid/);
    } finally { globalThis.fetch = original; }
});
