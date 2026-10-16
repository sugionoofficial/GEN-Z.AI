// api/tempmail.js
export default async function handler(req, res) {
  const authorization = req.headers.authorization || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Konfigurasi autentikasi Supabase belum lengkap.' });
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${tokenMatch[1]}`
      }
    });
    if (!authResponse.ok) {
      return res.status(401).json({ error: 'Session Supabase tidak valid atau sudah kedaluwarsa.' });
    }

    const user = await authResponse.json();
    if (!user?.id) {
      return res.status(401).json({ error: 'User Supabase tidak ditemukan.' });
    }

    const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
    profileUrl.searchParams.set('select', 'role');
    profileUrl.searchParams.set('id', `eq.${user.id}`);
    profileUrl.searchParams.set('limit', '1');
    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });
    if (!profileResponse.ok) {
      console.error('Tempmail profile check failed:', await profileResponse.text());
      return res.status(500).json({ error: 'Gagal memverifikasi role akun.' });
    }

    const profiles = await profileResponse.json();
    const role = String(profiles[0]?.role || '').trim().toLowerCase();
    if (role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Fitur TempMail hanya tersedia untuk role admin atau owner.' });
    }
  } catch (error) {
    console.error('Tempmail authentication error:', error);
    return res.status(502).json({ error: 'Gagal memverifikasi session Supabase.' });
  }

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
