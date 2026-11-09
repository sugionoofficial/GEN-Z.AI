/* =========================================================
   GEN-Z.AI — TEMPMAIL HANDLER
   ---------------------------------------------------------
   Endpoint: /api/tempmail
   Provider: built-in mail.tm (default, tanpa secret) atau
             Tempmail-MCP (opsional lewat TEMPMAIL_API_URL)

   Action yang didukung:
   - GET  action=alias     -> alias milik user (tanpa membuat baru)
   - GET  action=status    -> alias (nama alternatif untuk `alias`)
   - GET  action=diagnostics -> cek konfigurasi Supabase & provider
   - POST action=create    -> pakai alias yang ada / buat baru
   - GET  action=messages  -> daftar pesan pada alias
   - GET  action=message   -> isi satu pesan (body)

   Prinsip:
   1. Hanya role admin/owner (diverifikasi ulang di server).
   2. Alias selalu terikat user_id -> tidak bisa saling intip.
   3. Bila TEMPMAIL_API_URL kosong, Worker memakai provider bawaan
      mail.tm secara server-side (tidak perlu Codespace/service luar).
      Bila secret diisi, kandidat TEMPMAIL_PROVIDER dipakai seperti
      sebelumnya dengan fallback ke provider sehat lain.
   4. Semua request keluar memakai timeout agar Worker tidak
      menggantung saat provider/Supabase lambat.
========================================================= */

import {
    MAILTM_PROVIDER,
    createMailtmAlias,
    refreshMailtmToken,
    serializeMailtmCredentials,
    parseMailtmCredentials,
    checkMailtmHealth,
    fetchMailtmMessages,
    fetchMailtmMessage
} from "./mailtm-provider.js";

const SUPABASE_TIMEOUT_MS = 12000;
const PROVIDER_TIMEOUT_MS = 20000;
const DIAGNOSTICS_TIMEOUT_MS = 8000;
const ALIAS_SAVE_ATTEMPTS = 3;
const TEMPMAIL_PROVIDER_DEFAULT = "gmail";
const MISSING_TEMPMAIL_URL_HINT =
    "TEMPMAIL_API_URL belum di-set. Untuk alamat @gmail.com, deploy Tempmail-MCP ke host HTTPS persisten (VPS / Cloudflare Tunnel / Render / Railway), lalu set secret ini. Jangan pakai URL repo GitHub atau port-forward Codespaces *.app.github.dev. Bila @gmail.com tidak wajib, set TEMPMAIL_PROVIDER=mailtm untuk memakai provider bawaan mail.tm.";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" }
    });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === "AbortError") {
            const timeoutError = new Error(
                `Permintaan timeout setelah ${Math.round(timeoutMs / 1000)} detik. Coba lagi.`
            );
            timeoutError.status = 504;
            throw timeoutError;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function readJsonSafe(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function safeSnippet(value, max = 300) {
    return String(value ?? "")
        .replace(/(token|api[_-]?key|password|secret)\s*["']?\s*[:=]\s*["']?[^"'\s&,}]+/gi, "$1=<disamarkan>")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, max);
}

function safePublicBaseUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || ""));
        if (!url.protocol || !url.host) return "";
        const path = url.pathname.replace(/\/+$/, "");
        return `${url.protocol}//${url.host}${path}`;
    } catch {
        return "";
    }
}

function describeErrorPayload(payload) {
    if (!payload) return "";
    if (typeof payload === "string") return safeSnippet(payload);
    if (typeof payload !== "object") return "";

    const detail = payload.detail;
    if (typeof detail === "string") return safeSnippet(detail);
    if (detail && typeof detail === "object") {
        if (typeof detail.message === "string") return safeSnippet(detail.message);
        try {
            return safeSnippet(JSON.stringify(detail));
        } catch {
            return "";
        }
    }

    for (const key of ["error", "message", "reason"]) {
        if (typeof payload[key] === "string" && payload[key].trim()) {
            return safeSnippet(payload[key].trim());
        }
    }

    return "";
}

/* Petunjuk perbaikan untuk kegagalan PostgREST (dipakai error & diagnostics). */
function supabaseRestHint(response, payload, resource) {
    const code = String(payload?.code || "");
    if (response.status === 401 || response.status === 403) {
        return "SUPABASE_SERVICE_ROLE_KEY ditolak Supabase. Ganti dengan secret key project yang aktif / sama dengan SUPABASE_URL.";
    }
    if (code === "PGRST205" || (resource === "tempmail_user_aliases" && response.status === 404)) {
        return "Tabel public.tempmail_user_aliases belum dikenal PostgREST. Jalankan supabase/tempmail-user-aliases.sql lalu NOTIFY pgrst, 'reload schema'.";
    }
    return "Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY pada Cloudflare Worker (project yang sama dengan frontend).";
}

function providerErrorMessage(response, payload, fallback) {
    const detail = describeErrorPayload(payload);
    const status = response?.status ? `HTTP ${response.status}: ` : "";
    return `${fallback} (${status}${detail || "tanpa detail dari provider"})`;
}

function getSupabaseConfig(env) {
    const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
    const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || "";
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
    return { supabaseUrl, anonKey, serviceRoleKey };
}

function getTempmailDatabaseConfig(env) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig(env);

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Konfigurasi database TempMail belum lengkap.");
    }

    return { supabaseUrl, serviceRoleKey };
}

function getTempmailProviderUrl(env) {
    return String(env.TEMPMAIL_API_URL || "").trim().replace(/\/+$/, "");
}

function configError(message, status = 500) {
    const error = new Error(message);
    error.status = status;
    return error;
}

/*
 * Daftar provider yang dicoba berurutan.
 * "auto" berarti membiarkan Tempmail-MCP memilih provider sehat
 * sesuai prioritas internalnya.
 */
function getProviderCandidates(env) {
    const raw = env.TEMPMAIL_PROVIDER;
    const configured = String(raw === undefined || raw === null ? TEMPMAIL_PROVIDER_DEFAULT : raw)
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);

    if (!configured.length) configured.push("auto");
    if (!configured.includes("auto")) configured.push("auto");

    return [...new Set(configured)];
}

function hasExternalTempmailProvider(env) {
    return Boolean(getTempmailProviderUrl(env));
}

function isBuiltinMailtmEnabled(env) {
    /* OPSIONAL: jangan otomatis mengganti @gmail.com ke mail.tm.
       Admin yang butuh @gmail.com wajib memakai Mode B Tempmail-MCP. */
    return String(env.TEMPMAIL_PROVIDER ?? "")
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
        .includes(MAILTM_PROVIDER);
}

function getAliasProviderCandidates(env) {
    const external = getProviderCandidates(env);
    if (!isBuiltinMailtmEnabled(env)) return external;
    return [MAILTM_PROVIDER, ...external.filter(item => item !== MAILTM_PROVIDER)];
}

async function getTempmailUser(request, env) {
    const { supabaseUrl, anonKey } = getSupabaseConfig(env);
    const authorization = request.headers.get("Authorization") || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
        return { error: "Silakan login untuk menggunakan TempMail.", status: 401 };
    }

    if (!supabaseUrl || !anonKey) {
        return { error: "Konfigurasi autentikasi Supabase belum lengkap di Cloudflare.", status: 500 };
    }

    const response = await fetchWithTimeout(
        `${supabaseUrl}/auth/v1/user`,
        {
            headers: {
                "apikey": anonKey,
                "Authorization": `Bearer ${tokenMatch[1]}`
            }
        },
        SUPABASE_TIMEOUT_MS
    );

    if (!response.ok) {
        return { error: "Session tidak valid atau sudah kedaluwarsa. Silakan login kembali.", status: 401 };
    }

    const user = await readJsonSafe(response);
    if (!user?.id) {
        return { error: "User Supabase tidak ditemukan.", status: 401 };
    }

    return { user };
}

/*
 * Samakan normalisasi role dengan navigation.js: "administrator"
 * dianggap "admin". Tanpa ini, akun dengan role "Administrator"
 * melihat menu TempMail di navigasi (client menormalkan role) tapi
 * API-nya menolak dengan 403 — fitur tampak rusak.
 */
function normalizeRoleValue(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "administrator") return "admin";
    return value;
}

function isTempmailAllowedRole(role) {
    return ["admin", "owner"].includes(normalizeRoleValue(role));
}

async function getTempmailUserRole(env, userId) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
    url.searchParams.set("select", "role");
    url.searchParams.set("id", `eq.${userId}`);
    url.searchParams.set("limit", "1");

    const response = await fetchWithTimeout(
        url,
        {
            headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`
            }
        },
        SUPABASE_TIMEOUT_MS
    );

    if (!response.ok) {
        const payload = await readJsonSafe(response);
        const error = new Error(
            `Gagal memeriksa role akun TempMail (HTTP ${response.status}). ${describeErrorPayload(payload)}`.trim()
        );
        error.status = 502;
        error.detail = describeErrorPayload(payload);
        error.hint = supabaseRestHint(response, payload, "profiles");
        throw error;
    }
    const profiles = await readJsonSafe(response);
    return Array.isArray(profiles) ? profiles[0]?.role || null : null;
}

function normalizeAlias(row) {
    if (!row?.email) return null;
    return {
        email: String(row.email),
        provider: String(row.provider || TEMPMAIL_PROVIDER_DEFAULT),
        createdAt: row.created_at || null
    };
}

async function getUserTempmailAlias(env, userId, email) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/tempmail_user_aliases`);
    url.searchParams.set("select", "email,token,provider,created_at");
    url.searchParams.set("user_id", `eq.${userId}`);
    if (email) url.searchParams.set("email", `eq.${email}`);
    url.searchParams.set("limit", "1");

    const response = await fetchWithTimeout(
        url,
        {
            headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`
            }
        },
        SUPABASE_TIMEOUT_MS
    );

    if (!response.ok) {
        const payload = await readJsonSafe(response);
        const error = new Error(
            `Gagal membaca pemetaan alias TempMail (HTTP ${response.status}). ${describeErrorPayload(payload)}`.trim()
        );
        error.status = 502;
        error.detail = describeErrorPayload(payload);
        error.hint = supabaseRestHint(response, payload, "tempmail_user_aliases");
        throw error;
    }
    const rows = await readJsonSafe(response);
    return Array.isArray(rows) ? rows[0] || null : null;
}

/*
 * Simpan alias milik user.
 * - Kalau user sudah punya alias -> di-ignore (tidak menimpa).
 * - Kalau email hasil generate sudah dipakai user lain (unique
 *   constraint) -> PostgREST membalas 409; kembalikan null supaya
 *   pemanggil bisa mengulang dengan email baru.
 */
async function saveUserTempmailAlias(env, userId, alias) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/tempmail_user_aliases`);
    url.searchParams.set("on_conflict", "user_id");
    url.searchParams.set("select", "email,token,provider,created_at");

    const response = await fetchWithTimeout(
        url,
        {
            method: "POST",
            headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=ignore-duplicates,return=representation"
            },
            body: JSON.stringify({
                user_id: userId,
                email: alias.email,
                token: alias.token,
                provider: alias.provider || TEMPMAIL_PROVIDER_DEFAULT
            })
        },
        SUPABASE_TIMEOUT_MS
    );

    if (response.status === 409) {
        return null;
    }

    if (!response.ok) {
        const payload = await readJsonSafe(response);
        const error = new Error(
            describeErrorPayload(payload) || "Gagal menyimpan alias TempMail."
        );
        error.status = 502;
        error.detail = describeErrorPayload(payload);
        error.hint = supabaseRestHint(response, payload, "tempmail_user_aliases");
        throw error;
    }

    const rows = await readJsonSafe(response);
    const saved = Array.isArray(rows) ? normalizeAlias(rows[0]) : null;
    if (saved) return saved;

    /*
     * Sebagian konfigurasi PostgREST tidak mengembalikan representation.
     * Baca ulang dari database supaya alias yang benar-benar tersimpan
     * tetap bisa ditampilkan.
     */
    return normalizeAlias(await getUserTempmailAlias(env, userId));
}

async function updateUserTempmailToken(env, email, token) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/tempmail_user_aliases`);
    url.searchParams.set("email", `eq.${email}`);

    const response = await fetchWithTimeout(
        url,
        {
            method: "PATCH",
            headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ token })
        },
        SUPABASE_TIMEOUT_MS
    );

    if (!response.ok) {
        const payload = await readJsonSafe(response);
        const error = new Error("Gagal memperbarui token mail.tm di database TempMail.");
        error.status = 502;
        error.detail = describeErrorPayload(payload);
        error.hint = supabaseRestHint(response, payload, "tempmail_user_aliases");
        throw error;
    }
}

async function createProviderAlias(env, providerName) {
    if (providerName === MAILTM_PROVIDER) {
        return createMailtmAlias();
    }

    const tempmailUrl = getTempmailProviderUrl(env);
    if (!tempmailUrl) {
        throw configError(MISSING_TEMPMAIL_URL_HINT);
    }

    const target = providerName === "auto"
        ? `${tempmailUrl}/api/email`
        : `${tempmailUrl}/api/email?name=${encodeURIComponent(providerName)}`;

    const response = await fetchWithTimeout(target, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ min_name_length: 10, max_name_length: 10 })
    });

    const payload = await readJsonSafe(response);

    if (!response.ok || !payload?.email || !payload?.token) {
        throw new Error(
            providerErrorMessage(response, payload, "Provider gagal membuat email sementara.")
        );
    }

    return {
        email: String(payload.email),
        token: String(payload.token),
        provider: String(payload.provider || (providerName === "auto" ? TEMPMAIL_PROVIDER_DEFAULT : providerName))
    };
}

async function createUserAlias(env, userId) {
    const candidates = getAliasProviderCandidates(env);
    const failures = [];

    for (const providerName of candidates) {
        for (let attempt = 0; attempt < ALIAS_SAVE_ATTEMPTS; attempt += 1) {
            try {
                const providerAlias = await createProviderAlias(env, providerName);
                const saved = await saveUserTempmailAlias(env, userId, providerAlias);
                if (saved) return saved;
                /*
                 * null = email bentrok dengan alias user lain.
                 * Ulangi dengan email baru dari provider yang sama.
                 */
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push({
                    message,
                    status: Number(error?.status) || 0
                });
                break;
            }
        }
    }

    const first = failures.find(item => item.message);
    const error = new Error(
        first
            ? `Gagal membuat email TempMail. ${first.message}`
            : "Gagal membuat email TempMail. Semua provider sedang tidak tersedia."
    );
    if (first?.status) error.status = first.status;
    throw error;
}

function normalizeTimestamp(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") return String(value);
    return String(value);
}

function normalizeMessageSummary(raw) {
    if (!raw || typeof raw !== "object") return null;

    const id = raw.id ?? raw.uid ?? raw.mail_id ?? raw.message_id;
    if (id === undefined || id === null || String(id).trim() === "") return null;

    return {
        id: String(id),
        subject: String(raw.subject ?? ""),
        from: String(raw.from_addr ?? raw.from ?? ""),
        to: String(raw.to_addr ?? raw.to ?? ""),
        preview: String(raw.body_text ?? raw.preview ?? "").replace(/\s+/g, " ").trim().slice(0, 180),
        createdAt: normalizeTimestamp(raw.created_at)
    };
}

function extractMessageList(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["messages", "emails", "data", "items"]) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
}

function normalizeMessageDetail(raw, fallbackId) {
    const source = raw && typeof raw === "object" && raw.message && typeof raw.message === "object"
        ? raw.message
        : raw;

    if (!source || typeof source !== "object") return null;

    const attachments = Array.isArray(source.attachments)
        ? source.attachments
            .filter(item => item && typeof item === "object")
            .map(item => ({
                filename: String(item.filename ?? ""),
                contentType: String(item.content_type ?? item.contentType ?? ""),
                size: Number(item.size) || 0,
                url: typeof item.url === "string" ? item.url : null
            }))
        : [];

    return {
        id: String(source.id ?? fallbackId ?? ""),
        subject: String(source.subject ?? ""),
        from: String(source.from_addr ?? source.from ?? ""),
        to: String(source.to_addr ?? source.to ?? ""),
        bodyText: typeof source.body_text === "string" ? source.body_text : (typeof source.bodyText === "string" ? source.bodyText : ""),
        bodyHtml: typeof source.body_html === "string" ? source.body_html : (typeof source.bodyHtml === "string" ? source.bodyHtml : ""),
        createdAt: normalizeTimestamp(source.created_at),
        attachments
    };
}

function mapProviderStatus(status) {
    if (status === 404) return 404;
    if (status === 429) return 429;
    if (status >= 400 && status < 500) return 400;
    return 502;
}

async function requestBuiltinMailtm(env, alias, action, messageId) {
    const credentials = parseMailtmCredentials(alias.token);
    if (!credentials.token) {
        throw configError("Kredensial mail.tm untuk alias ini tidak lengkap. Buat ulang email TempMail.");
    }

    const read = token => action === "messages"
        ? fetchMailtmMessages(token)
        : fetchMailtmMessage(token, messageId);

    try {
        return await read(credentials.token);
    } catch (error) {
        if (credentials.password && error?.providerStatus === 401) {
            const freshToken = await refreshMailtmToken(alias.email, credentials.password);
            await updateUserTempmailToken(
                env,
                alias.email,
                serializeMailtmCredentials(freshToken, credentials.password)
            );
            return await read(freshToken);
        }
        throw error;
    }
}

async function requestProviderTempmail(env, alias, action, messageId) {
    if (alias.provider === MAILTM_PROVIDER) {
        return requestBuiltinMailtm(env, alias, action, messageId);
    }

    const tempmailUrl = getTempmailProviderUrl(env);
    if (!tempmailUrl) {
        throw configError(MISSING_TEMPMAIL_URL_HINT);
    }

    const provider = encodeURIComponent(alias.provider || TEMPMAIL_PROVIDER_DEFAULT);
    const emailParam = encodeURIComponent(alias.email);
    const tokenParam = encodeURIComponent(alias.token);

    const targetUrl = action === "messages"
        ? `${tempmailUrl}/api/email/${emailParam}/messages?token=${tokenParam}&name=${provider}`
        : `${tempmailUrl}/api/email/${emailParam}/message/${encodeURIComponent(messageId)}?token=${tokenParam}&name=${provider}`;

    const response = await fetchWithTimeout(targetUrl, {
        headers: { "Accept": "application/json" }
    }, PROVIDER_TIMEOUT_MS);

    const payload = await readJsonSafe(response);

    if (!response.ok) {
        const error = new Error(
            providerErrorMessage(response, payload, "Provider TempMail gagal memproses permintaan.")
        );
        error.status = mapProviderStatus(response.status);
        throw error;
    }

    if (action === "messages") {
        return extractMessageList(payload)
            .map(normalizeMessageSummary)
            .filter(Boolean);
    }

    const message = normalizeMessageDetail(payload, messageId);
    if (!message) {
        const error = new Error("Isi pesan tidak ditemukan pada provider.");
        error.status = 404;
        throw error;
    }
    return message;
}


/* =========================================================
   DIAGNOSTIK KONFIGURASI (action=diagnostics)
   ---------------------------------------------------------
   Menjawab "Periksa konfigurasi Supabase dan provider" tanpa
   membocorkan nilai secret: hanya boolean, host, HTTP status,
   dan petunjuk perbaikan. Tetap khusus admin/owner.
========================================================= */
function getDiagnosticsConfig(env, requestUrl) {
    const { supabaseUrl, anonKey, serviceRoleKey } = getSupabaseConfig(env);
    const tempmailUrl = getTempmailProviderUrl(env);
    let host = null;
    let publicBaseUrl = "";
    let scheme = null;
    let port = null;
    let codespacesUrl = false;
    let appHost = null;
    const knownAppHosts = new Set();

    try {
        appHost = new URL(requestUrl).host;
        knownAppHosts.add(appHost);
    } catch {
        /* request URL tidak tersedia */
    }
    /* Domain Worker sendiri / site URL sering dipakai keliru sebagai
       TEMPMAIL_API_URL. `META_REDIRECT_URI` ada di wrangler.toml [vars]. */
    for (const key of ["META_REDIRECT_URI", "SITE_URL", "PUBLIC_SITE_URL", "APP_URL"]) {
        try {
            const candidate = new URL(String(env[key] || "")).host;
            if (candidate) knownAppHosts.add(candidate);
        } catch {
            /* variabel kosong / bukan URL */
        }
    }
    try {
        if (tempmailUrl) {
            const parsed = new URL(tempmailUrl);
            host = parsed.host;
            publicBaseUrl = safePublicBaseUrl(parsed.toString());
            scheme = parsed.protocol.replace(/:$/, "") || null;
            /* Port Codespaces ada di hostname (-8000), bukan di URL.port. */
            const codespacePort = parsed.hostname.match(
                /-(\d+)\.(?:app\.github\.dev|githubpreview\.dev)$/
            );
            port = parsed.port || (codespacePort ? codespacePort[1] : null);
            /* <codespace>-<port>.app.github.dev = port-forward GitHub
               Codespaces. Ephemeral, sering privat, dan berubah saat
               Codespace dibuat ulang — tidak cocok untuk Worker produksi. */
            codespacesUrl = /\.(app\.github\.dev|githubpreview\.dev)$/.test(parsed.hostname);
        }
    } catch {
        /* TEMPMAIL_API_URL bukan URL valid */
    }
    /* URL repo kode (github.com / raw / gist / GitLab / Bitbucket) sering
       keliru diisi sebagai TEMPMAIL_API_URL. Repo bukan server HTTP API. */
    const sourceRepoHosts = new Set([
        "github.com", "www.github.com", "raw.githubusercontent.com",
        "gist.github.com", "gitlab.com", "bitbucket.org"
    ]);

    return {
        supabase_url: Boolean(supabaseUrl),
        supabase_anon_key: Boolean(anonKey),
        supabase_service_role_key: Boolean(serviceRoleKey),
        tempmail_api_url: Boolean(tempmailUrl),
        builtin_mailtm: isBuiltinMailtmEnabled(env),
        tempmail_api_host: host,
        tempmail_api_base_url: publicBaseUrl || null,
        tempmail_api_scheme: scheme,
        tempmail_api_port: port,
        tempmail_api_codespaces_url: codespacesUrl,
        tempmail_api_repository_url: Boolean(
            host && (sourceRepoHosts.has(host) || host.endsWith(".github.io"))
        ),
        app_host: appHost,
        tempmail_api_self_reference: Boolean(host && knownAppHosts.has(host)),
        preferred_provider: getProviderCandidates(env).join(",")
    };
}

async function checkSupabaseRest(env, resource) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/${resource}`);
    url.searchParams.set("select", resource === "profiles" ? "role" : "email");
    url.searchParams.set("limit", "1");

    const response = await fetchWithTimeout(
        url,
        {
            headers: {
                "apikey": serviceRoleKey,
                "Authorization": `Bearer ${serviceRoleKey}`
            }
        },
        SUPABASE_TIMEOUT_MS
    );
    const payload = await readJsonSafe(response);
    const ok = response.ok && Array.isArray(payload);
    const code = String(payload?.code || "");
    return {
        ok,
        status: response.status,
        detail: ok ? "" : `HTTP ${response.status}: ${code ? `${code}: ` : ""}${describeErrorPayload(payload)}`,
        hint: ok ? "" : supabaseRestHint(response, payload, resource)
    };
}

/*
 * Probe read-only ke server TempMail-MCP. `/api/providers` itu OPSIONAL:
 * beberapa deployment (versi lama / reverse-proxy yang hanya meneruskan
 * /api/email) membalas 404, sementara fitur Buat Email/Inbox tetap jalan.
 * Karena itu diagnostik mencoba beberapa endpoint dan tidak boleh
 * menyatakan konfigurasi rusak hanya karena satu endpoint 404.
 */
async function probeProviderEndpoint(target, path) {
    const result = {
        path,
        status: 0,
        json: false,
        payload: null,
        contentType: "",
        sample: "",
        error: ""
    };
    try {
        const response = await fetchWithTimeout(
            target,
            { headers: { "Accept": "application/json" } },
            DIAGNOSTICS_TIMEOUT_MS
        );
        result.status = response.status;
        result.contentType = String(response.headers.get("Content-Type") || "").slice(0, 120);
        const text = await response.text();
        let payload = null;
        if (text && text.trim()) {
            try {
                payload = JSON.parse(text);
            } catch {
                /* halaman HTML / plain text 404 */
            }
        }
        if (payload !== null && payload !== undefined) {
            result.json = true;
            result.payload = payload;
        } else {
            /* Cuplikan body sudah dibuang tag HTML-nya dan disamarkan,
               supaya admin bisa melihat "nginx 404", "Vercel", dll. */
            result.sample = safeSnippet(String(text || "").replace(/<[^>]*>/g, " "), 180);
        }
    } catch (error) {
        result.error = safeSnippet(error?.message || String(error), 160);
    }
    return result;
}

function isSuccessfulJsonProbe(probe) {
    return Boolean(probe.json && probe.status >= 200 && probe.status < 300);
}

function describeProbeStatuses(endpoints) {
    return endpoints
        .map(item => `${item.path}=${item.status || "network-error"}${item.json ? " (JSON)" : " (non-JSON)"}`)
        .join(", ");
}

async function checkTempmailProvider(env, config) {
    const tempmailUrl = getTempmailProviderUrl(env);
    const endpoints = [];
    const emptyResult = (hint, status = 0, detail = "") => ({
        ok: false,
        status,
        detail,
        hint,
        providers: [],
        endpoints,
        capabilities: {}
    });

    if (!tempmailUrl) {
        return emptyResult(
            MISSING_TEMPMAIL_URL_HINT
        );
    }

    const probeTargets = [
        ["/api/health", `${tempmailUrl}/api/health`],
        ["/api/providers", `${tempmailUrl}/api/providers`],
        ["/openapi.json", `${tempmailUrl}/openapi.json`]
    ];
    const probes = await Promise.all(
        probeTargets.map(([path, target]) => probeProviderEndpoint(target, path))
    );
    const [healthProbe, providersProbe, openapiProbe] = probes;
    for (const probe of probes) {
        endpoints.push({
            path: probe.path,
            status: probe.status,
            json: probe.json,
            ...(probe.json ? {} : {
                content_type: probe.contentType,
                sample: probe.sample
            }),
            ...(probe.error ? { error: probe.error } : {})
        });
    }

    const providers = Array.isArray(providersProbe.payload)
        ? providersProbe.payload.map(item => ({
            name: String(item?.name || ""),
            disabled: Boolean(item?.disabled),
            failures: Number(item?.failures || 0)
        }))
        : [];
    const openapiPaths = openapiProbe.json &&
        openapiProbe.payload?.paths &&
        typeof openapiProbe.payload.paths === "object"
        ? Object.keys(openapiProbe.payload.paths)
        : [];
    const capabilities = {
        create_email: openapiPaths.some(item => /^\/api\/email\/?$/.test(item)),
        messages: openapiPaths.some(item => item.includes("/messages")),
        providers: openapiPaths.includes("/api/providers"),
        health: openapiPaths.includes("/api/health")
    };

    const successful = probes.filter(isSuccessfulJsonProbe);
    const anyJson = probes.some(probe => probe.json);
    const apiRecognized = successful.length > 0 ||
        capabilities.create_email || capabilities.messages;
    const ok = Boolean(apiRecognized) && !config.tempmail_api_self_reference && !config.tempmail_api_repository_url;

    let hint = "";
    let steps = [];
    const publicBaseUrl = config.tempmail_api_base_url || "https://<host-tempmail>";
    const curlCommand = `curl -i ${publicBaseUrl}/api/health`;
    const allNonJson = !anyJson;
    if (config.tempmail_api_self_reference) {
        hint = `TEMPMAIL_API_URL mengarah ke domain aplikasi GEN-Z.AI sendiri (${config.tempmail_api_host}); Worker ini tidak punya route /api/health, /api/providers, atau /openapi.json. Ganti dengan host server TempMail-MCP yang terpisah.`;
        steps = [
            `Host aplikasi: ${config.app_host || "(tidak diketahui)"} · host provider saat ini: ${config.tempmail_api_host}.`,
            "Deploy/aktifkan server Tempmail-MCP, lalu catat URL dasar API-nya (tanpa /api di akhir).",
            "npx wrangler@4 secret put TEMPMAIL_API_URL",
            curlCommand
        ];
    } else if (config.tempmail_api_repository_url) {
        hint = `TEMPMAIL_API_URL berisi URL repositori kode (${config.tempmail_api_host}), bukan URL server yang menjalankan FastAPI. Repo Tempmail-MCP hanya memuat source + Dockerfile; README tidak mencantumkan host deploy dan repo tidak punya workflow deploy.`;
        steps = [
            "Clone: git clone https://github.com/sugionoofficial/Tempmail-MCP.git",
            "Jalankan: cd Tempmail-MCP && docker compose up -d (API lokal di http://localhost:8000/api/health).",
            "Expose ke HTTPS publik (VPS/reverse proxy/Cloudflare Tunnel/Render/Railway) — Worker Cloudflare tidak bisa memanggil localhost.",
            "Verifikasi: curl -i https://<host>/api/health harus 200 JSON (bukan HTML 404).",
            "Set ulang: npx wrangler@4 secret put TEMPMAIL_API_URL",
            "Nilai = URL dasar server, tanpa /api di akhir; sertakan sub-path bila API dipasang di belakang reverse proxy."
        ];
    } else if (!apiRecognized && config.tempmail_api_codespaces_url) {
        const forwardedPort = config.tempmail_api_port || "8000";
        const schemeWarning = config.tempmail_api_scheme === "http"
            ? " Skema secret saat ini http://; pakai https://."
            : "";
        hint = `TEMPMAIL_API_URL memakai URL port-forward GitHub Codespaces (${config.tempmail_api_host}). URL ini ephemeral: hanya hidup saat Codespace menyala, port ${forwardedPort} harus di-forward dengan visibility Public, dan hostname berubah bila Codespace dibuat ulang. Worker Cloudflare tidak bisa menjangkau port privat/stopped, sehingga ketiga probe membalas 404 HTML.${schemeWarning}`;
        steps = [
            `Di dalam Codespace: curl -i http://localhost:${forwardedPort}/api/health → harus 200 JSON.`,
            "Pastikan service jalan: cd Tempmail-MCP && docker compose up -d.",
            `Di tab Ports, set port ${forwardedPort} ke Public (default Private) dan jangan stop Codespace.`,
            `Verifikasi dari luar: ${curlCommand} → harus 200 JSON, bukan HTML 404.`,
            "Untuk produksi, pindahkan ke host persisten (VPS + reverse proxy / Cloudflare Tunnel / Render / Railway).",
            "npx wrangler@4 secret put TEMPMAIL_API_URL lalu isi URL dasar HTTPS yang persisten (tanpa /api di akhir)."
        ];
    } else if (!apiRecognized) {
        hint = allNonJson
            ? `Semua endpoint diagnostik membalas non-JSON (halaman 404 HTML / domain salah) pada host ${config.tempmail_api_host || "(tidak valid)"}. Ini bukan server API TempMail-MCP yang aktif. Pastikan TEMPMAIL_API_URL menunjuk ke URL dasar API TempMail-MCP; bila API dipasang di sub-path, sertakan sub-path itu pada nilainya.`
            : `Host ${config.tempmail_api_host || "(tidak valid)"} membalas JSON error/404 tanpa endpoint inti yang dikenal. Pastikan TEMPMAIL_API_URL menunjuk ke URL dasar API TempMail-MCP; bila API dipasang di sub-path, sertakan sub-path itu pada nilainya.`;
        steps = [
            `Verifikasi host dari terminal: ${curlCommand} (harus 200 JSON, bukan HTML 404).`,
            "Bila service mati / domain lama: deploy ulang Tempmail-MCP lalu pakai domain barunya.",
            "Set ulang secret: npx wrangler@4 secret put TEMPMAIL_API_URL",
            "Nilai harus URL DASAR API (mis. https://host atau https://host/prefix), jangan tambahkan /api di akhir.",
            `Jangan isi dengan domain aplikasi GEN-Z.AI (${config.app_host || "domain ini"}), Worker genzai.genzai-f37.workers.dev, atau URL repo GitHub.`,
            "Bila server hanya membuka POST /api/email (tanpa endpoint GET diagnostik), klik Buat Email untuk uji langsung."
        ];
    } else if (providersProbe.status === 404) {
        hint = "Endpoint opsional /api/providers tidak tersedia (HTTP 404) pada versi server ini, tetapi endpoint inti terdeteksi. Ini BUKAN kerusakan: fitur Buat Email/Inbox tetap bisa dipakai. Aktifkan /api/providers hanya bila ingin memantau status provider.";
    } else if (providers.length && providers.every(item => item.disabled)) {
        hint = "Semua provider sedang nonaktif (circuit breaker). Aktifkan lewat POST /api/providers/{name}/enable pada server TempMail-MCP.";
    } else {
        const preferred = getProviderCandidates(env)[0];
        if (preferred !== "auto" && providers.length && !providers.some(item => item.name === preferred)) {
            hint = `Provider '${preferred}' tidak terdaftar di server. Set TEMPMAIL_PROVIDER=auto untuk memakai fallback otomatis.`;
        }
    }

    let detail = "";
    if (!ok) {
        detail = describeProbeStatuses(endpoints);
        const informative = probes.find(probe => probe.json && probe.payload);
        if (informative) detail += ` · ${describeErrorPayload(informative.payload)}`;
        const nonJson = probes.find(probe => !probe.json && (probe.contentType || probe.sample || probe.error));
        if (nonJson) {
            detail += ` · ${nonJson.contentType ? `Content-Type: ${nonJson.contentType}` : "tanpa Content-Type"}` +
                `; Cuplikan: ${nonJson.sample || nonJson.error || "(body kosong)"}`;
        }
    } else if (providersProbe.status === 404) {
        detail = `/api/providers = HTTP 404 (endpoint opsional). Probe: ${describeProbeStatuses(endpoints)}`;
    }

    const status = successful[0]?.status ||
        providersProbe.status || healthProbe.status || openapiProbe.status || 0;

    return {
        ok,
        status,
        detail,
        hint,
        providers,
        endpoints,
        capabilities,
        ...(steps.length ? { steps } : {}),
        ...(openapiPaths.length ? { openapi_paths: openapiPaths.slice(0, 12) } : {})
    };
}

function diagnosticsFailure(error) {
    return {
        ok: false,
        status: Number(error?.status) || 502,
        detail: safeSnippet(error?.message || String(error)),
        hint: error?.hint || ""
    };
}

async function runDiagnostics(env, requestUrl) {
    const config = getDiagnosticsConfig(env, requestUrl);
    const checks = [];
    const record = (name, result) => checks.push({ name, ...result });

    for (const [name, resource] of [
        ["supabase_profiles", "profiles"],
        ["supabase_aliases_table", "tempmail_user_aliases"]
    ]) {
        try {
            record(name, await checkSupabaseRest(env, resource));
        } catch (error) {
            record(name, diagnosticsFailure(error));
        }
    }

    try {
        if (config.builtin_mailtm) {
            record("builtin_mailtm", await checkMailtmHealth());
        } else {
            record("tempmail_provider", await checkTempmailProvider(env, config));
        }
    } catch (error) {
        record(config.builtin_mailtm ? "builtin_mailtm" : "tempmail_provider", diagnosticsFailure(error));
    }

    const providerReady = config.builtin_mailtm ||
        (config.tempmail_api_url && !config.tempmail_api_self_reference);
    const configOk = config.supabase_url && config.supabase_anon_key &&
        config.supabase_service_role_key && providerReady;
    return {
        ok: Boolean(configOk) && checks.every(check => check.ok),
        checkedAt: new Date().toISOString(),
        config,
        checks
    };
}

export default async function handleTempmail(request, env) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const email = url.searchParams.get("email");
    const messageId = url.searchParams.get("messageId");

    if (!["alias", "status", "diagnostics", "create", "messages", "message"].includes(action)) {
        return jsonResponse(
            { error: "Action tidak dikenal. Gunakan: alias, status, diagnostics, create, messages, atau message." },
            400
        );
    }

    const isWriteAction = action === "create";
    if (isWriteAction ? request.method !== "POST" : request.method !== "GET") {
        return jsonResponse({ error: "Method tidak diizinkan." }, 405);
    }

    if ((action === "messages" || action === "message") && !email) {
        return jsonResponse({ error: "Parameter email wajib diisi untuk action ini." }, 400);
    }

    if (action === "message" && !messageId) {
        return jsonResponse({ error: "Parameter messageId wajib diisi untuk action ini." }, 400);
    }

    let auth;
    try {
        auth = await getTempmailUser(request, env);
    } catch {
        return jsonResponse({ error: "Gagal memverifikasi session Supabase. Coba lagi." }, 502);
    }
    if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

    let role;
    try {
        role = await getTempmailUserRole(env, auth.user.id);
    } catch {
        return jsonResponse({ error: "Gagal memverifikasi role akun." }, 502);
    }

    if (!isTempmailAllowedRole(role)) {
        return jsonResponse({ error: "Fitur TempMail hanya tersedia untuk role admin atau owner." }, 403);
    }

    try {
        if (action === "diagnostics") {
            return jsonResponse(await runDiagnostics(env, url.toString()));
        }

        if (action === "alias" || action === "status") {
            const existing = await getUserTempmailAlias(env, auth.user.id);
            return jsonResponse({
                email: existing?.email || null,
                provider: existing?.provider || null,
                createdAt: existing?.created_at || null
            });
        }

        if (action === "create") {
            const existing = await getUserTempmailAlias(env, auth.user.id);
            if (existing) {
                return jsonResponse({
                    email: existing.email,
                    provider: existing.provider || TEMPMAIL_PROVIDER_DEFAULT,
                    createdAt: existing.created_at || null,
                    reused: true
                });
            }

            const saved = await createUserAlias(env, auth.user.id);
            return jsonResponse({
                email: saved.email,
                provider: saved.provider,
                createdAt: saved.createdAt,
                reused: false
            });
        }

        const alias = await getUserTempmailAlias(env, auth.user.id, email);
        if (!alias) {
            return jsonResponse({ error: "Email tidak ditemukan untuk akun ini." }, 404);
        }

        const result = await requestProviderTempmail(env, alias, action, messageId);
        return jsonResponse(result);
    } catch (error) {
        const message = error instanceof Error && error.message
            ? error.message
            : "Gagal memproses TempMail. Periksa konfigurasi Supabase dan provider.";
        const status = Number(error?.status) || 502;
        const payload = { error: message };
        if (error?.detail) payload.detail = safeSnippet(error.detail);
        if (error?.hint) payload.hint = error.hint;
        return jsonResponse(payload, status);
    }
}
