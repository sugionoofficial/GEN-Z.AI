import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOpusCredential, listOpusCredentials, withStoredOpusCredentials } from '../lib/opus/credential-store.js';
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
        await saveOpusCredential(env, {label:'Account', access_token:'secret-access', refresh_token:'secret-refresh'});
        assert.ok(!JSON.stringify(row).includes('secret-access')); assert.ok(!JSON.stringify(row).includes('secret-refresh'));
        const values = await listOpusCredentials(env, true);
        assert.equal(values[0].access_token, 'secret-access'); assert.equal(values[0].refresh_token, 'secret-refresh');
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
