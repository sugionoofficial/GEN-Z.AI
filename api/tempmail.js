// api/tempmail.js
export default async function handler(req, res) {
  // Ambil URL Tempmail-MCP dari Environment Variable Vercel
  const TEMPMAIL_URL = process.env.TEMPMAIL_API_URL;
  if (!TEMPMAIL_URL) {
    return res.status(500).json({ error: 'TEMPMAIL_API_URL belum di-set di Vercel' });
  }

  const { action, email, token, messageId } = req.query;

  try {
    let targetUrl = '';
    let method = 'GET';

    if (action === 'create') {
      // Generate email baru
      targetUrl = `${TEMPMAIL_URL}/api/email?name=gmail`;
      method = 'POST';
    } else if (action === 'messages') {
      // Ambil daftar pesan masuk
      targetUrl = `${TEMPMAIL_URL}/api/email/${email}/messages?token=${token}`;
    } else if (action === 'message') {
      // Ambil isi pesan tertentu
      targetUrl = `${TEMPMAIL_URL}/api/email/${email}/message/${messageId}?token=${token}`;
    } else {
      return res.status(400).json({ error: 'Action tidak dikenal' });
    }

    const response = await fetch(targetUrl, { method });
    const data = await response.json();

    // Teruskan response ke frontend
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Tempmail proxy error:', error);
    return res.status(500).json({ error: 'Gagal menghubungi server Tempmail' });
  }
}
