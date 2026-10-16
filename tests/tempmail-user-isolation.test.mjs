import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../functions/worker.mjs';

test('TempMail is restricted to admins and owners while aliases stay user-isolated', async () => {
  const originalFetch = globalThis.fetch;
  const aliases = new Map();
  let providerCreateCount = 0;
  const providerRequests = [];

  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = options.method || 'GET';

    if (url.pathname === '/auth/v1/user') {
      const token = options.headers.Authorization.replace(/^Bearer\s+/i, '');
      return Response.json({ id: token, email: `${token}@example.com` });
    }

    if (url.pathname === '/rest/v1/profiles') {
      const userId = url.searchParams.get('id').slice(3);
      const role = userId === 'admin-a' ? 'admin' : userId === 'owner-b' ? 'owner' : 'user';
      return Response.json([{ role }]);
    }

    if (url.pathname === '/rest/v1/tempmail_user_aliases' && method === 'GET') {
      const userId = url.searchParams.get('user_id').slice(3);
      const emailFilter = url.searchParams.get('email');
      const alias = aliases.get(userId);
      return Response.json(alias && (!emailFilter || emailFilter === `eq.${alias.email}`) ? [alias] : []);
    }

    if (url.pathname === '/rest/v1/tempmail_user_aliases' && method === 'POST') {
      const alias = JSON.parse(options.body);
      if (!aliases.has(alias.user_id)) aliases.set(alias.user_id, alias);
      return new Response(null, { status: 201 });
    }

    if (url.pathname === '/api/email' && method === 'POST') {
      providerCreateCount += 1;
      return Response.json({
        email: `sugionoofficial88+tag${providerCreateCount}@gmail.com`,
        token: `tag${providerCreateCount}`,
        provider: 'gmail'
      });
    }

    if (url.pathname.includes('/messages') || url.pathname.includes('/message/')) {
      providerRequests.push(url);
      return Response.json([]);
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };

  const env = {
    TEMPMAIL_API_URL: 'https://tempmail.test',
    SUPABASE_URL: 'https://supabase.test',
    SUPABASE_ANON_KEY: 'public-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  };

  const request = (userId, action, params = {}) => {
    const url = new URL('https://app.test/api/tempmail');
    url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return new Request(url, {
      method: action === 'create' ? 'POST' : 'GET',
      headers: userId ? { Authorization: `Bearer ${userId}` } : {}
    });
  };

  try {
    const first = await worker.fetch(request('admin-a', 'create'), env);
    const firstData = await first.json();
    const firstAgain = await worker.fetch(request('admin-a', 'create'), env);
    const firstAgainData = await firstAgain.json();
    const second = await worker.fetch(request('owner-b', 'create'), env);
    const secondData = await second.json();

    assert.equal(first.status, 200);
    assert.equal(firstAgainData.email, firstData.email);
    assert.notEqual(secondData.email, firstData.email);
    assert.equal(providerCreateCount, 2);

    const deniedCreate = await worker.fetch(request('user-c', 'create'), env);
    assert.equal(deniedCreate.status, 403);
    const deniedRead = await worker.fetch(
      request('user-c', 'messages', { email: firstData.email }),
      env
    );
    assert.equal(deniedRead.status, 403);
    assert.equal(providerCreateCount, 2);
    assert.equal(providerRequests.length, 0);

    const crossUserRead = await worker.fetch(
      request('owner-b', 'messages', { email: firstData.email }),
      env
    );
    assert.equal(crossUserRead.status, 404);
    assert.equal(providerRequests.length, 0);

    const ownerRead = await worker.fetch(
      request('admin-a', 'messages', { email: firstData.email }),
      env
    );
    assert.equal(ownerRead.status, 200);
    assert.equal(providerRequests[0].searchParams.get('token'), 'tag1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});