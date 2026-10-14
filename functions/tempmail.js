export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');
  const messageId = url.searchParams.get('messageId');

  const TEMPMAIL_URL = env.TEMPMAIL_API_URL;
  if (!TEMPMAIL_URL) {
    return new Response(
      JSON.stringify({ error: 'TEMPMAIL_API_URL belum di-set di Cloudflare' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    let targetUrl = '';
    let method = 'GET';

    if (action === 'create') {
      targetUrl = `${TEMPMAIL_URL}/api/email?name=gmail`;
      method = 'POST';
    } else if (action === 'messages') {
      targetUrl = `${TEMPMAIL_URL}/api/email/${email}/messages?token=${token}`;
    } else if (action === 'message') {
      targetUrl = `${TEMPMAIL_URL}/api/email/${email}/message/${messageId}?token=${token}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Action tidak dikenal' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(targetUrl, { method });
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Gagal menghubungi server Tempmail', detail: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
