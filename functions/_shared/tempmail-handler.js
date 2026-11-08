/**
 * =========================================================
 * TEMPMAIL HANDLER (/api/tempmail)
 * ---------------------------------------------------------
 * Alur:
 *   browser (Bearer Supabase) -> Worker -> Supabase Auth
 *   -> cek role admin/owner di public.profiles
 *   -> baca/simpan alias per-user di public.tempmail_user_aliases
 *   -> teruskan ke server TempMail-MCP (TEMPMAIL_API_URL)
 *
 * Catatan regresi:
 * Versi lama membungkus SEMUA kegagalan (Supabase REST, provider
 * mati, balasan HTML, timeout) dalam satu catch generik:
 *   "Gagal memproses TempMail. Periksa konfigurasi Supabase dan provider."
 * Admin tidak bisa tahu bagian mana yang rusak. Sekarang setiap
 * tahap punya pesan + HTTP status + detail yang sudah disamarkan,
 * ada timeout untuk semua fetch, ada action `status`/`diagnostics`,
 * dan provider gmail yang nonaktif otomatis jatuh ke provider sehat
 * lain (auto) sesuai kontrak TempMail-MCP.
 * =========================================================
 */

const DEFAULT_PROVIDER_TIMEOUT_MS = 15000;
const DEFAULT_SUPABASE_TIMEOUT_MS = 8000;
const RETRYABLE_PROVIDER_STATUSES = [404, 503];

class TempmailError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "TempmailError";
        this.status = options.status || 502;
        this.detail = options.detail || "";
        this.hint = options.hint || "";
    }
}

function normalizeBaseUrl(value) {
    const raw = String(value || "").trim().replace(/\/+$/, "");
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return "";
        const suffix = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
        return `${parsed.origin}${suffix}`;
    } catch {
        return "";
    }
}

function getTimeout(env, name, fallback) {
    const raw = Number(env?.[name]);
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.min(Math.max(Math.round(raw), 100), 30000);
}

/** Potong & samarkan secret sebelum dikirim ke browser / log. */
function safeSnippet(value, max = 240) {
    return String(value ?? "")
        .replace(/(token|api[_-]?key|password|secret)\s*["']?\s*[:=]\s*["']?[^"'\s&,}]+/gi, "$1=<disamarkan>")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, max);
}

function responseDetail(json, text) {
    if (json && typeof json === "object") {
        const detail = json.detail ?? json.message ?? json.error ?? json.hint;
        return safeSnippet(typeof detail === "string" ? detail : JSON.stringify(detail ?? json));
    }
    return safeSnippet(text);
}

async function fetchWithTimeout(url, options, timeoutMs, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new TempmailError(
                `${label} tidak merespons dalam ${timeoutMs} ms (timeout).`,
                { status: 504, detail: safeSnippet(error?.message || error), hint: "Periksa ketersediaan host / cold start server, lalu coba lagi." }
            );
        }
        throw new TempmailError(
            `${label} tidak dapat dihubungi.`,
            { status: 502, detail: safeSnippet(error?.message || error), hint: "Periksa URL host, DNS/TLS, dan apakah service sedang berjalan." }
        );
    } finally {
        clearTimeout(timer);
    }
}

async function readResponse(response) {
    const text = await response.text();
    const contentType = response.headers.get("Content-Type") || "";
    let json;
    let isJson = false;
    if (text && text.trim()) {
        try {
            json = JSON.parse(text);
            isJson = true;
        } catch {
            /* Balasan bukan JSON (halaman HTML 502 dari proxy, plain text, dll). */
        }
    }
    return { text, json, isJson, contentType };
}

function errorResponse(error, json) {
    const known = error instanceof TempmailError;
    console.error(
        "[TempMail]",
        known ? error.message : "Kesalahan tak terduga",
        error?.detail || error?.message || String(error)
    );

    const payload = {
        error: known
            ? error.message
            : "Gagal memproses TempMail. Periksa konfigurasi Supabase dan provider.",
        detail: known ? safeSnippet(error.detail) : safeSnippet(error?.message || String(error))
    };
    if (known && error.detail) payload.detail = safeSnippet(error.detail);
    if (known && error.hint) payload.hint = error.hint;
    if (!known) payload.hint = "Buka /email.html lalu klik 'Cek Konfigurasi' untuk melihat tahap yang gagal.";

    return json(payload, known ? error.status : 502);
}

async function getTempmailUser(request, env) {
    const authorization = request.headers.get("Authorization") || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
        throw new TempmailError("Silakan login untuk menggunakan TempMail.", { status: 401 });
    }

    const supabaseUrl = normalizeBaseUrl(env.SUPABASE_URL);
    const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || "";
    if (!supabaseUrl || !anonKey) {
        throw new TempmailError(
            "Konfigurasi autentikasi Supabase belum lengkap di Cloudflare (SUPABASE_URL / SUPABASE_ANON_KEY).",
            { status: 500, hint: "Isi secret Worker dengan nilai dari project Supabase yang SAMA dengan assets/js/config.js." }
        );
    }

    const response = await fetchWithTimeout(
        `${supabaseUrl}/auth/v1/user`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${tokenMatch[1]}` } },
        getTimeout(env, "TEMPMAIL_SUPABASE_TIMEOUT_MS", DEFAULT_SUPABASE_TIMEOUT_MS),
        "Supabase Auth (/auth/v1/user)"
    );
    const { json, text } = await readResponse(response);
    if (!response.ok) {
        throw new TempmailError(
            "Session tidak valid atau sudah kedaluwarsa. Silakan login kembali.",
            { status: 401, detail: responseDetail(json, text), hint: "SUPABASE_ANON_KEY/URL Worker harus cocok dengan project yang dipakai browser." }
        );
    }
    if (!json?.id) {
        throw new TempmailError("User Supabase tidak ditemukan.", { status: 401, detail: responseDetail(json, text) });
    }
    return json;
}

function getTempmailDatabaseConfig(env) {
    const supabaseUrl = normalizeBaseUrl(env.SUPABASE_URL);
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl) {
        throw new TempmailError("SUPABASE_URL belum di-set atau bukan URL http(s) yang valid.", {
            status: 500,
            hint: "Isi SUPABASE_URL di Cloudflare Worker / .dev.vars."
        });
    }
    if (!serviceRoleKey) {
        throw new TempmailError("SUPABASE_SERVICE_ROLE_KEY belum di-set di Cloudflare Worker.", {
            status: 500,
            hint: "Handler memakai service role untuk membaca profiles dan tabel alias (RLS ketat)."
        });
    }
    return { supabaseUrl, serviceRoleKey };
}

async function supabaseRest(env, resource, options = {}) {
    const { supabaseUrl, serviceRoleKey } = getTempmailDatabaseConfig(env);
    const url = new URL(`${supabaseUrl}/rest/v1/${resource}`);
    for (const [key, value] of Object.entries(options.searchParams || {})) {
        url.searchParams.set(key, value);
    }

    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json"
    };
    const hasBody = options.body !== undefined;
    if (hasBody) headers["Content-Type"] = "application/json";
    if (options.prefer) headers.Prefer = options.prefer;

    const response = await fetchWithTimeout(
        url,
        {
            method: options.method || "GET",
            headers,
            body: hasBody ? JSON.stringify(options.body) : undefined
        },
        getTimeout(env, "TEMPMAIL_SUPABASE_TIMEOUT_MS", DEFAULT_SUPABASE_TIMEOUT_MS),
        `Supabase REST (${resource})`
    );
    const { json, text, isJson } = await readResponse(response);

    if (!response.ok) {
        const code = String(json?.code || "");
        let hint = "Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY pada Worker (project yang sama dengan frontend).";
        if (response.status === 401 || response.status === 403) {
            hint = "Kunci service role ditolak Supabase. Ganti SUPABASE_SERVICE_ROLE_KEY dengan secret key project yang aktif.";
        }
        if (code === "PGRST205" || (resource === "tempmail_user_aliases" && response.status === 404)) {
            hint = "Tabel public.tempmail_user_aliases belum dikenal PostgREST. Jalankan supabase/tempmail-user-aliases.sql lalu refresh schema cache (NOTIFY pgrst, 'reload schema').";
        }
        throw new TempmailError(
            `Supabase REST (${resource}) menolak permintaan (HTTP ${response.status}).`,
            { status: 502, detail: `${code ? `${code}: ` : ""}${responseDetail(json, text)}`, hint }
        );
    }
    if (text && text.trim() && !isJson) {
        throw new TempmailError(`Supabase REST (${resource}) membalas bukan JSON (HTTP ${response.status}).`, {
            status: 502,
            detail: safeSnippet(text),
            hint: "Pastikan SUPABASE_URL menunjuk ke https://<ref>.supabase.co, bukan halaman aplikasi."
        });
    }
    return json;
}

async function getUserTempmailAlias(env, userId, email) {
    const searchParams = { select: "email,token,provider", user_id: `eq.${userId}`, limit: "1" };
    if (email) searchParams.email = `eq.${email}`;
    const rows = await supabaseRest(env, "tempmail_user_aliases", { searchParams });
    if (!Array.isArray(rows)) {
        throw new TempmailError("Balasan tabel tempmail_user_aliases bukan array.", {
            status: 502,
            detail: safeSnippet(JSON.stringify(rows))
        });
    }
    return rows[0] || null;
}

async function getTempmailUserRole(env, userId) {
    const rows = await supabaseRest(env, "profiles", {
        searchParams: { select: "role", id: `eq.${userId}`, limit: "1" }
    });
    if (!Array.isArray(rows)) {
        throw new TempmailError("Balasan tabel profiles bukan array.", { status: 502 });
    }
    return rows[0]?.role || null;
}

async function saveUserTempmailAlias(env, userId, alias) {
    await supabaseRest(env, "tempmail_user_aliases", {
        method: "POST",
        searchParams: { on_conflict: "user_id" },
        prefer: "resolution=ignore-duplicates,return=minimal",
        body: {
            user_id: userId,
            email: alias.email,
            token: alias.token,
            provider: alias.provider || "gmail"
        }
    });
    return getUserTempmailAlias(env, userId);
}

/**
 * Panggil POST /api/email pada TempMail-MCP.
 * Mengembalikan { alias } atau { error, httpStatus } agar pemanggil bisa
 * memutuskan apakah perlu fallback ke provider `auto`.
 */
async function createProviderAlias(env, tempmailUrl, providerName) {
    const url = new URL(`${tempmailUrl}/api/email`);
    if (providerName) url.searchParams.set("name", providerName);

    let response;
    try {
        response = await fetchWithTimeout(
            url,
            {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ min_name_length: 10, max_name_length: 10 })
            },
            getTimeout(env, "TEMPMAIL_TIMEOUT_MS", DEFAULT_PROVIDER_TIMEOUT_MS),
            "Provider TempMail (/api/email)"
        );
    } catch (error) {
        return { error, httpStatus: 0 };
    }

    const { json, text, isJson, contentType } = await readResponse(response);
    const detail = responseDetail(json, text);
    const label = providerName ? ` (${providerName})` : " (auto)";

    if (!response.ok) {
        return {
            error: new TempmailError(`Provider TempMail${label} menolak pembuatan email (HTTP ${response.status}).`, {
                status: 502,
                detail,
                hint: "Cek GET /api/providers pada server TempMail-MCP: provider bisa nonaktif (health check) atau kredensial IMAP Gmail tidak tersedia."
            }),
            httpStatus: response.status
        };
    }
    if (!isJson || !json || typeof json !== "object" || Array.isArray(json)) {
        return {
            error: new TempmailError(`Provider TempMail${label} membalas bukan JSON (HTTP ${response.status}, ${contentType || "tanpa Content-Type"}).`, {
                status: 502,
                detail: safeSnippet(text),
                hint: "TEMPMAIL_API_URL harus menunjuk ke API TempMail-MCP, bukan halaman HTML / domain aplikasi utama."
            }),
            httpStatus: response.status
        };
    }
    if (!json.email || !json.token) {
        return {
            error: new TempmailError(`Balasan provider TempMail${label} tidak berisi email & token.`, {
                status: 502,
                detail,
                hint: "Pastikan versi server TempMail-MCP sesuai (response POST /api/email: email, token, provider)."
            }),
            httpStatus: response.status
        };
    }
    return { alias: json, httpStatus: response.status };
}

async function runDiagnostics(env) {
    const tempmailUrl = normalizeBaseUrl(env.TEMPMAIL_API_URL);
    const preferredProvider = String(env.TEMPMAIL_PROVIDER || "gmail").trim().toLowerCase() || "gmail";
    const config = {
        supabase_url: Boolean(normalizeBaseUrl(env.SUPABASE_URL)),
        supabase_anon_key: Boolean(env.SUPABASE_ANON_KEY || env.SUPABASE_KEY),
        supabase_service_role_key: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
        tempmail_api_url: Boolean(tempmailUrl),
        tempmail_api_host: tempmailUrl ? new URL(tempmailUrl).host : null,
        preferred_provider: preferredProvider
    };

    const checks = [];
    const record = (name, ok, extra = {}) => checks.push({ name, ok, ...extra });
    const asCheckError = (error) => ({
        status: error instanceof TempmailError ? error.status : 502,
        detail: error instanceof TempmailError ? error.detail : safeSnippet(error?.message || error),
        hint: error instanceof TempmailError ? error.hint : ""
    });

    try {
        const rows = await supabaseRest(env, "profiles", { searchParams: { select: "role", limit: "1" } });
        record("supabase_profiles", Array.isArray(rows), {
            status: 200,
            hint: Array.isArray(rows) ? "" : "Balasan /rest/v1/profiles tidak berupa array."
        });
    } catch (error) {
        record("supabase_profiles", false, asCheckError(error));
    }

    try {
        const rows = await supabaseRest(env, "tempmail_user_aliases", { searchParams: { select: "email", limit: "1" } });
        record("supabase_aliases_table", Array.isArray(rows), {
            status: 200,
            hint: Array.isArray(rows) ? "" : "Balasan /rest/v1/tempmail_user_aliases tidak berupa array."
        });
    } catch (error) {
        record("supabase_aliases_table", false, asCheckError(error));
    }

    if (!tempmailUrl) {
        record("tempmail_provider", false, {
            status: 0,
            hint: "TEMPMAIL_API_URL belum di-set atau bukan URL http(s) yang valid. Isi secret Cloudflare Worker / .dev.vars."
        });
    } else {
        try {
            const response = await fetchWithTimeout(
                `${tempmailUrl}/api/providers`,
                { headers: { Accept: "application/json" } },
                getTimeout(env, "TEMPMAIL_TIMEOUT_MS", DEFAULT_PROVIDER_TIMEOUT_MS),
                "Provider TempMail (/api/providers)"
            );
            const { json, text, isJson } = await readResponse(response);
            const providers = Array.isArray(json)
                ? json.map(item => ({
                    name: String(item?.name || ""),
                    disabled: Boolean(item?.disabled),
                    failures: Number(item?.failures || 0)
                }))
                : [];
            const preferred = providers.find(item => item.name === preferredProvider);
            let hint = "";
            if (!response.ok || !isJson) {
                hint = "Endpoint /api/providers tidak membalas JSON. Pastikan TEMPMAIL_API_URL menunjuk ke server TempMail-MCP.";
            } else if (providers.length && providers.every(item => item.disabled)) {
                hint = "Semua provider sedang nonaktif (circuit breaker). Aktifkan ulang lewat POST /api/providers/{name}/enable.";
            } else if (preferredProvider !== "auto" && !preferred) {
                hint = `Provider '${preferredProvider}' tidak terdaftar di server. Set TEMPMAIL_PROVIDER=auto untuk memakai fallback otomatis.`;
            } else if (preferred?.disabled) {
                hint = `Provider '${preferredProvider}' sedang nonaktif; pembuatan email akan memakai fallback otomatis.`;
            }
            record("tempmail_provider", response.ok && isJson, {
                status: response.status,
                detail: response.ok && isJson ? "" : responseDetail(json, text),
                providers,
                hint
            });
        } catch (error) {
            record("tempmail_provider", false, asCheckError(error));
        }
    }

    const configOk = config.supabase_url && config.supabase_anon_key &&
        config.supabase_service_role_key && config.tempmail_api_url;
    return {
        ok: Boolean(configOk) && checks.every(check => check.ok),
        checkedAt: new Date().toISOString(),
        config,
        checks
    };
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
    const actions = ["create", "messages", "message", "status", "diagnostics"];

    if (!actions.includes(action)) {
        return json({ error: "Action tidak dikenal. Gunakan: create, messages, message, status, atau diagnostics" }, 400);
    }
    if ((action === "create" && request.method !== "POST") || (action !== "create" && request.method !== "GET")) {
        return json({ error: "Method tidak diizinkan." }, 405);
    }
    if (["messages", "message"].includes(action) && (!email || (action === "message" && !messageId))) {
        return json({ error: "Parameter email dan messageId wajib diisi sesuai action." }, 400);
    }

    let user;
    try {
        user = await getTempmailUser(request, env);
    } catch (error) {
        return errorResponse(error, json);
    }

    let role;
    try {
        role = await getTempmailUserRole(env, user.id);
    } catch (error) {
        return errorResponse(error, json);
    }
    if (!["admin", "owner"].includes(String(role || "").trim().toLowerCase())) {
        return json({ error: "Fitur TempMail hanya tersedia untuk role admin atau owner." }, 403);
    }

    const rawTempmailUrl = String(env.TEMPMAIL_API_URL || "").trim();
    const tempmailUrl = normalizeBaseUrl(rawTempmailUrl);
    if (["create", "messages", "message"].includes(action)) {
        if (!rawTempmailUrl) {
            return json({
                error: "TEMPMAIL_API_URL belum di-set di Cloudflare Worker.",
                hint: "Isi secret TEMPMAIL_API_URL dengan URL server TempMail-MCP, lalu cek lewat action=diagnostics."
            }, 500);
        }
        if (!tempmailUrl) {
            return json({
                error: "TEMPMAIL_API_URL bukan URL http(s) yang valid.",
                detail: safeSnippet(rawTempmailUrl)
            }, 500);
        }
    }

    try {
        if (action === "diagnostics") {
            return json(await runDiagnostics(env));
        }

        if (action === "status") {
            const alias = await getUserTempmailAlias(env, user.id);
            return json({ email: alias?.email || null, provider: alias?.provider || null });
        }

        if (action === "create") {
            const existing = await getUserTempmailAlias(env, user.id);
            if (existing) return json({ email: existing.email, provider: existing.provider || null });

            const preferred = String(env.TEMPMAIL_PROVIDER || "gmail").trim().toLowerCase() || "gmail";
            const usePreferred = preferred !== "auto";
            let attempt = await createProviderAlias(env, tempmailUrl, usePreferred ? preferred : "");

            /* gmail bisa tidak terdaftar / auto-disabled oleh health check
               TempMail-MCP. Jangan biarkan fitur mati total: ulangi tanpa
               `name` supaya server memilih provider sehat pertama. */
            if (attempt.error && usePreferred && RETRYABLE_PROVIDER_STATUSES.includes(attempt.httpStatus)) {
                console.warn("[TempMail] Provider", preferred, "gagal, mencoba fallback auto:", attempt.error.detail);
                const fallback = await createProviderAlias(env, tempmailUrl, "");
                if (!fallback.error) attempt = fallback;
            }
            if (attempt.error) throw attempt.error;

            const alias = attempt.alias;
            const provider = String(alias.provider || (usePreferred ? preferred : "")).trim();
            if (!provider) {
                throw new TempmailError("Provider tidak diketahui dari balasan TempMail-MCP.", {
                    status: 502,
                    detail: safeSnippet(JSON.stringify(alias)),
                    hint: "Server provider wajib mengirim field `provider` agar inbox bisa dibaca kembali."
                });
            }

            const savedAlias = await saveUserTempmailAlias(env, user.id, {
                email: alias.email,
                token: alias.token,
                provider
            });
            if (!savedAlias) {
                throw new TempmailError("Alias TempMail gagal disimpan ke Supabase.", {
                    status: 502,
                    hint: "Cek grant service_role pada public.tempmail_user_aliases (lihat supabase/tempmail-user-aliases.sql)."
                });
            }
            return json({ email: savedAlias.email, provider: savedAlias.provider || provider });
        }

        const alias = await getUserTempmailAlias(env, user.id, email);
        if (!alias) return json({ error: "Email tidak ditemukan untuk akun ini." }, 404);

        const provider = encodeURIComponent(String(alias.provider || "gmail").trim());
        const targetUrl = action === "messages"
            ? `${tempmailUrl}/api/email/${encodeURIComponent(alias.email)}/messages?token=${encodeURIComponent(alias.token)}&name=${provider}`
            : `${tempmailUrl}/api/email/${encodeURIComponent(alias.email)}/message/${encodeURIComponent(messageId)}?token=${encodeURIComponent(alias.token)}&name=${provider}`;

        const response = await fetchWithTimeout(
            targetUrl,
            { headers: { Accept: "application/json" } },
            getTimeout(env, "TEMPMAIL_TIMEOUT_MS", DEFAULT_PROVIDER_TIMEOUT_MS),
            "Provider TempMail (inbox)"
        );
        const { text, isJson, contentType } = await readResponse(response);

        /* Jangan teruskan HTML/error page mentah: browser memanggil
           response.json() dan hanya menampilkan "Unexpected token <". */
        if (!isJson) {
            return json({
                error: `Provider TempMail (inbox) membalas bukan JSON (HTTP ${response.status}).`,
                detail: safeSnippet(text),
                hint: "Periksa TEMPMAIL_API_URL dan status server TempMail-MCP lewat 'Cek Konfigurasi'."
            }, response.status >= 400 && response.status <= 599 ? response.status : 502);
        }

        const status = response.status;
        return new Response([204, 205, 304].includes(status) ? null : text, {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type": contentType || "application/json"
            }
        });
    } catch (error) {
        return errorResponse(error, json);
    }
}
