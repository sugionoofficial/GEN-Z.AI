import { bytesToBase64, clampIntervalHours, extensionForMime, normalizeMimeType } from "../lib/social-publisher/utils.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";
import {
    deleteReferenceObject,
    downloadReferenceObject,
    isPrivateReferenceBucket,
    uploadReferenceObject
} from "../lib/social-publisher/storage.js";

const GRAPH_VERSION = "v26.0";
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

function envValue(env, name) {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(env?.[name] || processValue || "").trim();
}

function json(res, status, body) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(body);
}

function getHeader(req, name) {
    const headers = req.headers || {};
    return headers[name] || headers[name.toLowerCase()] || "";
}

function getQuery(req, name) {
    const query = req.query || {};
    if (Array.isArray(query[name])) return query[name][0] || "";
    return String(query[name] || "");
}

function getBearerToken(req) {
    const match = String(getHeader(req, "authorization") || "").match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function getSupabaseConfig(env) {
    return {
        url: envValue(env, "SUPABASE_URL").replace(/\/+$/, ""),
        serviceRoleKey: envValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
        anonKey: envValue(env, "SUPABASE_ANON_KEY") || envValue(env, "SUPABASE_KEY")
    };
}

async function supabaseRequest(config, path, options = {}) {
    if (!config.url || !config.serviceRoleKey) {
        throw new Error("Konfigurasi Supabase server belum lengkap.");
    }

    const response = await fetch(`${config.url}${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const message = String(data?.message || data?.error_description || data?.hint || "").slice(0, 500);
        const error = new Error(message || `Supabase request gagal (HTTP ${response.status}).`);
        error.status = response.status;
        error.code = data?.code || "";
        throw error;
    }

    return data;
}

function tablePath(table, params = "") {
    return `/rest/v1/${table}${params ? `?${params}` : ""}`;
}

async function verifyAdmin(req, env) {
    const config = getSupabaseConfig(env);
    const token = getBearerToken(req);
    if (!token) {
        const error = new Error("Silakan login dengan akun admin.");
        error.status = 401;
        throw error;
    }
    if (!config.url || !config.anonKey || !config.serviceRoleKey) {
        const error = new Error("Konfigurasi Supabase server belum lengkap.");
        error.status = 500;
        throw error;
    }

    const authResponse = await fetch(`${config.url}/auth/v1/user`, {
        headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }
    });
    const authUser = await authResponse.json().catch(() => null);
    if (!authResponse.ok || !authUser?.id) {
        const error = new Error("Sesi login tidak valid. Silakan login ulang.");
        error.status = 401;
        throw error;
    }

    const profiles = await supabaseRequest(
        config,
        tablePath("profiles", `select=id,role,status&id=eq.${encodeURIComponent(authUser.id)}&limit=1`)
    );
    const profile = profiles?.[0];
    if (!profile || !["ADMIN", "OWNER"].includes(String(profile.role || "").trim().toUpperCase())) {
        const error = new Error("Fitur ini hanya dapat diakses admin atau owner.");
        error.status = 403;
        throw error;
    }
    if (String(profile.status || "").trim().toLowerCase() !== "active") {
        const error = new Error("Akun admin tidak aktif.");
        error.status = 403;
        throw error;
    }

    return { config, userId: authUser.id };
}

function migrationError(error) {
    if (error?.code === "PGRST205" || /social_(characters|post|page|facebook)_/i.test(error?.message || "")) {
        const wrapped = new Error("Skema Social Publisher belum tersedia. Jalankan supabase/social-auto-publisher.sql di Supabase SQL Editor terlebih dahulu.");
        wrapped.status = 503;
        return wrapped;
    }
    return error;
}

function bytesFromBody(body) {
    if (body instanceof Uint8Array) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return new Uint8Array();
}

function hasValidImageSignature(bytes, mime) {
    if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    if (mime === "image/webp") {
        return bytes.length >= 12 &&
            String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
    }
    return false;
}

function cleanText(value, maxLength = 1200) {
    return String(value || "").trim().slice(0, maxLength);
}

function decodeHeader(value) {
    const text = String(value || "");
    try { return decodeURIComponent(text); } catch { return text; }
}

function base64Url(bytes) {
    return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return base64Url(new Uint8Array(digest));
}

function redirect(res, path) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", path);
    res.status(302).end();
}

function callbackLocation(query = "") {
    const safe = String(query || "").replace(/[^a-zA-Z0-9_=&%-]/g, "").slice(0, 240);
    return `/admin-control/social-publisher.html${safe ? `?${safe}` : ""}`;
}

async function handleOAuthCallback(req, res, env) {
    const code = getQuery(req, "code");
    const state = getQuery(req, "state");
    const errorCode = getQuery(req, "error");
    const config = getSupabaseConfig(env);
    const appId = envValue(env, "META_APP_ID");
    const appSecret = envValue(env, "META_APP_SECRET");
    const redirectUri = envValue(env, "META_REDIRECT_URI");
    const encryptionKey = envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY");

    if (!state || !config.url || !config.serviceRoleKey) {
        return redirect(res, callbackLocation("oauth_error=state"));
    }

    try {
        const stateHash = await sha256Base64Url(state);
        const rows = await supabaseRequest(
            config,
            tablePath("facebook_oauth_states", `select=id,user_id,expires_at&state_hash=eq.${encodeURIComponent(stateHash)}&limit=1`)
        );
        const oauthState = rows?.[0];
        if (!oauthState || Date.parse(oauthState.expires_at) <= Date.now()) {
            return redirect(res, callbackLocation("oauth_error=expired"));
        }
        await supabaseRequest(
            config,
            tablePath("facebook_oauth_states", `id=eq.${encodeURIComponent(oauthState.id)}`),
            { method: "DELETE" }
        );

        if (errorCode || !code || !appId || !appSecret || !redirectUri || !encryptionKey) {
            const safeReason = errorCode === "access_denied" ? "denied" : "config";
            return redirect(res, callbackLocation(`oauth_error=${safeReason}`));
        }

        const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
        tokenUrl.searchParams.set("client_id", appId);
        tokenUrl.searchParams.set("client_secret", appSecret);
        tokenUrl.searchParams.set("redirect_uri", redirectUri);
        tokenUrl.searchParams.set("code", code);
        const shortResponse = await fetch(tokenUrl.toString());
        const shortData = await shortResponse.json().catch(() => null);
        if (!shortResponse.ok || !shortData?.access_token) {
            console.error("Facebook OAuth code exchange failed:", shortData?.error?.type || shortResponse.status);
            return redirect(res, callbackLocation("oauth_error=exchange"));
        }

        const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
        longUrl.searchParams.set("grant_type", "fb_exchange_token");
        longUrl.searchParams.set("client_id", appId);
        longUrl.searchParams.set("client_secret", appSecret);
        longUrl.searchParams.set("fb_exchange_token", shortData.access_token);
        const longResponse = await fetch(longUrl.toString());
        const longData = await longResponse.json().catch(() => null);
        if (!longResponse.ok || !longData?.access_token) {
            console.error("Facebook long-lived token exchange failed:", longData?.error?.type || longResponse.status);
            return redirect(res, callbackLocation("oauth_error=exchange"));
        }
        const userToken = longData.access_token;

        const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
        pagesUrl.searchParams.set("fields", "id,name,access_token,tasks");
        pagesUrl.searchParams.set("limit", "100");
        pagesUrl.searchParams.set("access_token", userToken);
        const pagesResponse = await fetch(pagesUrl.toString());
        const pagesData = await pagesResponse.json().catch(() => null);
        if (!pagesResponse.ok || !Array.isArray(pagesData?.data)) {
            console.error("Facebook Pages lookup failed:", pagesData?.error?.type || pagesResponse.status);
            return redirect(res, callbackLocation("oauth_error=pages"));
        }

        const eligiblePages = pagesData.data.filter(page => page?.id && page?.access_token);
        if (!eligiblePages.length) {
            return redirect(res, callbackLocation("oauth_error=no_pages"));
        }

        const connections = [];
        for (const page of eligiblePages) {
            const encrypted = await encryptSecret(page.access_token, encryptionKey);
            const tasks = Array.isArray(page.tasks) ? page.tasks : [];
            connections.push({
                owner_id: oauthState.user_id,
                page_id: String(page.id),
                page_name: cleanText(page.name, 160) || `Facebook Page ${page.id}`,
                page_token_ciphertext: encrypted.ciphertext,
                page_token_iv: encrypted.iv,
                can_publish: tasks.includes("CREATE_CONTENT"),
                page_tasks: tasks,
                token_checked_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }

        await supabaseRequest(
            config,
            tablePath("social_page_connections", "on_conflict=owner_id,page_id"),
            {
                method: "POST",
                headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
                body: JSON.stringify(connections)
            }
        );
        return redirect(res, callbackLocation(`facebook_connected=1&pages=${eligiblePages.length}`));
    } catch (error) {
        console.error("Facebook OAuth callback failed:", error?.message || "unknown error");
        const status = error?.code === "PGRST205" ? "migration" : "callback";
        return redirect(res, callbackLocation(`oauth_error=${status}`));
    }
}

async function getDashboard(config, userId, env) {
    const [characters, pages, schedules, runs, publisherConfig, referenceStorageConfigured] = await Promise.all([
        supabaseRequest(config, tablePath("social_characters", `select=id,display_name,reference_filename,reference_mime_type,prompt_notes,created_at&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`)),
        supabaseRequest(config, tablePath("social_page_connections", `select=id,page_id,page_name,can_publish,page_tasks,token_checked_at,updated_at&owner_id=eq.${encodeURIComponent(userId)}&order=page_name.asc`)),
        supabaseRequest(config, tablePath("social_post_schedules", `select=id,character_id,page_connection_id,enabled,interval_hours,next_run_at,timezone,caption_template,created_at,updated_at&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`)),
        supabaseRequest(config, tablePath("social_post_runs", `select=id,schedule_id,status,scheduled_for,scene_plan,caption,facebook_post_id,permalink_url,profile_share_url,error_message,finished_at,created_at&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=30`)),
        supabaseRequest(config, tablePath("social_publisher_config", "select=id,global_enabled,updated_at&id=eq.true&limit=1")),
        isPrivateReferenceBucket(config)
    ]);

    return {
        success: true,
        characters: characters || [],
        pages: pages || [],
        schedules: schedules || [],
        runs: runs || [],
        globalEnabled: publisherConfig?.[0]?.global_enabled === true,
        config: {
            metaOAuthConfigured: Boolean(envValue(env, "META_APP_ID") && envValue(env, "META_APP_SECRET") && envValue(env, "META_REDIRECT_URI")),
            imageApiConfigured: Boolean(envValue(env, "GEMINI_API_KEY")),
            tokenEncryptionConfigured: Boolean(envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")),
            referenceStorageConfigured
        }
    };
}

async function startOAuth(config, userId, env) {
    const appId = envValue(env, "META_APP_ID");
    const redirectUri = envValue(env, "META_REDIRECT_URI");
    if (!appId || !redirectUri || !envValue(env, "META_APP_SECRET") || !envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")) {
        const error = new Error("Konfigurasi OAuth Meta belum lengkap. Minta admin menyiapkan app ID, app secret, redirect URI, dan kunci enkripsi di Cloudflare.");
        error.status = 503;
        throw error;
    }

    const randomState = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const stateHash = await sha256Base64Url(randomState);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabaseRequest(config, tablePath("facebook_oauth_states"), {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, state_hash: stateHash, expires_at: expiresAt })
    });

    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", randomState);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "pages_show_list,pages_manage_read_engagement,pages_manage_posts,pages_manage_metadata");
    return { authorization_url: url.toString() };
}

async function uploadReference(req, res, config, userId) {
    if (!await isPrivateReferenceBucket(config)) {
        const error = new Error("Bucket privat Supabase Storage untuk foto referensi belum tersedia.");
        error.status = 503;
        throw error;
    }

    const mime = normalizeMimeType(getHeader(req, "content-type"));
    const bytes = bytesFromBody(req.body);
    const consent = String(getHeader(req, "x-character-consent") || "") === "1";
    const adult = String(getHeader(req, "x-character-adult") || "") === "1";
    const displayName = cleanText(decodeHeader(getHeader(req, "x-character-name")), 80) || "Karakter baru";
    const filename = cleanText(decodeHeader(getHeader(req, "x-file-name")), 180) || `reference.${extensionForMime(mime)}`;

    if (!consent || !adult) {
        const error = new Error("Konfirmasi bahwa Anda berhak memakai foto dan subjek/karakter yang digambarkan adalah orang dewasa diperlukan.");
        error.status = 400;
        throw error;
    }
    if (!mime || !bytes.length || bytes.length > MAX_REFERENCE_BYTES || !hasValidImageSignature(bytes, mime)) {
        const error = new Error("File harus berupa JPEG, PNG, atau WebP yang valid dan berukuran maksimal 8 MB.");
        error.status = 400;
        throw error;
    }

    const id = crypto.randomUUID();
    const key = `social-reference/${userId}/${id}.${extensionForMime(mime)}`;
    await uploadReferenceObject(config, key, bytes, mime);

    try {
        const saved = await supabaseRequest(config, tablePath("social_characters", "select=id,display_name,reference_filename,reference_mime_type,prompt_notes,created_at"), {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                id,
                owner_id: userId,
                display_name: displayName,
                reference_object_key: key,
                reference_filename: filename.replace(/[\\/\0]/g, "").slice(0, 180),
                reference_mime_type: mime,
                reference_size_bytes: bytes.length,
                prompt_notes: "",
                confirmed_rights: true,
                confirmed_adult_subject: true
            })
        });
        return json(res, 201, { success: true, character: saved?.[0] || null });
    } catch (error) {
        await deleteReferenceObject(config, key).catch(() => {});
        throw error;
    }
}

async function saveCharacter(config, userId, body) {
    const id = cleanText(body?.id, 80);
    const displayName = cleanText(body?.display_name, 80);
    const promptNotes = cleanText(body?.prompt_notes, 1200);
    if (!id || !displayName) {
        const error = new Error("ID dan nama karakter wajib diisi.");
        error.status = 400;
        throw error;
    }
    const rows = await supabaseRequest(config, tablePath("social_characters", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id`), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ display_name: displayName, prompt_notes: promptNotes, updated_at: new Date().toISOString() })
    });
    if (!rows?.length) {
        const error = new Error("Karakter tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    return rows[0];
}

async function saveSchedule(config, userId, body) {
    const characterId = cleanText(body?.character_id, 80);
    const pageConnectionId = cleanText(body?.page_connection_id, 80);
    const intervalHours = clampIntervalHours(body?.interval_hours);
    const nextRunAt = Date.parse(String(body?.next_run_at || ""));
    const timezone = cleanText(body?.timezone, 80) || "Asia/Jakarta";
    const captionTemplate = cleanText(body?.caption_template, 1000) || "Cerita hari ini dari {location} ✨";
    const id = cleanText(body?.id, 80);

    if (!characterId || !pageConnectionId || !intervalHours || !Number.isFinite(nextRunAt) || nextRunAt < Date.now() - 60_000) {
        const error = new Error("Pilih karakter, Halaman Facebook, interval 1–168 jam, dan waktu mulai di masa depan.");
        error.status = 400;
        throw error;
    }
    if (timezone !== "Asia/Jakarta") {
        const error = new Error("Zona waktu Social Publisher saat ini ditetapkan ke Asia/Jakarta (WIB).");
        error.status = 400;
        throw error;
    }

    const [characters, pages] = await Promise.all([
        supabaseRequest(config, tablePath("social_characters", `select=id&id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)),
        supabaseRequest(config, tablePath("social_page_connections", `select=id,can_publish&id=eq.${encodeURIComponent(pageConnectionId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`))
    ]);
    if (!characters?.length || !pages?.length) {
        const error = new Error("Karakter atau koneksi Page tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    if (pages[0].can_publish === false) {
        const error = new Error("Akun Facebook tidak memiliki tugas CREATE_CONTENT pada Page ini.");
        error.status = 400;
        throw error;
    }

    const values = {
        owner_id: userId,
        character_id: characterId,
        page_connection_id: pageConnectionId,
        interval_hours: intervalHours,
        next_run_at: new Date(nextRunAt).toISOString(),
        timezone,
        caption_template: captionTemplate,
        enabled: body?.enabled === true,
        updated_at: new Date().toISOString()
    };

    if (id) {
        const rows = await supabaseRequest(config, tablePath("social_post_schedules", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id,character_id,page_connection_id,enabled,interval_hours,next_run_at,timezone,caption_template`), {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(values)
        });
        if (!rows?.length) {
            const error = new Error("Jadwal tidak ditemukan.");
            error.status = 404;
            throw error;
        }
        return rows[0];
    }

    const rows = await supabaseRequest(config, tablePath("social_post_schedules", "select=id,character_id,page_connection_id,enabled,interval_hours,next_run_at,timezone,caption_template"), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values)
    });
    return rows?.[0] || null;
}

async function setGlobalEnabled(config, userId, env, enabled) {
    if (enabled) {
        const missing = [];
        if (!envValue(env, "GEMINI_API_KEY")) missing.push("GEMINI_API_KEY");
        if (!envValue(env, "META_APP_ID") || !envValue(env, "META_APP_SECRET") || !envValue(env, "META_REDIRECT_URI")) missing.push("konfigurasi OAuth Meta");
        if (!envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")) missing.push("SOCIAL_TOKEN_ENCRYPTION_KEY");
        if (!await isPrivateReferenceBucket(config)) missing.push("bucket privat Supabase Storage untuk referensi");
        if (missing.length) {
            const error = new Error(`Belum dapat mengaktifkan autopost. Lengkapi: ${missing.join(", ")}.`);
            error.status = 409;
            throw error;
        }
    }

    const rows = await supabaseRequest(config, tablePath("social_publisher_config", "on_conflict=id&select=id,global_enabled,updated_at"), {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ id: true, global_enabled: enabled, updated_by: userId, updated_at: new Date().toISOString() })
    });
    return rows?.[0] || { id: true, global_enabled: enabled };
}

async function handlePost(req, res, config, userId, env, action) {
    if (action === "upload-reference") return uploadReference(req, res, config, userId);
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (action === "set-global-enabled") {
        if (typeof body.enabled !== "boolean") return json(res, 400, { success: false, error: "Nilai enabled harus boolean." });
        const settings = await setGlobalEnabled(config, userId, env, body.enabled);
        return json(res, 200, { success: true, globalEnabled: settings.global_enabled === true });
    }
    if (action === "save-character") {
        return json(res, 200, { success: true, character: await saveCharacter(config, userId, body) });
    }
    if (action === "save-schedule") {
        return json(res, 200, { success: true, schedule: await saveSchedule(config, userId, body) });
    }
    if (action === "delete-schedule") {
        const id = cleanText(body.id, 80);
        if (!id) return json(res, 400, { success: false, error: "ID jadwal wajib diisi." });
        await supabaseRequest(config, tablePath("social_post_schedules", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`), { method: "DELETE" });
        return json(res, 200, { success: true });
    }
    if (action === "disconnect-page") {
        const id = cleanText(body.id, 80);
        if (!id) return json(res, 400, { success: false, error: "ID koneksi Page wajib diisi." });
        const schedules = await supabaseRequest(config, tablePath("social_post_schedules", `select=id&page_connection_id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
        if (schedules?.length) {
            const error = new Error("Hapus jadwal yang masih menggunakan Page ini sebelum memutus koneksi.");
            error.status = 409;
            throw error;
        }
        await supabaseRequest(config, tablePath("social_page_connections", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`), { method: "DELETE" });
        return json(res, 200, { success: true });
    }

    return json(res, 404, { success: false, error: "Action tidak dikenal." });
}

async function handleGet(req, res, config, userId, env, action) {
    if (action === "dashboard") {
        return json(res, 200, await getDashboard(config, userId, env));
    }
    if (action === "oauth-start") {
        return json(res, 200, { success: true, ...(await startOAuth(config, userId, env)) });
    }
    if (action === "reference") {
        const id = cleanText(getQuery(req, "character_id"), 80);
        if (!id) return json(res, 400, { success: false, error: "ID karakter wajib diisi." });
        const rows = await supabaseRequest(config, tablePath("social_characters", `select=reference_object_key,reference_mime_type&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
        const character = rows?.[0];
        if (!character) return json(res, 404, { success: false, error: "Karakter tidak ditemukan." });
        if (!await isPrivateReferenceBucket(config)) {
            return json(res, 503, { success: false, error: "Bucket privat Supabase Storage belum tersedia." });
        }
        let bytes;
        try {
            bytes = await downloadReferenceObject(config, character.reference_object_key);
        } catch (error) {
            if (error?.status === 404) return json(res, 404, { success: false, error: "File referensi tidak tersedia di Supabase Storage." });
            throw error;
        }
        res.setHeader("Content-Type", character.reference_mime_type || "application/octet-stream");
        res.setHeader("Content-Length", String(bytes.length));
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).end(bytes);
    }
    return json(res, 404, { success: false, error: "Action tidak dikenal." });
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name, X-Character-Name, X-Character-Consent, X-Character-Adult");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
    }

    const requestPath = new URL(String(req.url || "/"), "https://social-publisher.invalid").pathname;
    const action = getQuery(req, "action") || (requestPath === "/api/facebook-oauth-callback" ? "oauth-callback" : "dashboard");
    const env = req.env || {};

    if (req.method === "GET" && action === "oauth-callback") {
        return handleOAuthCallback(req, res, env);
    }
    if (req.method !== "GET" && req.method !== "POST") {
        return json(res, 405, { success: false, error: "Method tidak didukung." });
    }

    try {
        const { config, userId } = await verifyAdmin(req, env);
        if (req.method === "GET") return await handleGet(req, res, config, userId, env, action);
        return await handlePost(req, res, config, userId, env, action);
    } catch (rawError) {
        const error = migrationError(rawError);
        if (error.status && error.status < 500) {
            return json(res, error.status, { success: false, error: error.message });
        }
        console.error("Social Publisher API error:", error?.message || "unknown error");
        const status = Number(error?.status) || 500;
        return json(res, status, { success: false, error: status === 500 ? error.message || "Terjadi kesalahan internal." : error.message });
    }
}
