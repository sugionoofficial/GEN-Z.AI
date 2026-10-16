async function getTempmailUser(request, env) {
    const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
    const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || "";
    const authorization = request.headers.get("Authorization") || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
        return { error: "Silakan login untuk menggunakan TempMail.", status: 401 };
    }

    if (!supabaseUrl || !anonKey) {
        return { error: "Konfigurasi autentikasi Supabase belum lengkap di Cloudflare.", status: 500 };
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${tokenMatch[1]}`
        }
    });

    if (!response.ok) {
        return { error: "Session tidak valid atau sudah kedaluwarsa. Silakan login kembali.", status: 401 };
    }

    const user = await response.json();
    if (!user?.id) {
        return { error: "User Supabase tidak ditemukan.", status: 401 };
    }

    return { user };
}

function getTempmailDatabaseConfig(env) {
    const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Konfigurasi database TempMail belum lengkap.");
    }

    return { supabaseUrl, serviceRoleKey };
}

async function getUserTempmailAlias(env, userId, email) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/tempmail_user_aliases`);
    url.searchParams.set("select", "email,token,provider");
    url.searchParams.set("user_id", `eq.${userId}`);
    if (email) url.searchParams.set("email", `eq.${email}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
        headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`
        }
    });

    if (!response.ok) throw new Error("Gagal membaca pemetaan alias TempMail.");
    const rows = await response.json();
    return rows[0] || null;
}

async function getTempmailUserRole(env, userId) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
    url.searchParams.set("select", "role");
    url.searchParams.set("id", `eq.${userId}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
        headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`
        }
    });

    if (!response.ok) throw new Error("Gagal memeriksa role akun TempMail.");
    const profiles = await response.json();
    return profiles[0]?.role || null;
}

async function saveUserTempmailAlias(env, userId, alias) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/tempmail_user_aliases`);
    url.searchParams.set("on_conflict", "user_id");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal"
        },
        body: JSON.stringify({
            user_id: userId,
            email: alias.email,
            token: alias.token,
            provider: alias.provider || "gmail"
        })
    });

    if (!response.ok) throw new Error("Gagal menyimpan alias TempMail.");
    return getUserTempmailAlias(env, userId);
}

export default async function handleTempmail(request, env) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type"
    };
    const json = (data, status = 200) => Response.json(data, { status, headers: corsHeaders });

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const email = url.searchParams.get("email");
    const messageId = url.searchParams.get("messageId");
    if (!["create", "messages", "message"].includes(action)) {
        return json({ error: "Action tidak dikenal. Gunakan: create, messages, atau message" }, 400);
    }
    if ((action === "create" && request.method !== "POST") || (action !== "create" && request.method !== "GET")) {
        return json({ error: "Method tidak diizinkan." }, 405);
    }
    if (action !== "create" && (!email || (action === "message" && !messageId))) {
        return json({ error: "Parameter email dan messageId wajib diisi sesuai action." }, 400);
    }

    let auth;
    try {
        auth = await getTempmailUser(request, env);
    } catch {
        return json({ error: "Gagal memverifikasi session Supabase." }, 502);
    }
    if (auth.error) return json({ error: auth.error }, auth.status);

    let role;
    try {
        role = await getTempmailUserRole(env, auth.user.id);
    } catch {
        return json({ error: "Gagal memverifikasi role akun." }, 502);
    }
    if (!["admin", "owner"].includes(String(role || "").trim().toLowerCase())) {
        return json({ error: "Fitur TempMail hanya tersedia untuk role admin atau owner." }, 403);
    }

    const tempmailUrl = (env.TEMPMAIL_API_URL || "").replace(/\/+$/, "");
    if (!tempmailUrl) {
        return json({ error: "TEMPMAIL_API_URL belum di-set." }, 500);
    }

    try {
        if (action === "create") {
            const existing = await getUserTempmailAlias(env, auth.user.id);
            if (existing) return json({ email: existing.email });

            const response = await fetch(`${tempmailUrl}/api/email?name=gmail`, {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ min_name_length: 10, max_name_length: 10 })
            });
            const alias = await response.json();
            if (!response.ok || !alias?.email || !alias?.token) {
                return json({ error: "Provider gagal membuat email sementara." }, 502);
            }

            const savedAlias = await saveUserTempmailAlias(env, auth.user.id, alias);
            if (!savedAlias) throw new Error("Alias TempMail gagal disimpan.");
            return json({ email: savedAlias.email });
        }

        const alias = await getUserTempmailAlias(env, auth.user.id, email);
        if (!alias) return json({ error: "Email tidak ditemukan untuk akun ini." }, 404);

        const provider = encodeURIComponent(alias.provider || "gmail");
        const targetUrl = action === "messages"
            ? `${tempmailUrl}/api/email/${encodeURIComponent(alias.email)}/messages?token=${encodeURIComponent(alias.token)}&name=${provider}`
            : `${tempmailUrl}/api/email/${encodeURIComponent(alias.email)}/message/${encodeURIComponent(messageId)}?token=${encodeURIComponent(alias.token)}&name=${provider}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch(targetUrl, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            });
        } finally {
            clearTimeout(timeoutId);
        }

        return new Response(await response.text(), {
            status: response.status,
            headers: {
                ...corsHeaders,
                "Content-Type": response.headers.get("Content-Type") || "application/json"
            }
        });
    } catch {
        return json({ error: "Gagal memproses TempMail. Periksa konfigurasi Supabase dan provider." }, 502);
    }
}