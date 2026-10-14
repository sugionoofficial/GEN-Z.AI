export async function onRequest(context) {
  const { request, env } = context;

  // 1. Handle CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');
  const messageId = url.searchParams.get('messageId');

  // 2. Sanitasi URL: hapus trailing slash
  const TEMPMAIL_URL = (env.TEMPMAIL_API_URL || '').replace(/\/+$/, '');

  if (!TEMPMAIL_URL) {
    return new Response(
      JSON.stringify({ error: 'TEMPMAIL_API_URL belum di-set di Cloudflare' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let targetUrl = '';
    let method = 'GET';

    if (action === 'create') {
      targetUrl = `${TEMPMAIL_URL}/api/email?name=gmail`;
      method = 'POST';
    } else if (action === 'messages') {
      // 3. Validasi parameter
      if (!email || !token) {
        return new Response(
          JSON.stringify({ error: 'Parameter email & token wajib diisi' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/messages?token=${encodeURIComponent(token)}`;
    } else if (action === 'message') {
      if (!email || !token || !messageId) {
        return new Response(
          JSON.stringify({ error: 'Parameter email, token & messageId wajib diisi' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/message/${encodeURIComponent(messageId)}?token=${encodeURIComponent(token)}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Action tidak dikenal. Gunakan: create, messages, atau message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(targetUrl, { method });
    const data = await response.text();

    // 4. Teruskan Content-Type dari server asli, fallback ke JSON
    const contentType = response.headers.get('Content-Type') || 'application/json';

    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': contentType },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Gagal menghubungi server Tempmail', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
