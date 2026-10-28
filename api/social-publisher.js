import {
    applyOutfitToScene,
    buildImagePrompt,
    bytesToBase64,
    clampIntervalMinutes,
    formatIntervalMinutes,
    composeSocialCaption,
    createScenePlan,
    DEFAULT_SOCIAL_RUNS_PER_PAGE,
    extensionForMime,
    getScheduleIntervalPolicy,
    normalizeMimeType,
    normalizeRunsPage,
    normalizeRunsPerPage,
    normalizeSocialAspectRatio,
    parseContentRangeTotal,
    pickRandomOutfit,
    renderCaption,
    sanitizeHttpsUrl,
    SCENE_PRESETS
} from "../lib/social-publisher/utils.js";
import {
    BUILTIN_STORY_SONGS,
    buildQuoteImagePrompt,
    cleanQuoteText,
    createQuotePlan,
    DEFAULT_FACEBOOK_SONGS,
    findBuiltinStorySong,
    normalizeQuotePublishTarget,
    normalizeSocialPostMode,
    pickRandomFacebookSong,
    QUOTE_PRESETS,
    quoteOverridesFromSchedule,
    sanitizeFacebookSongUrl
} from "../lib/social-publisher/quotes.js";
import {
    checkFacebookPageAccess,
    decryptSecret,
    encryptSecret,
    normalizeTextProvider,
    generateSocialContextCaption,
    generateSocialImage,
    generateSocialQuote,
    generateSocialQuoteImage,
    inspectFacebookPageToken,
    makeProfileShareUrl,
    publishFacebookPhoto,
    publishFacebookQuoteVideo,
    testCloudflareImageProvider,
    testTencentImageProvider,
    testPuterImageProvider,
    testOpusImageProvider
} from "../lib/social-publisher/providers.js";
import {
    opusConfigured,
    opusImageModel,
    OPUS_IMAGE_MODELS,
    OPUS_DEFAULT_IMAGE_MODEL,
    OPUS_MAX_REFERENCE_IMAGES,
    OPUS_DEFAULT_ASPECT_RATIO,
    OPUS_DEFAULT_IMAGE_QUALITY,
    normalizeOpusImageModel,
    resolveOpusAspectRatio
} from "../lib/social-publisher/opus.js";
import {
    getModelQuotas,
    normalizeQwenCloudImageModel,
    normalizeQwenCloudLlmModel,
    normalizeQwenCloudQuotaModel,
    QWENCLOUD_IMAGE_MODELS,
    QWENCLOUD_LLM_MODELS,
    quotaPercentAvailable,
    recordModelUsage,
    resetModelQuota,
    setModelQuotaLimit
} from "../lib/social-publisher/quotas.js";
import {
    createSignedReferenceUrl,
    deleteReferenceObject,
    deleteStoryAudioObject,
    downloadModelReference,
    downloadReferenceObject,
    downloadStoryAudioObject,
    isPrivateReferenceBucket,
    loadBuiltinStoryAudio,
    resolveStorySongAudioBytes,
    uploadReferenceObject,
    uploadStoryAudioObject
} from "../lib/social-publisher/storage.js";
import {
    encodeStoryMp4,
    extractAudioForStoryMp4,
    maxQuoteVideoDurationForTarget,
    renderQuoteStoryCard,
    STORY_MAX_DURATION_FEED_REELS_SEC
} from "../lib/social-publisher/story-video.js";
import { stripImageMetadata } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";
import { describeApiFailure, loggableErrorDetails } from "../lib/social-publisher/api-error.js";

const GRAPH_VERSION = "v26.0";
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const MAX_SONG_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_OUTFITS_PER_CHARACTER = 50;
const MAX_FACEBOOK_SONGS_PER_USER = 100;
const SCHEDULE_COLUMNS = [
    "id",
    "character_id",
    "page_connection_id",
    "enabled",
    "autopublish_enabled",
    "interval_hours",
    "interval_minutes",
    "next_run_at",
    "timezone",
    "aspect_ratio",
    "caption_template",
    "scene_location",
    "camera_angle",
    "scene_situation",
    "scene_lighting",
    "scene_atmosphere",
    "scene_condition",
    "scene_details",
    "negative_prompt"
].join(",");
const SCHEDULE_QUOTE_BASE_COLUMNS = [
    SCHEDULE_COLUMNS,
    "post_mode",
    "quote_theme",
    "quote_visual_style",
    "use_random_song"
].join(",");
const SCHEDULE_FULL_COLUMNS = [
    SCHEDULE_QUOTE_BASE_COLUMNS,
    "quote_publish_target"
].join(",");
const OAUTH_STATE_COOKIE = "__Secure-social-oauth-state";
const OAUTH_STATE_COOKIE_PATH = "/api/facebook-oauth-callback";

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
    if (query[name] !== undefined) return String(query[name] || "");
    try {
        return new URL(String(req.url || "/"), "https://social-publisher.invalid").searchParams.get(name) || "";
    } catch {
        return "";
    }
}

function getBearerToken(req) {
    const match = String(getHeader(req, "authorization") || "").match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function getCookie(req, name) {
    const cookies = String(getHeader(req, "cookie") || "").split(";");
    for (const cookie of cookies) {
        const separator = cookie.indexOf("=");
        if (separator > 0 && cookie.slice(0, separator).trim() === name) {
            return cookie.slice(separator + 1).trim();
        }
    }
    return "";
}

function getSupabaseConfig(env) {
    return {
        url: envValue(env, "SUPABASE_URL").replace(/\/+$/, ""),
        serviceRoleKey: envValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
        anonKey: envValue(env, "SUPABASE_ANON_KEY") || envValue(env, "SUPABASE_KEY")
    };
}

async function supabaseRequestWithHeaders(config, path, options = {}) {
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
        error.headers = response.headers;
        throw error;
    }

    return { data, headers: response.headers };
}

async function supabaseRequest(config, path, options = {}) {
    const { data } = await supabaseRequestWithHeaders(config, path, options);
    return data;
}

function tablePath(table, params = "") {
    return `/rest/v1/${table}${params ? `?${params}` : ""}`;
}

async function verifyAdmin(req, env) {
    const config = getSupabaseConfig(env);
    const token = getBearerToken(req);
    if (!token) {
        const error = new Error("Silakan login dengan akun aktif.");
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
        tablePath("profiles", `select=id,role,status,post_limit&id=eq.${encodeURIComponent(authUser.id)}&limit=1`)
    );
    const profile = profiles?.[0];
    if (!profile) {
        const error = new Error("Akun tidak terdaftar di profil pengguna.");
        error.status = 403;
        throw error;
    }
    if (String(profile.status || "").trim().toLowerCase() !== "active") {
        const error = new Error("Akun tidak aktif.");
        error.status = 403;
        throw error;
    }

    return { config, userId: authUser.id, profile };
}

function requireStudioAdmin(profile) {
    if (!["ADMIN", "OWNER"].includes(String(profile?.role || "").trim().toUpperCase())) {
        const error = new Error("Akses hanya tersedia untuk admin.");
        error.status = 403;
        throw error;
    }
}

async function getStudioAccessStatus(config, userId) {
    try {
        const rows = await supabaseRequest(
            config,
            tablePath("studio_medsos_access", `select=user_id,is_active,duration_days,started_at,expires_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
        );
        const access = rows?.[0] || null;
        const startsAt = access?.started_at ? Date.parse(access.started_at) : 0;
        const expiresAt = access?.expires_at ? Date.parse(access.expires_at) : 0;
        const now = Date.now();
        const active = Boolean(access?.is_active) &&
            Number.isFinite(startsAt) && startsAt <= now &&
            Number.isFinite(expiresAt) && expiresAt > now;

        return {
            active,
            user_id: access?.user_id || userId,
            is_active: Boolean(access?.is_active),
            duration_days: Number(access?.duration_days ?? 0),
            started_at: access?.started_at || null,
            expires_at: access?.expires_at || null,
            expired: Boolean(access) && (!Number.isFinite(expiresAt) || expiresAt <= now),
            pending: Boolean(access?.is_active) && Number.isFinite(startsAt) && startsAt > now
        };
    } catch (error) {
        if (error?.status === 404 || error?.code === "PGRST205" || /studio_medsos_access|does not exist|relation .*studio_medsos_access/i.test(String(error?.message || ""))) {
            return { active: false, user_id: userId, is_active: false, duration_days: 0, started_at: null, expires_at: null, expired: false, pending: false };
        }
        throw error;
    }
}

async function ensureStudioAccess(config, userId) {
    const access = await getStudioAccessStatus(config, userId);
    if (!access.active) {
        const error = new Error("Akun Anda tidak aktif sebagai langganan Studio Medsos.");
        error.status = 403;
        error.details = access;
        throw error;
    }
    return access;
}

async function listStudioUsers(config) {
    const [profiles, accessRows] = await Promise.all([
        supabaseRequest(
            config,
            tablePath("profiles", "select=id,email,name,role,status,post_limit&order=email.asc&limit=1000")
        ),
        supabaseRequest(
            config,
            tablePath("studio_medsos_access", "select=user_id,is_active,duration_days,started_at,expires_at")
        )
    ]);
    const accessByUser = new Map((accessRows || []).map(access => [access.user_id, access]));
    return (profiles || []).map(profile => ({
        ...profile,
        studio_access: accessByUser.get(profile.id) || null
    }));
}

async function saveStudioAccess(config, adminId, body = {}) {
    const userId = String(body.user_id || "").trim();
    const durationDays = Number(body.duration_days);
    const startedAt = Date.parse(body.started_at);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        const error = new Error("ID user tidak valid.");
        error.status = 400;
        throw error;
    }
    if (typeof body.is_active !== "boolean") {
        const error = new Error("Status langganan harus berupa boolean.");
        error.status = 400;
        throw error;
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
        const error = new Error("Durasi langganan harus antara 1 dan 365 hari.");
        error.status = 400;
        throw error;
    }
    if (!Number.isFinite(startedAt)) {
        const error = new Error("Tanggal mulai langganan tidak valid.");
        error.status = 400;
        throw error;
    }

    const startedAtIso = new Date(startedAt).toISOString();
    const expiresAt = new Date(startedAt + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRequest(
        config,
        tablePath("studio_medsos_access", "on_conflict=user_id&select=user_id,is_active,duration_days,started_at,expires_at"),
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({
                user_id: userId,
                is_active: body.is_active,
                duration_days: durationDays,
                started_at: startedAtIso,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
                updated_by: adminId
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Pengaturan langganan tidak berhasil disimpan.");
        error.status = 500;
        throw error;
    }

    const access = rows[0];
    const now = Date.now();
    const stillActive = access.is_active === true &&
        Date.parse(access.started_at) <= now &&
        Date.parse(access.expires_at) > now;

    if (stillActive) {
        await resumeSchedulesAfterActivation(config, userId).catch(error => {
            console.error("Gagal mengaktifkan kembali jadwal auto publish:", error?.message || error);
        });
    } else {
        await pauseSchedulesForInactiveSubscription(config, userId).catch(error => {
            console.error("Gagal menjeda jadwal auto publish:", error?.message || error);
        });
    }

    return access;
}

const STUDIO_ACCESS_SELECT = "select=user_id,is_active,duration_days,started_at,expires_at";
const DAY_MS = 24 * 60 * 60 * 1000;

async function findStudioAccessRow(config, userId) {
    const rows = await supabaseRequest(
        config,
        tablePath("studio_medsos_access", `${STUDIO_ACCESS_SELECT}&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    return rows?.[0] || null;
}

function assertStudioUserId(userId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(userId || ""))) {
        const error = new Error("ID user tidak valid.");
        error.status = 400;
        throw error;
    }
}

async function writeStudioAccessRow(config, adminId, payload) {
    const rows = await supabaseRequest(
        config,
        tablePath("studio_medsos_access", `on_conflict=user_id&${STUDIO_ACCESS_SELECT}`),
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({
                ...payload,
                updated_at: new Date().toISOString(),
                updated_by: adminId
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Pengaturan langganan tidak berhasil disimpan.");
        error.status = 500;
        throw error;
    }
    return rows[0];
}

const SUBSCRIPTION_INACTIVE_REASON = "subscription_inactive";

function isMissingPausedReasonColumn(error) {
    if (error?.code === "PGRST204" || error?.code === "42703") return true;
    return /paused_reason/i.test(String(error?.message || ""));
}

/**
 * Jeda semua jadwal auto publish milik user ketika langganannya berhenti.
 * Best-effort: kegagalan di sini tidak boleh menggagalkan aksi admin.
 */
async function pauseSchedulesForInactiveSubscription(config, ownerId) {
    if (!ownerId) return 0;
    const payload = {
        enabled: false,
        paused_reason: SUBSCRIPTION_INACTIVE_REASON,
        updated_at: new Date().toISOString()
    };
    try {
        await supabaseRequest(
            config,
            tablePath("social_post_schedules", `owner_id=eq.${encodeURIComponent(ownerId)}&enabled=eq.true`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(payload)
            }
        );
        return 1;
    } catch (error) {
        if (!isMissingPausedReasonColumn(error)) throw error;
    }
    /* Deployment lama tanpa kolom paused_reason: tetap jeda jadwalnya. */
    return supabaseRequest(
        config,
        tablePath("social_post_schedules", `owner_id=eq.${encodeURIComponent(ownerId)}&enabled=eq.true`),
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ enabled: false, updated_at: payload.updated_at })
        }
    ).then(() => 1);
}

/**
 * Aktifkan kembali jadwal yang dijeda otomatis karena langganan berhenti.
 * Jadwal yang dijeda manual oleh user tidak disentuh (paused_reason kosong).
 */
async function resumeSchedulesAfterActivation(config, ownerId) {
    if (!ownerId) return 0;
    let rows;
    try {
        rows = await supabaseRequest(
            config,
            tablePath(
                "social_post_schedules",
                `select=id,interval_hours&owner_id=eq.${encodeURIComponent(ownerId)}&enabled=eq.false&paused_reason=eq.${SUBSCRIPTION_INACTIVE_REASON}`
            )
        );
    } catch (error) {
        if (!isMissingPausedReasonColumn(error)) throw error;
        return 0;
    }
    const list = Array.isArray(rows) ? rows : [];
    let resumed = 0;
    for (const row of list) {
        const intervalHours = Math.min(168, Math.max(1, Number(row.interval_hours) || 24));
        try {
            await supabaseRequest(
                config,
                tablePath("social_post_schedules", `id=eq.${encodeURIComponent(row.id)}&owner_id=eq.${encodeURIComponent(ownerId)}`),
                {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({
                        enabled: true,
                        paused_reason: null,
                        next_run_at: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                }
            );
            resumed += 1;
        } catch (error) {
            console.error("Tidak bisa mengaktifkan kembali jadwal auto publish:", error?.message || error);
        }
    }
    return resumed;
}

/*
 * Tambah / kurangi masa aktif langganan.
 *
 * body.days positif  = menambah masa aktif
 * body.days negatif  = mengurangi masa aktif
 *
 * started_at lama dipertahankan bila masih wajar, expires_at
 * digeser sesuai jumlah hari, duration_days dihitung ulang.
 */
async function extendStudioAccess(config, adminId, body = {}) {
    const userId = String(body.user_id || "").trim();
    assertStudioUserId(userId);

    const days = Number(body.days);
    if (!Number.isInteger(days) || days === 0 || days < -365 || days > 365) {
        const error = new Error("Jumlah hari harus bilangan bulat antara -365 dan 365 dan tidak nol.");
        error.status = 400;
        throw error;
    }

    const current = await findStudioAccessRow(config, userId);
    if (!current) {
        const error = new Error("User ini belum memiliki data langganan Studio Medsos.");
        error.status = 404;
        throw error;
    }
    if (current.is_active !== true) {
        const error = new Error("Langganan user sedang nonaktif. Aktifkan dulu sebelum menambah atau mengurangi masa aktif.");
        error.status = 409;
        throw error;
    }

    const now = Date.now();
    const currentExpiry = Date.parse(current.expires_at || "");
    const base = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
    const nextExpiry = base + days * DAY_MS;

    if (nextExpiry <= now) {
        const error = new Error("Pengurangan melebihi sisa masa aktif. Gunakan tombol Stop untuk menghentikan langganan.");
        error.status = 400;
        throw error;
    }

    let startedAt = Date.parse(current.started_at || "");
    if (!Number.isFinite(startedAt) || startedAt >= nextExpiry) {
        startedAt = now;
    }

    const durationDays = Math.round((nextExpiry - startedAt) / DAY_MS);

    if (durationDays > 3650) {
        const error = new Error("Total masa aktif melebihi batas 3650 hari.");
        error.status = 400;
        throw error;
    }

    const access = await writeStudioAccessRow(config, adminId, {
        user_id: userId,
        is_active: true,
        duration_days: Math.max(1, durationDays),
        started_at: new Date(startedAt).toISOString(),
        expires_at: new Date(nextExpiry).toISOString()
    });

    await resumeSchedulesAfterActivation(config, userId).catch(error => {
        console.error("Gagal mengaktifkan kembali jadwal auto publish:", error?.message || error);
    });

    return access;
}

/*
 * Stop langganan: is_active = false, tanggal & durasi dibiarkan
 * agar riwayat tetap terbaca saat admin mengaktifkan kembali.
 */
async function stopStudioAccess(config, adminId, body = {}) {
    const userId = String(body.user_id || "").trim();
    assertStudioUserId(userId);

    const current = await findStudioAccessRow(config, userId);
    if (!current) {
        const error = new Error("User ini belum memiliki data langganan Studio Medsos.");
        error.status = 404;
        throw error;
    }

    const access = await writeStudioAccessRow(config, adminId, {
        user_id: userId,
        is_active: false,
        duration_days: Number(current.duration_days) > 0 ? Number(current.duration_days) : 30,
        started_at: current.started_at || new Date().toISOString(),
        expires_at: current.expires_at || new Date(Date.now() + 30 * DAY_MS).toISOString()
    });

    /* Stop langganan = auto publish user langsung berhenti, tanpa menunggu cron. */
    await pauseSchedulesForInactiveSubscription(config, userId).catch(error => {
        console.error("Gagal menjeda jadwal auto publish:", error?.message || error);
    });

    return access;
}

async function getStudioPricing(config) {
    const rows = await supabaseRequest(
        config,
        tablePath("studio_medsos_pricing", "select=price_daily_idr,price_weekly_idr,price_monthly_idr,price_yearly_idr,updated_at&id=eq.true&limit=1")
    );
    const pricing = rows?.[0] || null;
    return {
        price_daily_idr: pricing?.price_daily_idr == null ? null : Number(pricing.price_daily_idr),
        price_weekly_idr: pricing?.price_weekly_idr == null ? null : Number(pricing.price_weekly_idr),
        price_monthly_idr: pricing?.price_monthly_idr == null ? null : Number(pricing.price_monthly_idr),
        price_yearly_idr: pricing?.price_yearly_idr == null ? null : Number(pricing.price_yearly_idr),
        updated_at: pricing?.updated_at || null
    };
}

async function saveStudioPricing(config, adminId, body = {}) {
    const periods = ["daily", "weekly", "monthly", "yearly"];
    const prices = {};
    for (const period of periods) {
        const key = `price_${period}_idr`;
        const price = body[key];
        if (price !== null && (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0)) {
            const error = new Error(`Harga ${period} harus berupa bilangan bulat Rupiah nol atau lebih, atau dikosongkan.`);
            error.status = 400;
            throw error;
        }
        prices[key] = price ?? null;
    }

    const rows = await supabaseRequest(
        config,
        tablePath("studio_medsos_pricing", "on_conflict=id&select=price_daily_idr,price_weekly_idr,price_monthly_idr,price_yearly_idr,updated_at"),
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({
                id: true,
                ...prices,
                price_idr: prices.price_monthly_idr ?? 0,
                updated_at: new Date().toISOString(),
                updated_by: adminId
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Harga langganan tidak berhasil disimpan.");
        error.status = 500;
        throw error;
    }
    return {
        price_daily_idr: rows[0].price_daily_idr == null ? null : Number(rows[0].price_daily_idr),
        price_weekly_idr: rows[0].price_weekly_idr == null ? null : Number(rows[0].price_weekly_idr),
        price_monthly_idr: rows[0].price_monthly_idr == null ? null : Number(rows[0].price_monthly_idr),
        price_yearly_idr: rows[0].price_yearly_idr == null ? null : Number(rows[0].price_yearly_idr),
        updated_at: rows[0].updated_at || null
    };
}

function migrationError(error) {
    if (/studio_medsos_pricing/i.test(error?.message || "")) {
        const wrapped = new Error("Tabel harga Studio Medsos belum tersedia. Jalankan supabase/studio-medsos-pricing.sql di Supabase SQL Editor terlebih dahulu.");
        wrapped.status = 503;
        return wrapped;
    }
    if (error?.code === "PGRST205" || /social_(characters|outfits|post|page|facebook)_/i.test(error?.message || "")) {
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

/**
 * Reads the permissions actually granted to the long-lived user token, per
 * Page when Meta returns them. This catches the "(#200) Permissions error"
 * case where the Page role exists but `pages_manage_posts` was never granted.
 */
async function readFacebookGrantedPermissions({ appId, appSecret, userToken, graphVersion }) {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/debug_token`);
    url.searchParams.set("input_token", userToken);
    url.searchParams.set("access_token", `${appId}|${appSecret}`);
    try {
        const response = await fetch(url.toString());
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.error || data?.data?.is_valid === false) return null;
        const token = data?.data || {};
        return {
            scopes: Array.isArray(token.scopes) ? token.scopes.map(String) : [],
            granularScopes: Array.isArray(token.granular_scopes) ? token.granular_scopes : [],
            userId: token.user_id ? String(token.user_id) : ""
        };
    } catch {
        return null;
    }
}

function pageScopeGranted(permissions, scope, pageId) {
    if (!permissions) return null;
    const entry = permissions.granularScopes.find(item => item?.scope === scope);
    if (entry) {
        const targets = Array.isArray(entry.target_ids) ? entry.target_ids.map(String) : [];
        return targets.includes(String(pageId));
    }
    if (permissions.scopes.length) return permissions.scopes.includes(scope);
    return null;
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

    if (!state || getCookie(req, OAUTH_STATE_COOKIE) !== state || !config.url || !config.serviceRoleKey) {
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

        const permissions = await readFacebookGrantedPermissions({
            appId,
            appSecret,
            userToken,
            graphVersion: GRAPH_VERSION
        });

        // Remember which Facebook user authorized the Pages so a Meta data
        // deletion request can be traced back to this account.
        if (permissions?.userId) {
            try {
                await supabaseRequest(
                    config,
                    tablePath("social_facebook_identities", "on_conflict=owner_id"),
                    {
                        method: "POST",
                        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
                        body: JSON.stringify({
                            owner_id: oauthState.user_id,
                            fb_user_id: permissions.userId,
                            updated_at: new Date().toISOString()
                        })
                    }
                );
            } catch (error) {
                // Migration may not be applied yet; never block the Page connection.
                console.error("Could not record Facebook identity:", error?.message || "unknown error");
            }
        }

        const connections = [];
        let pagesNeedingPermission = 0;
        for (const page of eligiblePages) {
            const encrypted = await encryptSecret(page.access_token, encryptionKey);
            const tasks = Array.isArray(page.tasks) ? page.tasks.map(String) : [];
            const managePostsGranted = pageScopeGranted(permissions, "pages_manage_posts", page.id);
            const canPublish = tasks.includes("CREATE_CONTENT") && managePostsGranted !== false;
            if (!canPublish) pagesNeedingPermission += 1;
            connections.push({
                owner_id: oauthState.user_id,
                page_id: String(page.id),
                page_name: cleanText(page.name, 160) || `Facebook Page ${page.id}`,
                page_token_ciphertext: encrypted.ciphertext,
                page_token_iv: encrypted.iv,
                can_publish: canPublish,
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
        return redirect(res, callbackLocation(
            `facebook_connected=1&pages=${eligiblePages.length}${pagesNeedingPermission ? `&need_permission=${pagesNeedingPermission}` : ""}`
        ));
    } catch (error) {
        console.error("Facebook OAuth callback failed:", error?.message || "unknown error");
        const status = error?.code === "PGRST205" ? "migration" : "callback";
        return redirect(res, callbackLocation(`oauth_error=${status}`));
    }
}

async function listRunsForDashboard(config, userId, paginationOptions = {}) {
    const perPage = normalizeRunsPerPage(paginationOptions.perPage, DEFAULT_SOCIAL_RUNS_PER_PAGE);
    let page = normalizeRunsPage(paginationOptions.page);
    const columns = "id,schedule_id,status,scheduled_for,scene_plan,caption";

    async function fetchPageSlice(targetPage) {
        const offset = (targetPage - 1) * perPage;
        const tail = `&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${perPage}&offset=${offset}`;
        const requestOptions = { headers: { Prefer: "count=exact" } };
        try {
            return await supabaseRequestWithHeaders(
                config,
                tablePath("social_post_runs", `select=${columns},outfit_name,outfit_order_url,post_mode,quote_text,quote_theme,quote_publish_target,song_id,song_title,song_artist,song_facebook_url,facebook_post_id,permalink_url,profile_share_url,error_message,finished_at,created_at${tail}`),
                requestOptions
            );
        } catch (error) {
            const msg = String(error?.message || "");
            if (/(post_mode|quote_text|quote_theme|quote_publish_target|song_id|song_title|song_artist|song_facebook_url)/i.test(msg)) {
                try {
                    return await supabaseRequestWithHeaders(
                        config,
                        tablePath("social_post_runs", `select=${columns},outfit_name,outfit_order_url,facebook_post_id,permalink_url,profile_share_url,error_message,finished_at,created_at${tail}`),
                        requestOptions
                    );
                } catch (outfitError) {
                    if (outfitError?.code === "PGRST204" || outfitError?.code === "42703" || /outfit_(name|order_url)|column .* does not exist/i.test(outfitError?.message || "")) {
                        return await supabaseRequestWithHeaders(
                            config,
                            tablePath("social_post_runs", `select=${columns},facebook_post_id,permalink_url,profile_share_url,error_message,finished_at,created_at${tail}`),
                            requestOptions
                        );
                    }
                    throw outfitError;
                }
            }
            // PGRST204/42703: the outfit snapshot columns are added by the outfit migration.
            if (error?.code === "PGRST204" || error?.code === "42703" || /outfit_(name|order_url)|column .* does not exist/i.test(msg)) {
                return await supabaseRequestWithHeaders(
                    config,
                    tablePath("social_post_runs", `select=${columns},facebook_post_id,permalink_url,profile_share_url,error_message,finished_at,created_at${tail}`),
                    requestOptions
                );
            }
            throw error;
        }
    }

    let response;
    try {
        response = await fetchPageSlice(page);
    } catch (error) {
        if (error?.status === 416 || error?.code === "PGRST103") {
            const rangeTotal = parseContentRangeTotal(error.headers?.get?.("content-range")) ?? 0;
            if (rangeTotal <= 0) {
                return {
                    runs: [],
                    pagination: { page: 1, perPage, total: 0, totalPages: 1 }
                };
            }
            page = Math.max(1, Math.ceil(rangeTotal / perPage));
            response = await fetchPageSlice(page);
        } else {
            throw error;
        }
    }

    let rows = Array.isArray(response?.data) ? response.data : [];
    const headerTotal = parseContentRangeTotal(response?.headers?.get?.("content-range"));

    if (headerTotal !== null) {
        const totalPages = Math.max(1, Math.ceil(headerTotal / perPage));
        if (rows.length === 0 && headerTotal > 0 && page > totalPages) {
            page = totalPages;
            const retry = await fetchPageSlice(page);
            rows = Array.isArray(retry?.data) ? retry.data : [];
        }
        return {
            runs: rows,
            pagination: {
                page: Math.min(page, totalPages),
                perPage,
                total: headerTotal,
                totalPages
            }
        };
    }

    if (rows.length > perPage) {
        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * perPage;
        return {
            runs: rows.slice(start, start + perPage),
            pagination: { page: safePage, perPage, total, totalPages }
        };
    }

    const inferredTotal = rows.length > 0 ? (page - 1) * perPage + rows.length : 0;
    const totalPages = Math.max(1, Math.ceil(inferredTotal / perPage));
    return {
        runs: rows,
        pagination: {
            page: Math.min(page, totalPages),
            perPage,
            total: inferredTotal,
            totalPages
        }
    };
}

async function getDashboard(config, userId, env, profile, runsOptions = {}) {
    const [characters, pages, schedulesResult, runsResult, publisherConfig, userSettingsResult, outfitLibrary, referenceStorageConfigured] = await Promise.all([
        supabaseRequest(config, tablePath("social_characters", `select=id,display_name,reference_filename,reference_mime_type,prompt_notes,created_at&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`)),
        supabaseRequest(config, tablePath("social_page_connections", `select=id,page_id,page_name,can_publish,page_tasks,token_checked_at,updated_at&owner_id=eq.${encodeURIComponent(userId)}&order=page_name.asc`)),
        listSchedulesForDashboard(config, userId),
        listRunsForDashboard(config, userId, runsOptions),
            supabaseRequest(config, tablePath("social_publisher_config", "select=id,global_enabled,image_provider,image_model,text_provider,quote_llm_model,updated_at&id=eq.true&limit=1"))
                .catch(() => supabaseRequest(config, tablePath("social_publisher_config", "select=id,global_enabled,image_provider,image_model,quote_llm_model,updated_at&id=eq.true&limit=1"))
                    .catch(() => supabaseRequest(config, tablePath("social_publisher_config", "select=id,global_enabled,image_provider,image_model,updated_at&id=eq.true&limit=1")))),
        getUserSettingsForDashboard(config, userId),
        listOutfitsForDashboard(config, userId),
        isPrivateReferenceBucket(config)
    ]);

    const schedules = schedulesResult?.rows || [];
    const userSettings = userSettingsResult?.settings ? [userSettingsResult.settings] : [];
    const imageProvider = ["cloudflare", "qwencloud", "tencent", "puter", "opus"].includes(publisherConfig?.[0]?.image_provider)
        ? publisherConfig[0].image_provider
        : "gemini";
    const textProvider = normalizeTextProvider(publisherConfig?.[0]?.text_provider);
    const providerConfigured = imageProvider === "cloudflare"
        ? typeof env?.AI?.run === "function"
        : imageProvider === "qwencloud"
            ? Boolean(envValue(env, "QWENCLOUD_API_KEY"))
            : imageProvider === "tencent"
                ? Boolean(envValue(env, "TENCENT_TOKENHUB_KEY") || envValue(env, "TENCENT_API_KEY"))
                : imageProvider === "puter"
                    ? Boolean(envValue(env, "PUTER_AUTH_TOKEN"))
                    : imageProvider === "opus"
                        ? opusConfigured(env)
                        : Boolean(envValue(env, "GEMINI_API_KEY"));
    return {
        success: true,
        characters: characters || [],
        pages: pages || [],
        schedules,
        /* false = migration kolom scene/autopublish jadwal belum dijalankan. */
        sceneSchemaReady: schedulesResult?.sceneSchemaReady !== false,
        /* false = migration kolom autopublish akun belum dijalankan. */
        autopublishSchemaReady: userSettingsResult?.autopublishSchemaReady !== false,
        runs: runsResult?.runs || [],
        runsPagination: runsResult?.pagination || {
            page: 1,
            perPage: DEFAULT_SOCIAL_RUNS_PER_PAGE,
            total: (runsResult?.runs || []).length,
            totalPages: 1
        },
        outfits: outfitLibrary.outfits,
        schedulePolicy: getScheduleIntervalPolicy(profile?.role) || {
            role: String(profile?.role || "").trim().toUpperCase(),
            minIntervalMinutes: null,
            maxIntervalMinutes: null,
            maxSchedules: null
        },
        postLimit: resolvePostLimit(profile),
        scheduleCount: schedules.length,
        /* Pilihan parameter gambar untuk form jadwal (sumber tunggal di lib). */
        scenePresets: SCENE_PRESETS,
        /* Pilihan tema kata-kata mutiara, latar estetik, & daftar lagu populer FB. */
        quotePresets: QUOTE_PRESETS,
        defaultFacebookSongs: DEFAULT_FACEBOOK_SONGS,
        /* Switch milik user ini saja. Baris yang belum ada dianggap aktif. */
        autopublishEnabled: userSettings?.[0]?.autopublish_enabled !== false,
        /* Master switch untuk seluruh akun; hanya admin/owner yang boleh mengubah. */
        globalEnabled: publisherConfig?.[0]?.global_enabled === true,
        canManageGlobalAutopublish: ["ADMIN", "OWNER"].includes(String(profile?.role || "").trim().toUpperCase()),
        postingSettings: userSettings?.[0] || { caption_template: "Cerita hari ini ✨", external_link: "" },
        config: {
            metaOAuthConfigured: Boolean(envValue(env, "META_APP_ID") && envValue(env, "META_APP_SECRET") && envValue(env, "META_REDIRECT_URI") && envValue(env, "META_LOGIN_CONFIG_ID")),
            imageProvider,
            textProvider,
            captionProvider: textProvider === "auto"
                ? (Boolean(envValue(env, "TENCENT_TOKENHUB_KEY") || envValue(env, "TENCENT_API_KEY"))
                    ? "tencent"
                    : ["cloudflare", "gemini", "qwencloud"].includes(imageProvider)
                        ? imageProvider
                        : (typeof env?.AI?.run === "function" ? "cloudflare" : "tencent"))
                : textProvider,
            imageModel: imageProvider === "qwencloud"
                ? normalizeQwenCloudImageModel(publisherConfig?.[0]?.image_model)
                : imageProvider === "opus"
                    ? normalizeOpusImageModel(publisherConfig?.[0]?.image_model, env)
                    : "",
            quoteLlmModel: normalizeQwenCloudLlmModel(publisherConfig?.[0]?.quote_llm_model),
            qwenCloudConfigured: Boolean(envValue(env, "QWENCLOUD_API_KEY")),
            imageApiConfigured: providerConfigured,
            captionApiConfigured: providerConfigured,
            cloudflareAiConfigured: typeof env?.AI?.run === "function",
            tokenEncryptionConfigured: Boolean(envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")),
            outfitLibraryReady: outfitLibrary.ready,
            referenceStorageConfigured
        }
    };
}

async function getSocialImageSettings(config, env = null) {
    const rows = await supabaseRequest(
        config,
        tablePath("social_publisher_config", "select=image_provider,image_model,text_provider,quote_llm_model&id=eq.true&limit=1")
    ).catch(() => supabaseRequest(
        config,
        tablePath("social_publisher_config", "select=image_provider,image_model,quote_llm_model&id=eq.true&limit=1")
    ).catch(() => supabaseRequest(
        config,
        tablePath("social_publisher_config", "select=image_provider,image_model&id=eq.true&limit=1")
    )));
    const value = rows?.[0]?.image_provider;
    const provider = ["gemini", "cloudflare", "qwencloud", "tencent", "puter", "opus"].includes(value) ? value : "gemini";
    const rawImageModel = String(rows?.[0]?.image_model || "").trim();
    return {
        provider,
        rawImageModel,
        imageModel: provider === "opus"
            ? normalizeOpusImageModel(rawImageModel, env)
            : normalizeQwenCloudImageModel(rawImageModel),
        opusModel: normalizeOpusImageModel(rawImageModel, env),
        /* Kolom text_provider boleh belum ada (migrasi belum jalan) -> "auto". */
        textProvider: normalizeTextProvider(rows?.[0]?.text_provider),
        quoteLlmModel: normalizeQwenCloudLlmModel(rows?.[0]?.quote_llm_model)
    };
}

async function getSocialImageProvider(config) {
    return (await getSocialImageSettings(config)).provider;
}

async function saveSocialImageProvider(config, adminId, body, env) {
    const imageProvider = String(body?.image_provider || "").trim();
    if (!["gemini", "cloudflare", "qwencloud", "tencent", "puter", "opus"].includes(imageProvider)) {
        const error = new Error("Pilih Gemini, Cloudflare, QwenCloud, Tencent Cloud, Puter, atau Opus sebagai penyedia gambar.");
        error.status = 400;
        throw error;
    }
    const imageModel = imageProvider === "qwencloud"
        ? normalizeQwenCloudImageModel(body?.image_model)
        : imageProvider === "opus"
            ? normalizeOpusImageModel(body?.image_model, env)
            : "";
    /*
     * Provider teks terpisah dari provider gambar: gambar boleh tetap Cloudflare
     * (gratis) sementara tulisan memakai model bahasa TokenHub (kuota trial).
     */
    const requestedTextProvider = typeof body?.text_provider === "string" && body.text_provider.trim() !== ""
        ? normalizeTextProvider(body.text_provider)
        : "auto";
    const hasQuoteLlmModel = typeof body?.quote_llm_model === "string" && body.quote_llm_model.trim() !== "";
    const quoteLlmModel = hasQuoteLlmModel
        ? normalizeQwenCloudLlmModel(body.quote_llm_model)
        : undefined;
    if (imageProvider === "gemini" && !envValue(env, "GEMINI_API_KEY")) {
        const error = new Error("GEMINI_API_KEY diperlukan untuk gambar dan caption saat provider Gemini dipilih.");
        error.status = 409;
        throw error;
    }
    if (imageProvider === "cloudflare" && typeof env?.AI?.run !== "function") {
        const error = new Error("Binding Cloudflare Workers AI belum tersedia. Tambahkan binding AI dan deploy Worker terlebih dahulu.");
        error.status = 409;
        throw error;
    }
    if (imageProvider === "qwencloud" && !envValue(env, "QWENCLOUD_API_KEY")) {
        const error = new Error("QWENCLOUD_API_KEY diperlukan untuk gambar dan caption saat provider QwenCloud dipilih.");
        error.status = 409;
        throw error;
    }
    if (imageProvider === "tencent" && !envValue(env, "TENCENT_TOKENHUB_KEY") && !envValue(env, "TENCENT_API_KEY")) {
        const error = new Error("TENCENT_TOKENHUB_KEY diperlukan saat provider Tencent Cloud dipilih. Buat API key di console TokenHub lalu simpan sebagai secret Worker.");
        error.status = 409;
        throw error;
    }
    if (imageProvider === "puter" && !envValue(env, "PUTER_AUTH_TOKEN")) {
        const error = new Error("PUTER_AUTH_TOKEN diperlukan saat provider Puter dipilih. Buka puter.com/dashboard#account, klik \"Create token\", lalu simpan token sebagai secret Worker. Setiap gambar akan memotong kuota/biaya akun Puter Anda sendiri (User-Pays), bukan kredit GEN-Z.AI.");
        error.status = 409;
        throw error;
    }
    if (imageProvider === "opus" && !opusConfigured(env)) {
        const error = new Error("OPUS_AUTH_TOKEN diperlukan saat provider Opus dipilih. Hubungkan akun OpusClip/Opus Labs (product-ad-studio.labs.opus.pro / labs.opus.pro/opus-video-tools/mcp) lalu simpan Bearer token OAuth sebagai secret Worker OPUS_AUTH_TOKEN (atau pasangan OPUS_REFRESH_TOKEN + OPUS_CLIENT_ID). Setiap gambar memotong kredit akun OpusClip Anda sendiri, bukan kredit GEN-Z.AI.");
        error.status = 409;
        throw error;
    }
    const basePayload = {
        id: true,
        image_provider: imageProvider,
        image_model: imageModel,
        text_provider: requestedTextProvider,
        updated_by: adminId,
        updated_at: new Date().toISOString()
    };
    const rows = await supabaseRequest(
        config,
        tablePath("social_publisher_config", hasQuoteLlmModel
            ? "on_conflict=id&select=id,image_provider,image_model,text_provider,quote_llm_model,updated_at"
            : "on_conflict=id&select=id,image_provider,image_model,text_provider,updated_at"),
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify(hasQuoteLlmModel ? { ...basePayload, quote_llm_model: quoteLlmModel } : basePayload)
        }
    ).catch(async err => {
        if (/social_publisher_config_image_provider_check/i.test(String(err?.message || ""))) {
            /*
             * Check constraint di database masih memuat daftar provider lama
             * (bisa sampai menolak 'tencent'/'puter') — migrasi belum pernah
             * dijalankan. Terjemahkan menjadi tindakan yang jelas untuk SEMUA
             * pilihan provider, tanpa menyembunyikan penyebab aslinya.
             */
            const error = new Error(
                "Database masih membatasi daftar provider gambar (check constraint image_provider belum diperbarui) — "
                + "pilihan Gemini/Cloudflare/QwenCloud/Tencent/Puter/Opus ditolak sampai migrasi dijalankan. "
                + "Jalankan file migrasi supabase/social-image-provider-constraint.sql di Supabase SQL Editor (aman diulang), lalu simpan lagi. "
                + `Penyebab asli: ${String(err?.message || "").slice(0, 200)}`
            );
            error.status = 409;
            throw error;
        }
        if (/social_publisher_config_text_provider_check/i.test(String(err?.message || ""))) {
            const error = new Error(
                "Database masih membatasi daftar provider teks (check constraint text_provider belum diperbarui). "
                + "Jalankan file migrasi supabase/social-image-provider-constraint.sql di Supabase SQL Editor (aman diulang), lalu simpan lagi. "
                + `Penyebab asli: ${String(err?.message || "").slice(0, 200)}`
            );
            error.status = 409;
            throw error;
        }
        if (/text_provider/i.test(String(err?.message || ""))) {
            /*
             * Migrasi kolom text_provider belum dijalankan. Simpan sisanya agar
             * pilihan provider gambar tidak ikut gagal, lalu laporkan jujur.
             */
            const { text_provider: _ignored, ...withoutTextProvider } = basePayload;
            const fallbackRows = await supabaseRequest(
                config,
                tablePath("social_publisher_config", "on_conflict=id&select=id,image_provider,image_model,updated_at"),
                {
                    method: "POST",
                    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                    body: JSON.stringify(withoutTextProvider)
                }
            );
            return fallbackRows.map(row => ({ ...row, text_provider: "auto", text_provider_saved: false }));
        }
        if (hasQuoteLlmModel && /quote_llm_model|column|schema cache/i.test(String(err?.message || ""))) {
            return await supabaseRequest(
                config,
                tablePath("social_publisher_config", "on_conflict=id&select=id,image_provider,image_model,updated_at"),
                {
                    method: "POST",
                    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                    body: JSON.stringify(basePayload)
                }
            );
        }
        throw err;
    });
    if (!rows?.length) {
        const error = new Error("Pilihan penyedia gambar tidak berhasil disimpan.");
        error.status = 500;
        throw error;
    }
    return {
        image_provider: rows[0].image_provider,
        image_model: rows[0].image_model,
        text_provider: normalizeTextProvider(rows[0].text_provider || requestedTextProvider),
        text_provider_saved: rows[0].text_provider_saved !== false,
        quote_llm_model: normalizeQwenCloudLlmModel(rows[0].quote_llm_model || quoteLlmModel),
        gemini_configured: Boolean(envValue(env, "GEMINI_API_KEY")),
        tencent_configured: Boolean(envValue(env, "TENCENT_TOKENHUB_KEY") || envValue(env, "TENCENT_API_KEY")),
        cloudflare_configured: typeof env?.AI?.run === "function",
        qwencloud_configured: Boolean(envValue(env, "QWENCLOUD_API_KEY")),
        puter_configured: Boolean(envValue(env, "PUTER_AUTH_TOKEN")),
        opus_configured: opusConfigured(env),
        opus_model: imageProvider === "opus"
            ? normalizeOpusImageModel(rows[0].image_model, env)
            : opusImageModel(env),
        opus_models: OPUS_IMAGE_MODELS,
        opus_max_reference_images: OPUS_MAX_REFERENCE_IMAGES,
        opus_aspect_ratio: OPUS_DEFAULT_ASPECT_RATIO,
        opus_quality: OPUS_DEFAULT_IMAGE_QUALITY
    };
}

function modelQuotaSummaryRows(catalog, quotasByModel) {
    return catalog.map(model => {
        const row = quotasByModel.get(model.id) || null;
        const quotaLimit = row ? Number(row.quota_limit) || 0 : Number(model.defaultQuota) || 0;
        const view = { ...(row || {}), quota_limit: quotaLimit, exhausted: row?.exhausted === true };
        return {
            model: model.id,
            label: model.label,
            note: model.note,
            requests_used: Number(row?.requests_used) || 0,
            quota_limit: quotaLimit,
            exhausted: row?.exhausted === true,
            last_status: String(row?.last_status || ""),
            window_started_at: row?.window_started_at || null,
            updated_at: row?.updated_at || null,
            percent_available: quotaLimit > 0 || row ? quotaPercentAvailable(view) : null,
            quota_source: row ? "saved" : quotaLimit > 0 ? "free-quota" : "unset"
        };
    });
}

function quotaSummaryRows(quotasByModel) {
    return modelQuotaSummaryRows(QWENCLOUD_IMAGE_MODELS, quotasByModel);
}

function llmQuotaSummaryRows(quotasByModel) {
    return modelQuotaSummaryRows(QWENCLOUD_LLM_MODELS, quotasByModel);
}

async function saveModelQuotaSettings(config, body = {}) {
    const model = normalizeQwenCloudQuotaModel(body.model);
    if (body.reset === true) {
        await resetModelQuota(config, model);
    }
    if (body.quota_limit !== undefined && body.quota_limit !== null && body.quota_limit !== "") {
        await setModelQuotaLimit(config, model, body.quota_limit);
    }
    const quotasByModel = await getModelQuotas(config);
    return {
        model,
        quotas: quotaSummaryRows(quotasByModel),
        llm_quotas: llmQuotaSummaryRows(quotasByModel)
    };
}

async function startOAuth(config, userId, env, res) {
    const appId = envValue(env, "META_APP_ID");
    const redirectUri = envValue(env, "META_REDIRECT_URI");
    const loginConfigId = envValue(env, "META_LOGIN_CONFIG_ID");
    if (!appId || !redirectUri || !loginConfigId || !envValue(env, "META_APP_SECRET") || !envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")) {
        const error = new Error("Konfigurasi OAuth Meta belum lengkap. Minta admin menyiapkan App ID, App Secret, redirect URI, ID konfigurasi Facebook Login for Business, dan kunci enkripsi di Cloudflare.");
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
    res.setHeader(
        "Set-Cookie",
        `${OAUTH_STATE_COOKIE}=${randomState}; Path=${OAUTH_STATE_COOKIE_PATH}; Max-Age=600; Secure; HttpOnly; SameSite=Lax`
    );

    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", randomState);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("config_id", envValue(env, "META_LOGIN_CONFIG_ID"));
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

function isMissingOutfitSchema(error) {
    const message = String(error?.message || "");
    return error?.code === "PGRST205" ||
        error?.code === "42P01" ||
        (/social_outfits/i.test(message) && /does not exist|schema cache|relation/i.test(message));
}

const SCHEDULE_SCENE_COLUMNS = [
    "autopublish_enabled",
    "scene_location",
    "camera_angle",
    "scene_situation",
    "scene_lighting",
    "scene_atmosphere",
    "scene_condition",
    "scene_details",
    "negative_prompt"
];

/**
 * True bila database belum menjalankan supabase/social-schedule-autopublish-scene.sql.
 * Dipakai untuk fallback yang ramah, bukan untuk menyembunyikan error lain.
 */
function isMissingScheduleSceneSchema(error) {
    const message = String(error?.message || "");
    const mentionsColumn = SCHEDULE_SCENE_COLUMNS.some(column => message.includes(column));
    return (error?.code === "PGRST204" || error?.code === "42703" || /does not exist|schema cache|column/i.test(message))
        && mentionsColumn;
}

const SCHEDULE_QUOTE_COLUMNS = [
    "post_mode",
    "quote_theme",
    "quote_visual_style",
    "use_random_song",
    "quote_publish_target"
];

function isMissingQuoteTargetColumn(error) {
    const message = String(error?.message || "");
    return (error?.code === "PGRST204" || error?.code === "42703" || /does not exist|schema cache|column/i.test(message))
        && message.includes("quote_publish_target");
}

function isMissingScheduleQuoteSchema(error) {
    const message = String(error?.message || "");
    const mentionsColumn = SCHEDULE_QUOTE_COLUMNS.some(column => message.includes(column));
    return (error?.code === "PGRST204" || error?.code === "42703" || /does not exist|schema cache|column/i.test(message))
        && mentionsColumn;
}

/**
 * Daftar jadwal untuk dashboard. Bila database belum punya kolom baru,
 * query diulang dengan kolom lama agar halaman tetap terbuka dan hanya
 * menampilkan peringatan migration.
 */
async function listSchedulesForDashboard(config, userId) {
    const query = `owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
    try {
        return {
            rows: await supabaseRequest(config, tablePath("social_post_schedules", `select=${SCHEDULE_FULL_COLUMNS},created_at,updated_at&${query}`)) || [],
            sceneSchemaReady: true
        };
    } catch (error) {
        if (isMissingQuoteTargetColumn(error)) {
            try {
                return {
                    rows: await supabaseRequest(config, tablePath("social_post_schedules", `select=${SCHEDULE_QUOTE_BASE_COLUMNS},created_at,updated_at&${query}`)) || [],
                    sceneSchemaReady: true
                };
            } catch {
                // Fall through to scene/legacy columns.
            }
        }
        if (isMissingScheduleQuoteSchema(error)) {
            console.warn("[Social Publisher] Kolom quote/musik jadwal belum ada; memakai kolom scene.");
            try {
                return {
                    rows: await supabaseRequest(config, tablePath("social_post_schedules", `select=${SCHEDULE_COLUMNS},created_at,updated_at&${query}`)) || [],
                    sceneSchemaReady: true
                };
            } catch (sceneError) {
                console.warn("[Social Publisher] Select jadwal dengan kolom scene gagal:", sceneError?.message || "unknown error");
            }
        } else {
            console.warn("[Social Publisher] Select jadwal dengan kolom baru gagal:", error?.message || "unknown error");
        }
        const rows = await supabaseRequest(
            config,
            tablePath("social_post_schedules", `select=id,character_id,page_connection_id,enabled,interval_hours,next_run_at,timezone,aspect_ratio,caption_template,created_at,updated_at&${query}`)
        ).catch(() => {
            throw error;
        });
        return { rows: rows || [], sceneSchemaReady: false };
    }
}

/**
 * Pengaturan akun untuk dashboard. `autopublish_enabled` baru ada setelah
 * supabase/social-autopublish-per-user.sql dijalankan; bila belum, dashboard
 * memakai kolom lama dan menganggap autopublish akun AKTIF.
 */
async function getUserSettingsForDashboard(config, userId) {
    const query = `owner_id=eq.${encodeURIComponent(userId)}&limit=1`;
    try {
        return {
            settings: (await supabaseRequest(config, tablePath("social_publisher_user_settings", `select=caption_template,external_link,autopublish_enabled,updated_at&${query}`)))?.[0] || null,
            autopublishSchemaReady: true
        };
    } catch (error) {
        console.warn("[Social Publisher] Select pengaturan akun dengan autopublish_enabled gagal:", error?.message || "unknown error");
        const rows = await supabaseRequest(
            config,
            tablePath("social_publisher_user_settings", `select=caption_template,external_link,updated_at&${query}`)
        ).catch(() => {
            throw error;
        });
        return { settings: rows?.[0] || null, autopublishSchemaReady: false };
    }
}

function rethrowMissingScheduleSceneSchema(error) {
    if (isMissingScheduleQuoteSchema(error)) {
        const wrapped = new Error("Kolom mode Kata-kata Mutiara dan Lagu Facebook belum tersedia di database. Jalankan supabase/social-quote-music.sql di Supabase SQL Editor, lalu simpan lagi.");
        wrapped.status = 503;
        throw wrapped;
    }
    if (!isMissingScheduleSceneSchema(error)) throw error;
    const wrapped = new Error("Kolom parameter gambar dan autopublish jadwal belum tersedia. Jalankan supabase/social-schedule-autopublish-scene.sql di Supabase SQL Editor, lalu simpan lagi.");
    wrapped.status = 503;
    throw wrapped;
}

function isMissingSongSchema(error) {
    const message = String(error?.message || "");
    return error?.code === "PGRST205" ||
        error?.code === "42P01" ||
        (/social_facebook_songs/i.test(message) && /does not exist|schema cache|relation/i.test(message));
}

function isMissingQuoteRunColumns(error) {
    const message = String(error?.message || "");
    return (error?.code === "PGRST204" || error?.code === "42703" || /does not exist|schema cache|column/i.test(message))
        && /(post_mode|quote_text|quote_theme|quote_publish_target|song_id|song_title|song_artist|song_facebook_url)/i.test(message);
}

function isMissingSongAudioColumns(error) {
    const message = String(error?.message || "");
    return (error?.code === "PGRST204" || error?.code === "42703" || /does not exist|schema cache|column/i.test(message))
        && /(audio_object_key|audio_mime_type|duration_seconds)/i.test(message);
}

async function listFacebookSongs(config, userId, { activeOnly = false } = {}) {
    const baseFilters = [
        `owner_id=eq.${encodeURIComponent(userId)}`,
        activeOnly ? "is_active=eq.true" : "",
        "order=created_at.desc"
    ].filter(Boolean).join("&");
    try {
        const rows = await supabaseRequest(
            config,
            tablePath("social_facebook_songs", `select=id,title,artist,facebook_url,mood,audio_object_key,audio_mime_type,duration_seconds,is_active,created_at,updated_at&${baseFilters}`)
        );
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        if (!isMissingSongAudioColumns(error)) throw error;
        const rows = await supabaseRequest(
            config,
            tablePath("social_facebook_songs", `select=id,title,artist,facebook_url,mood,is_active,created_at,updated_at&${baseFilters}`)
        );
        return Array.isArray(rows) ? rows : [];
    }
}

async function listFacebookSongsForUser(config, userId) {
    try {
        return { songs: await listFacebookSongs(config, userId), ready: true };
    } catch (error) {
        if (isMissingSongSchema(error)) return { songs: [], ready: false };
        throw error;
    }
}

function normalizeUploadedAudioMeta(filename, headerMimeType, codec) {
    const lowerName = String(filename || "").toLowerCase();
    const rawMime = String(headerMimeType || "").split(";")[0].trim().toLowerCase();
    if (codec === "mp3" || rawMime === "audio/mpeg" || rawMime === "audio/mp3" || lowerName.endsWith(".mp3")) {
        return { mimeType: "audio/mpeg", ext: "mp3" };
    }
    if (rawMime === "video/mp4" || lowerName.endsWith(".mp4")) {
        return { mimeType: "video/mp4", ext: "mp4" };
    }
    if (rawMime === "audio/aac" || rawMime === "audio/vnd.dlna.adts" || lowerName.endsWith(".aac")) {
        return { mimeType: "audio/aac", ext: "aac" };
    }
    return { mimeType: "audio/mp4", ext: "m4a" };
}

function titleFromAudioFilename(filename) {
    const base = String(filename || "")
        .replace(/^.*[\\/]/, "")
        .replace(/\.[a-z0-9]{2,5}$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
    return cleanText(base, 140) || "Musik Cerita Pilihan";
}

async function uploadFacebookSongAudio(req, res, config, userId) {
    const bytes = bytesFromBody(req.body);
    if (!bytes.length || bytes.length > MAX_SONG_AUDIO_BYTES) {
        const error = new Error("File lagu/audio kosong atau melebihi batas 16 MB.");
        error.status = 400;
        throw error;
    }

    const rawFilename = cleanText(decodeHeader(getHeader(req, "x-file-name")), 180) || "lagu.m4a";
    const title = cleanText(decodeHeader(getHeader(req, "x-song-title")), 140) || titleFromAudioFilename(rawFilename);
    const artist = cleanText(decodeHeader(getHeader(req, "x-song-artist")), 120);
    const mood = cleanText(decodeHeader(getHeader(req, "x-song-mood")), 60);

    let extracted = null;
    try {
        extracted = extractAudioForStoryMp4(bytes, { maxDurationSec: STORY_MAX_DURATION_FEED_REELS_SEC });
    } catch {
        extracted = null;
    }
    if (!extracted || !extracted.frames?.length) {
        const error = new Error("Format audio tidak didukung atau video tidak memiliki suara. Unggah file .mp3, .m4a, .aac, atau video .mp4 ber-audio (mis. unduhan Reels/Story FB).");
        error.status = 400;
        throw error;
    }

    const existing = await listFacebookSongs(config, userId);
    if (existing.length >= MAX_FACEBOOK_SONGS_PER_USER) {
        const error = new Error(`Koleksi lagu penuh (maksimal ${MAX_FACEBOOK_SONGS_PER_USER} lagu per akun). Hapus lagu lama terlebih dahulu.`);
        error.status = 409;
        throw error;
    }

    const { mimeType, ext } = normalizeUploadedAudioMeta(rawFilename, getHeader(req, "content-type"), extracted.codec);
    const id = crypto.randomUUID();
    const objectKey = `story-audio/${userId}/${id}.${ext}`;
    const durationSeconds = Math.max(3, Math.min(STORY_MAX_DURATION_FEED_REELS_SEC, Math.round(extracted.durationSec || 15)));

    await uploadStoryAudioObject(config, objectKey, bytes, mimeType);
    try {
        const created = await supabaseRequest(
            config,
            tablePath("social_facebook_songs", "select=id,title,artist,facebook_url,mood,audio_object_key,audio_mime_type,duration_seconds,is_active,created_at,updated_at"),
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    id,
                    owner_id: userId,
                    title,
                    artist,
                    mood,
                    facebook_url: "",
                    audio_object_key: objectKey,
                    audio_mime_type: mimeType,
                    duration_seconds: durationSeconds,
                    is_active: true
                })
            }
        );
        return json(res, 201, { success: true, song: created?.[0] || null });
    } catch (error) {
        await deleteStoryAudioObject(config, objectKey).catch(() => {});
        if (isMissingSongAudioColumns(error) || isMissingSongSchema(error)) {
            const wrapped = new Error("Kolom audio lagu Cerita belum tersedia di database. Jalankan supabase/social-quote-music.sql di Supabase SQL Editor.");
            wrapped.status = 503;
            throw wrapped;
        }
        throw error;
    }
}

async function saveFacebookSong(config, userId, body = {}) {
    const id = cleanText(body.id, 80);
    const title = cleanText(body.title, 140);
    const artist = cleanText(body.artist, 120);
    const mood = cleanText(body.mood, 60);
    const rawUrl = cleanText(body.facebook_url, 500);
    const builtinChoice = cleanText(body.builtin_slug, 60);
    const isActive = typeof body.is_active === "boolean" ? body.is_active : true;

    if (!title) {
        const error = new Error("Judul lagu wajib diisi.");
        error.status = 400;
        throw error;
    }

    let safeUrl = "";
    if (rawUrl) {
        safeUrl = sanitizeFacebookSongUrl(rawUrl);
        if (!safeUrl) {
            const error = new Error("Link lagu harus menggunakan URL HTTPS resmi Facebook (facebook.com atau fb.watch), atau kosongkan.");
            error.status = 400;
            throw error;
        }
    }

    const builtinSong = builtinChoice ? findBuiltinStorySong(builtinChoice) : null;
    const now = new Date().toISOString();
    const payload = {
        title,
        artist,
        facebook_url: safeUrl,
        mood,
        ...(builtinSong ? {
            audio_object_key: builtinSong.audio_object_key,
            audio_mime_type: builtinSong.audio_mime_type,
            duration_seconds: builtinSong.duration_seconds
        } : {}),
        is_active: isActive,
        updated_at: now
    };

    try {
        if (id) {
            const updated = await supabaseRequest(
                config,
                tablePath("social_facebook_songs", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id,title,artist,facebook_url,mood,audio_object_key,audio_mime_type,duration_seconds,is_active,created_at,updated_at`),
                {
                    method: "PATCH",
                    headers: { Prefer: "return=representation" },
                    body: JSON.stringify(payload)
                }
            );
            if (!updated?.length) {
                const error = new Error("Lagu tidak ditemukan.");
                error.status = 404;
                throw error;
            }
            return updated[0];
        }

        const existing = await listFacebookSongs(config, userId);
        if (existing.length >= MAX_FACEBOOK_SONGS_PER_USER) {
            const error = new Error(`Koleksi lagu penuh (maksimal ${MAX_FACEBOOK_SONGS_PER_USER} lagu per akun). Hapus lagu lama terlebih dahulu.`);
            error.status = 409;
            throw error;
        }

        const fallbackBuiltin = builtinSong || BUILTIN_STORY_SONGS[existing.length % BUILTIN_STORY_SONGS.length];
        const created = await supabaseRequest(
            config,
            tablePath("social_facebook_songs", "select=id,title,artist,facebook_url,mood,audio_object_key,audio_mime_type,duration_seconds,is_active,created_at,updated_at"),
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    owner_id: userId,
                    audio_object_key: fallbackBuiltin.audio_object_key,
                    audio_mime_type: fallbackBuiltin.audio_mime_type,
                    duration_seconds: fallbackBuiltin.duration_seconds,
                    ...payload
                })
            }
        );
        return created?.[0] || null;
    } catch (error) {
        if (isMissingSongSchema(error)) {
            const wrapped = new Error("Tabel koleksi lagu Facebook belum tersedia. Jalankan supabase/social-quote-music.sql di Supabase SQL Editor.");
            wrapped.status = 503;
            throw wrapped;
        }
        throw error;
    }
}

async function deleteFacebookSong(config, userId, body = {}) {
    const id = cleanText(body.id, 80);
    if (!id) {
        const error = new Error("ID lagu wajib diisi.");
        error.status = 400;
        throw error;
    }
    try {
        let existingKey = "";
        try {
            const rows = await supabaseRequest(
                config,
                tablePath("social_facebook_songs", `select=audio_object_key&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
            );
            existingKey = String(rows?.[0]?.audio_object_key || "").trim();
        } catch {
            existingKey = "";
        }
        await supabaseRequest(
            config,
            tablePath("social_facebook_songs", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`),
            { method: "DELETE" }
        );
        if (existingKey && !existingKey.startsWith("builtin:")) {
            await deleteStoryAudioObject(config, existingKey).catch(() => {});
        }
        return { id };
    } catch (error) {
        if (isMissingSongSchema(error)) {
            const wrapped = new Error("Tabel koleksi lagu Facebook belum tersedia. Jalankan supabase/social-quote-music.sql di Supabase SQL Editor.");
            wrapped.status = 503;
            throw wrapped;
        }
        throw error;
    }
}

async function seedDefaultFacebookSongs(config, userId) {
    try {
        const existing = await listFacebookSongs(config, userId);
        const existingKeys = new Set(
            existing.flatMap(song => [
                `${String(song.title || "").trim().toLowerCase()}::${String(song.artist || "").trim().toLowerCase()}`,
                String(song.audio_object_key || "").trim().toLowerCase()
            ]).filter(Boolean)
        );
        const availableSlots = Math.max(0, MAX_FACEBOOK_SONGS_PER_USER - existing.length);
        const toInsert = BUILTIN_STORY_SONGS
            .filter(song =>
                !existingKeys.has(`${song.title.toLowerCase()}::${song.artist.toLowerCase()}`) &&
                !existingKeys.has(String(song.audio_object_key || "").toLowerCase())
            )
            .slice(0, availableSlots)
            .map(song => ({
                owner_id: userId,
                title: song.title,
                artist: song.artist,
                mood: song.mood || "",
                facebook_url: "",
                audio_object_key: song.audio_object_key,
                audio_mime_type: song.audio_mime_type,
                duration_seconds: song.duration_seconds,
                is_active: true
            }));

        if (toInsert.length > 0) {
            await supabaseRequest(
                config,
                tablePath("social_facebook_songs"),
                {
                    method: "POST",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify(toInsert)
                }
            );
        }
        const songs = await listFacebookSongs(config, userId);
        return { added: toInsert.length, songs };
    } catch (error) {
        if (isMissingSongSchema(error)) {
            const wrapped = new Error("Tabel koleksi lagu Facebook belum tersedia. Jalankan supabase/social-quote-music.sql di Supabase SQL Editor.");
            wrapped.status = 503;
            throw wrapped;
        }
        throw error;
    }
}

async function pickSongForPost(config, userId, { requirePlayableAudio = false } = {}) {
    let songs = [];
    try {
        songs = await listFacebookSongs(config, userId, { activeOnly: true });
    } catch (error) {
        if (!isMissingSongSchema(error)) throw error;
        songs = [];
    }

    let recentSongs = [];
    try {
        const recentRuns = await supabaseRequest(
            config,
            tablePath("social_post_runs", `select=song_id,song_title,song_artist,scene_plan&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=8`)
        );
        recentSongs = (recentRuns || [])
            .map(run => ({
                id: run.song_id || run.scene_plan?.song_id || null,
                title: run.song_title || run.scene_plan?.song_title || "",
                artist: run.song_artist || run.scene_plan?.song_artist || ""
            }))
            .filter(item => item.id || item.title);
    } catch {
        // Riwayat lagu hanya untuk variasi; jangan memblokir posting bila kolom belum ada.
    }

    return pickRandomFacebookSong(songs, recentSongs, Math.random, {
        fallbackToDefaults: true,
        requirePlayableAudio
    });
}

function quoteAndSongRunValues({ postMode = "character", quoteText = "", quoteTheme = "", quotePublishTarget = "", song = null } = {}) {
    return {
        post_mode: postMode,
        quote_text: String(quoteText || "").slice(0, 500),
        quote_theme: String(quoteTheme || "").slice(0, 120),
        ...(quotePublishTarget ? { quote_publish_target: normalizeQuotePublishTarget(quotePublishTarget, "feed") } : {}),
        song_id: song?.id || null,
        song_title: String(song?.title || "").slice(0, 140),
        song_artist: String(song?.artist || "").slice(0, 120),
        song_facebook_url: sanitizeFacebookSongUrl(song?.facebook_url)
    };
}

function normalizeOutfitOrderUrl(value) {
    const text = cleanText(value, 500);
    if (!text) return "";
    const safe = sanitizeHttpsUrl(text);
    if (!safe) {
        const error = new Error("Link order outfit harus berupa URL HTTPS yang valid atau dikosongkan.");
        error.status = 400;
        throw error;
    }
    return safe.slice(0, 500);
}

async function listOutfits(config, userId, { characterId = "", activeOnly = false, includeStorage = false } = {}) {
    const columns = includeStorage
        ? "id,character_id,name,object_key,mime_type,order_url,notes,is_active,created_at"
        : "id,character_id,name,filename,mime_type,order_url,notes,is_active,created_at";
    const rows = await supabaseRequest(
        config,
        tablePath("social_outfits", [
            `select=${columns}`,
            `owner_id=eq.${encodeURIComponent(userId)}`,
            characterId ? `character_id=eq.${encodeURIComponent(characterId)}` : "",
            activeOnly ? "is_active=eq.true" : "",
            "order=created_at.desc"
        ].filter(Boolean).join("&"))
    );
    return Array.isArray(rows) ? rows : [];
}

/**
 * Outfits are optional: a character without outfits keeps the clothing from its
 * reference photo, and a database that has not run the outfit migration yet
 * still loads the dashboard.
 */
async function listOutfitsForDashboard(config, userId) {
    try {
        return { outfits: await listOutfits(config, userId), ready: true };
    } catch (error) {
        if (isMissingOutfitSchema(error)) return { outfits: [], ready: false };
        throw error;
    }
}

/**
 * Random outfit selection for one post. Recently used outfits are skipped while
 * another active outfit is available, so the wardrobe keeps rotating.
 */
async function pickOutfitForPost(config, userId, characterId) {
    let outfits;
    try {
        outfits = await listOutfits(config, userId, { characterId, activeOnly: true, includeStorage: true });
    } catch (error) {
        if (isMissingOutfitSchema(error)) return { outfit: null, ready: false };
        throw error;
    }
    if (!outfits.length) return { outfit: null, ready: true };

    let recentOutfitIds = [];
    try {
        const recentRuns = await supabaseRequest(
            config,
            tablePath("social_post_runs", `select=outfit_id&owner_id=eq.${encodeURIComponent(userId)}&outfit_id=not.is.null&order=created_at.desc&limit=6`)
        );
        recentOutfitIds = (recentRuns || []).map(run => run.outfit_id).filter(Boolean);
    } catch (error) {
        // History is a nice-to-have for variety; never block a post because of it.
        console.error("Could not read recent outfit history:", error?.message || "unknown error");
    }

    return { outfit: pickRandomOutfit(outfits, recentOutfitIds), ready: true };
}

function outfitCaptionSource(outfit) {
    if (!outfit) return null;
    return { id: outfit.id, name: outfit.name, order_url: outfit.order_url || "" };
}

function outfitRunValues(outfit) {
    return {
        outfit_id: outfit?.id || null,
        outfit_name: outfit?.name || null,
        outfit_order_url: outfit?.order_url || null
    };
}

async function uploadOutfit(req, res, config, userId) {
    const characterId = cleanText(getQuery(req, "character_id"), 80);
    if (!characterId) {
        const error = new Error("ID karakter wajib diisi.");
        error.status = 400;
        throw error;
    }
    if (String(getHeader(req, "x-outfit-rights") || "") !== "1") {
        const error = new Error("Konfirmasi hak penggunaan foto outfit diperlukan.");
        error.status = 400;
        throw error;
    }
    if (!await isPrivateReferenceBucket(config)) {
        const error = new Error("Bucket privat Supabase Storage untuk foto outfit belum tersedia.");
        error.status = 503;
        throw error;
    }

    const name = cleanText(decodeHeader(getHeader(req, "x-outfit-name")), 80);
    if (!name) {
        const error = new Error("Nama outfit wajib diisi.");
        error.status = 400;
        throw error;
    }
    const orderUrl = normalizeOutfitOrderUrl(decodeHeader(getHeader(req, "x-outfit-order-url")));
    const notes = cleanText(decodeHeader(getHeader(req, "x-outfit-notes")), 400);

    const characters = await supabaseRequest(
        config,
        tablePath("social_characters", `select=id&id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    if (!characters?.length) {
        const error = new Error("Karakter tidak ditemukan untuk akun ini.");
        error.status = 404;
        throw error;
    }

    let existingOutfits = [];
    try {
        existingOutfits = await listOutfits(config, userId, { characterId });
    } catch (error) {
        if (isMissingOutfitSchema(error)) {
            const wrapped = new Error("Tabel outfit belum tersedia. Jalankan ulang supabase/social-auto-publisher.sql di Supabase SQL Editor.");
            wrapped.status = 503;
            throw wrapped;
        }
        throw error;
    }
    if (existingOutfits.length >= MAX_OUTFITS_PER_CHARACTER) {
        const error = new Error(`Maksimal ${MAX_OUTFITS_PER_CHARACTER} outfit per karakter. Hapus outfit lama sebelum menambah yang baru.`);
        error.status = 409;
        throw error;
    }

    const mime = normalizeMimeType(getHeader(req, "content-type"));
    const bytes = bytesFromBody(req.body);
    const filename = cleanText(decodeHeader(getHeader(req, "x-file-name")), 180)
        || `outfit.${extensionForMime(mime)}`;
    if (!mime || !bytes.length || bytes.length > MAX_REFERENCE_BYTES || !hasValidImageSignature(bytes, mime)) {
        const error = new Error("File outfit harus berupa JPEG, PNG, atau WebP yang valid dan berukuran maksimal 8 MB.");
        error.status = 400;
        throw error;
    }

    const key = `social-outfit/${userId}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
    await uploadReferenceObject(config, key, bytes, mime);
    try {
        const saved = await supabaseRequest(
            config,
            tablePath("social_outfits", "select=id,character_id,name,filename,mime_type,order_url,notes,is_active,created_at"),
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    owner_id: userId,
                    character_id: characterId,
                    name,
                    object_key: key,
                    filename: filename.replace(/[\\/\0]/g, "").slice(0, 180),
                    mime_type: mime,
                    size_bytes: bytes.length,
                    order_url: orderUrl,
                    notes,
                    is_active: true
                })
            }
        );
        if (!saved?.length) {
            const error = new Error("Outfit tidak berhasil disimpan.");
            error.status = 500;
            throw error;
        }
        return json(res, 201, { success: true, outfit: saved[0] });
    } catch (error) {
        await deleteReferenceObject(config, key).catch(() => {});
        throw error;
    }
}

async function replaceOutfitPhoto(req, res, config, userId) {
    if (!await isPrivateReferenceBucket(config)) {
        const error = new Error("Bucket privat Supabase Storage untuk foto referensi belum tersedia.");
        error.status = 503;
        throw error;
    }

    const outfitId = cleanText(decodeHeader(getHeader(req, "x-outfit-id")), 80);
    if (!outfitId) {
        const error = new Error("ID outfit wajib diisi.");
        error.status = 400;
        throw error;
    }

    const mime = normalizeMimeType(getHeader(req, "content-type"));
    const bytes = bytesFromBody(req.body);
    const filename = cleanText(decodeHeader(getHeader(req, "x-file-name")), 180)
        || `outfit.${extensionForMime(mime)}`;
    if (!mime || !bytes.length || bytes.length > MAX_REFERENCE_BYTES || !hasValidImageSignature(bytes, mime)) {
        const error = new Error("File outfit harus berupa JPEG, PNG, atau WebP yang valid dan berukuran maksimal 8 MB.");
        error.status = 400;
        throw error;
    }

    const rows = await supabaseRequest(
        config,
        tablePath("social_outfits", `select=id,object_key&id=eq.${encodeURIComponent(outfitId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    if (!rows?.length) {
        const error = new Error("Outfit tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    const oldKey = rows[0].object_key;
    const key = `social-outfit/${userId}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
    await uploadReferenceObject(config, key, bytes, mime);

    try {
        const updated = await supabaseRequest(
            config,
            tablePath("social_outfits", `id=eq.${encodeURIComponent(outfitId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id`),
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    object_key: key,
                    filename: filename.replace(/[\\/\0]/g, "").slice(0, 180),
                    mime_type: mime,
                    size_bytes: bytes.length,
                    updated_at: new Date().toISOString()
                })
            }
        );
        if (!updated?.length) {
            const error = new Error("Outfit tidak ditemukan.");
            error.status = 404;
            throw error;
        }
    } catch (error) {
        await deleteReferenceObject(config, key).catch(() => {});
        throw error;
    }

    if (oldKey && oldKey !== key) {
        await deleteReferenceObject(config, oldKey).catch(() => {});
    }
    return json(res, 200, { success: true });
}

async function saveOutfit(config, userId, body = {}) {
    const id = cleanText(body.id, 80);
    const name = cleanText(body.name, 80);
    if (!id || !name) {
        const error = new Error("ID dan nama outfit wajib diisi.");
        error.status = 400;
        throw error;
    }

    const values = {
        name,
        order_url: normalizeOutfitOrderUrl(body.order_url),
        notes: cleanText(body.notes, 400),
        updated_at: new Date().toISOString()
    };
    if (typeof body.is_active === "boolean") values.is_active = body.is_active;

    const rows = await supabaseRequest(
        config,
        tablePath("social_outfits", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id,character_id,name,filename,mime_type,order_url,notes,is_active,created_at`),
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(values)
        }
    );
    if (!rows?.length) {
        const error = new Error("Outfit tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    return rows[0];
}

async function deleteOutfit(config, userId, body = {}) {
    const id = cleanText(body.id, 80);
    if (!id) {
        const error = new Error("ID outfit wajib diisi.");
        error.status = 400;
        throw error;
    }
    const rows = await supabaseRequest(
        config,
        tablePath("social_outfits", `select=id,object_key&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    const outfit = rows?.[0];
    if (!outfit) {
        const error = new Error("Outfit tidak ditemukan.");
        error.status = 404;
        throw error;
    }

    await supabaseRequest(
        config,
        tablePath("social_outfits", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`),
        { method: "DELETE" }
    );
    try {
        await deleteReferenceObject(config, outfit.object_key);
    } catch (error) {
        console.error("Outfit object cleanup failed:", error?.message || "unknown error");
    }
    return { id };
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

async function replaceReference(req, res, config, userId) {
    if (!await isPrivateReferenceBucket(config)) {
        const error = new Error("Bucket privat Supabase Storage untuk foto referensi belum tersedia.");
        error.status = 503;
        throw error;
    }

    const characterId = cleanText(decodeHeader(getHeader(req, "x-character-id")), 80);
    if (!characterId) {
        const error = new Error("ID karakter wajib diisi.");
        error.status = 400;
        throw error;
    }

    const mime = normalizeMimeType(getHeader(req, "content-type"));
    const bytes = bytesFromBody(req.body);
    const filename = cleanText(decodeHeader(getHeader(req, "x-file-name")), 180) || `reference.${extensionForMime(mime)}`;
    if (!mime || !bytes.length || bytes.length > MAX_REFERENCE_BYTES || !hasValidImageSignature(bytes, mime)) {
        const error = new Error("File harus berupa JPEG, PNG, atau WebP yang valid dan berukuran maksimal 8 MB.");
        error.status = 400;
        throw error;
    }

    const rows = await supabaseRequest(config, tablePath("social_characters", `select=id,reference_object_key&id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
    if (!rows?.length) {
        const error = new Error("Karakter tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    const oldKey = rows[0].reference_object_key;
    const key = `social-reference/${userId}/${characterId}-${Date.now().toString(36)}.${extensionForMime(mime)}`;
    await uploadReferenceObject(config, key, bytes, mime);

    try {
        const updated = await supabaseRequest(config, tablePath("social_characters", `id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id`), {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                reference_object_key: key,
                reference_filename: filename.replace(/[\\/\0]/g, "").slice(0, 180),
                reference_mime_type: mime,
                reference_size_bytes: bytes.length,
                updated_at: new Date().toISOString()
            })
        });
        if (!updated?.length) {
            const error = new Error("Karakter tidak ditemukan.");
            error.status = 404;
            throw error;
        }
    } catch (error) {
        await deleteReferenceObject(config, key).catch(() => {});
        throw error;
    }

    if (oldKey && oldKey !== key) {
        await deleteReferenceObject(config, oldKey).catch(() => {});
    }
    return json(res, 200, { success: true });
}

async function deleteCharacter(config, userId, body) {
    const id = cleanText(body?.id, 80);
    if (!id) {
        const error = new Error("ID karakter wajib diisi.");
        error.status = 400;
        throw error;
    }
    const schedules = await supabaseRequest(config, tablePath("social_post_schedules", `select=id&character_id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
    if (schedules?.length) {
        const error = new Error("Karakter masih dipakai jadwal tersimpan. Hapus atau ganti karakter pada jadwal tersebut terlebih dahulu.");
        error.status = 409;
        throw error;
    }
    const rows = await supabaseRequest(config, tablePath("social_characters", `select=id,reference_object_key&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
    if (!rows?.length) {
        const error = new Error("Karakter tidak ditemukan.");
        error.status = 404;
        throw error;
    }
    await supabaseRequest(config, tablePath("social_characters", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`), { method: "DELETE" });
    if (rows[0].reference_object_key) {
        await deleteReferenceObject(config, rows[0].reference_object_key).catch(() => {});
    }
    return { id };
}

async function savePostingSettings(config, userId, body = {}) {
    const captionTemplate = cleanText(body.caption_template, 1000);
    const externalLink = cleanText(body.external_link, 500);
    if (!captionTemplate) {
        const error = new Error("Caption dasar wajib diisi.");
        error.status = 400;
        throw error;
    }
    if (externalLink) {
        let url;
        try {
            url = new URL(externalLink);
        } catch {
            const error = new Error("Link external harus berupa URL HTTPS yang valid.");
            error.status = 400;
            throw error;
        }
        if (url.protocol !== "https:") {
            const error = new Error("Link external harus menggunakan HTTPS.");
            error.status = 400;
            throw error;
        }
    }

    const rows = await supabaseRequest(
        config,
        tablePath("social_publisher_user_settings", "on_conflict=owner_id&select=owner_id,caption_template,external_link,updated_at"),
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({
                owner_id: userId,
                caption_template: captionTemplate,
                external_link: externalLink,
                updated_at: new Date().toISOString()
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Pengaturan caption dan link tidak berhasil disimpan.");
        error.status = 500;
        throw error;
    }
    return rows[0];
}

function resolvePostLimit(profile) {
    const raw = profile?.post_limit;
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function saveSchedule(config, userId, body, profile) {
    const postMode = normalizeSocialPostMode(body?.post_mode);
    const isQuoteMode = postMode === "quote";
    const hasExplicitQuoteFields = isQuoteMode ||
        body?.post_mode !== undefined ||
        body?.quote_theme !== undefined ||
        body?.quote_visual_style !== undefined ||
        body?.quote_publish_target !== undefined ||
        body?.use_random_song !== undefined;
    const quotePublishTarget = normalizeQuotePublishTarget(body?.quote_publish_target, "feed");
    const characterId = isQuoteMode ? "" : cleanText(body?.character_id, 80);
    const pageConnectionId = cleanText(body?.page_connection_id, 80);
    const nextRunAt = Date.parse(String(body?.next_run_at || ""));
    const timezone = cleanText(body?.timezone, 80) || "Asia/Jakarta";
    const aspectRatio = normalizeSocialAspectRatio(body?.aspect_ratio);
    const defaultCaption = isQuoteMode
        ? "Renungan hari ini ✨ #KataMutiara #GENZAI"
        : "Cerita hari ini dari {location} ✨";
    const captionTemplate = cleanText(body?.caption_template, 1000) || defaultCaption;
    const id = cleanText(body?.id, 80);
    /* Parameter detail gambar. String kosong berarti otomatis. */
    const sceneParams = {
        scene_location: cleanText(body?.scene_location, 400),
        camera_angle: cleanText(body?.camera_angle, 200),
        scene_situation: cleanText(body?.scene_situation, 400),
        scene_lighting: cleanText(body?.scene_lighting, 300),
        scene_atmosphere: cleanText(body?.scene_atmosphere, 300),
        scene_condition: cleanText(body?.scene_condition, 300),
        scene_details: cleanText(body?.scene_details, 400),
        negative_prompt: cleanText(body?.negative_prompt, 400)
    };
    const quoteParams = {
        post_mode: postMode,
        quote_theme: isQuoteMode ? cleanText(body?.quote_theme, 120) : "",
        quote_visual_style: isQuoteMode ? cleanText(body?.quote_visual_style, 240) : "",
        quote_publish_target: isQuoteMode ? quotePublishTarget : "feed",
        use_random_song: typeof body?.use_random_song === "boolean"
            ? body.use_random_song
            : isQuoteMode
    };
    const scheduleAutopublish = typeof body?.autopublish_enabled === "boolean" ? body.autopublish_enabled : true;

    /* Interval autopost berbasis role dalam menit: ADMIN/OWNER tercepat 5 menit,
       USER tercepat 60 menit (1 jam). */
    const intervalPolicy = getScheduleIntervalPolicy(profile?.role);
    if (!intervalPolicy) {
        const error = new Error("Role akun Anda tidak diizinkan mengatur jadwal autopost. Hubungi owner atau admin.");
        error.status = 403;
        throw error;
    }
    const { role, minIntervalMinutes, maxIntervalMinutes, maxSchedules } = intervalPolicy;
    const requestedMinutes = body?.interval_minutes !== undefined && body?.interval_minutes !== null
        ? body.interval_minutes
        : Number(body?.interval_hours) * 60;
    const intervalMinutes = clampIntervalMinutes(requestedMinutes, minIntervalMinutes, maxIntervalMinutes);

    if ((!isQuoteMode && !characterId) || !pageConnectionId || !intervalMinutes || !aspectRatio || !Number.isFinite(nextRunAt) || nextRunAt < Date.now() - 60_000) {
        const error = new Error(
            isQuoteMode
                ? `Pilih Facebook Page, rasio 9:16 atau 16:9, interval ${minIntervalMinutes}–${maxIntervalMinutes} menit (minimal ${formatIntervalMinutes(minIntervalMinutes)} untuk role ${role}), dan waktu mulai yang valid.`
                : `Pilih karakter, Facebook Page, rasio 9:16 atau 16:9, interval ${minIntervalMinutes}–${maxIntervalMinutes} menit (minimal ${formatIntervalMinutes(minIntervalMinutes)} untuk role ${role}), dan waktu mulai yang valid.`
        );
        error.status = 400;
        throw error;
    }
    if (timezone !== "Asia/Jakarta") {
        const error = new Error("Zona waktu Social Publisher saat ini ditetapkan ke Asia/Jakarta (WIB).");
        error.status = 400;
        throw error;
    }

    const [characters, pages] = await Promise.all([
        isQuoteMode
            ? Promise.resolve([{ id: null }])
            : supabaseRequest(config, tablePath("social_characters", `select=id&id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)),
        supabaseRequest(config, tablePath("social_page_connections", `select=id,can_publish&id=eq.${encodeURIComponent(pageConnectionId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`))
    ]);
    if (!characters?.length || !pages?.length) {
        const error = new Error(isQuoteMode ? "Koneksi Facebook Page tidak ditemukan." : "Karakter atau koneksi Page tidak ditemukan.");
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
        character_id: isQuoteMode ? null : characterId,
        page_connection_id: pageConnectionId,
        interval_hours: Math.min(168, Math.max(1, Math.round(intervalMinutes / 60))),
        interval_minutes: intervalMinutes,
        next_run_at: new Date(nextRunAt).toISOString(),
        timezone,
        aspect_ratio: aspectRatio,
        caption_template: captionTemplate,
        ...sceneParams,
        ...(hasExplicitQuoteFields ? quoteParams : {}),
        enabled: body?.enabled === true,
        updated_at: new Date().toISOString()
    };
    /* Saat mengubah jadwal, switch autopublish hanya ikut berubah bila dikirim
       eksplisit, supaya edit jadwal tidak diam-diam menyalakannya kembali. */
    if (!id || typeof body?.autopublish_enabled === "boolean") {
        values.autopublish_enabled = scheduleAutopublish;
    }

    const selectColumns = hasExplicitQuoteFields ? SCHEDULE_FULL_COLUMNS : SCHEDULE_COLUMNS;

    async function writeScheduleRow(method, querySuffix = "") {
        try {
            return await supabaseRequest(
                config,
                tablePath("social_post_schedules", `${querySuffix ? `${querySuffix}&` : ""}select=${selectColumns}`),
                {
                    method,
                    headers: { Prefer: "return=representation" },
                    body: JSON.stringify(values)
            }
            );
        } catch (error) {
            if (hasExplicitQuoteFields && isMissingQuoteTargetColumn(error)) {
                const withoutTargetValues = { ...values };
                delete withoutTargetValues.quote_publish_target;
                return await supabaseRequest(
                    config,
                    tablePath("social_post_schedules", `${querySuffix ? `${querySuffix}&` : ""}select=${SCHEDULE_QUOTE_BASE_COLUMNS}`),
                    {
                        method,
                        headers: { Prefer: "return=representation" },
                        body: JSON.stringify(withoutTargetValues)
                    }
                );
            }
            if (!isQuoteMode && hasExplicitQuoteFields && isMissingScheduleQuoteSchema(error) && !quoteParams.use_random_song) {
                const legacyValues = { ...values };
                for (const key of SCHEDULE_QUOTE_COLUMNS) delete legacyValues[key];
                return await supabaseRequest(
                    config,
                    tablePath("social_post_schedules", `${querySuffix ? `${querySuffix}&` : ""}select=${SCHEDULE_COLUMNS}`),
                    {
                        method,
                        headers: { Prefer: "return=representation" },
                        body: JSON.stringify(legacyValues)
                    }
                ).catch(rethrowMissingScheduleSceneSchema);
            }
            return rethrowMissingScheduleSceneSchema(error);
        }
    }

    if (id) {
        const rows = await writeScheduleRow("PATCH", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}`);
        if (!rows?.length) {
            const error = new Error("Jadwal tidak ditemukan.");
            error.status = 404;
            throw error;
        }
        return rows[0];
    }

    /* Batas jumlah blok jadwal: post_limit per akun (diatur admin) memakai prioritas
       tertinggi; bila kosong, pakai default role (USER 2, ADMIN/OWNER tanpa batas). */
    const postLimit = resolvePostLimit(profile);
    const scheduleLimit = postLimit ?? maxSchedules;
    if (scheduleLimit !== null && scheduleLimit !== undefined) {
        const existing = await supabaseRequest(
            config,
            tablePath("social_post_schedules", `select=id&owner_id=eq.${encodeURIComponent(userId)}`)
        );
        if ((existing || []).length >= scheduleLimit) {
            const error = new Error(`Batas Posting Anda maksimal ${scheduleLimit} jadwal. Hubungi admin untuk menambah batas posting`);
            error.status = 409;
            error.code = "post_limit";
            throw error;
        }
    }

    const rows = await writeScheduleRow("POST");
    return rows?.[0] || null;
}

async function patchManualRunWithFallback(config, runId, userId, bodyValues) {
    try {
        await supabaseRequest(
            config,
            tablePath("social_post_runs", `id=eq.${encodeURIComponent(runId)}&owner_id=eq.${encodeURIComponent(userId)}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(bodyValues)
            }
        );
    } catch (error) {
        if (!isMissingQuoteRunColumns(error)) throw error;
        const fallback = { ...bodyValues };
        for (const key of ["post_mode", "quote_text", "quote_theme", "quote_publish_target", "song_id", "song_title", "song_artist", "song_facebook_url"]) {
            delete fallback[key];
        }
        await supabaseRequest(
            config,
            tablePath("social_post_runs", `id=eq.${encodeURIComponent(runId)}&owner_id=eq.${encodeURIComponent(userId)}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(fallback)
            }
        );
    }
}

async function generateManualPost(config, userId, env, body = {}) {
    const postMode = normalizeSocialPostMode(body.post_mode);
    const isQuoteMode = postMode === "quote";
    const quotePublishTarget = normalizeQuotePublishTarget(body.quote_publish_target, "feed");
    const useRandomSong = typeof body.use_random_song === "boolean"
        ? body.use_random_song
        : isQuoteMode;
    const characterId = isQuoteMode ? "" : cleanText(body.character_id, 80);
    const pageConnectionId = cleanText(body.page_connection_id, 80);
    const aspectRatio = isQuoteMode ? "9:16" : normalizeSocialAspectRatio(body.aspect_ratio);
    if ((!isQuoteMode && !characterId) || !pageConnectionId) {
        const error = new Error(
            isQuoteMode
                ? "Pilih Facebook Page sebelum membuat pratinjau kata-kata mutiara."
                : "Pilih karakter tersimpan dan Facebook Page sebelum membuat pratinjau."
        );
        error.status = 400;
        throw error;
    }
    if (!aspectRatio) {
        const error = new Error("Pilih rasio gambar 9:16 atau 16:9.");
        error.status = 400;
        throw error;
    }
    const { provider: imageProvider, imageModel, opusModel, quoteLlmModel, textProvider } = await getSocialImageSettings(config, env);
    const hasQwenCloudKey = Boolean(envValue(env, "QWENCLOUD_API_KEY"));
    const quoteAiProvider = hasQwenCloudKey ? "qwencloud" : imageProvider;
    const activeProvider = isQuoteMode ? quoteAiProvider : imageProvider;
    const missingProviderKey = activeProvider === "gemini"
        ? !envValue(env, "GEMINI_API_KEY")
        : activeProvider === "qwencloud"
            ? !hasQwenCloudKey
            : activeProvider === "opus"
                ? !opusConfigured(env)
                : false;
    if (missingProviderKey || !envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")) {
        const error = new Error(activeProvider === "gemini"
            ? "GEMINI_API_KEY diperlukan saat provider Gemini dipilih dan SOCIAL_TOKEN_ENCRYPTION_KEY diperlukan untuk posting manual."
            : activeProvider === "qwencloud"
                ? "QWENCLOUD_API_KEY diperlukan saat provider QwenCloud dipilih dan SOCIAL_TOKEN_ENCRYPTION_KEY diperlukan untuk posting manual."
                : activeProvider === "opus"
                    ? "OPUS_AUTH_TOKEN diperlukan saat provider Opus dipilih dan SOCIAL_TOKEN_ENCRYPTION_KEY diperlukan untuk posting manual."
                    : "SOCIAL_TOKEN_ENCRYPTION_KEY diperlukan untuk posting manual.");
        error.status = 503;
        throw error;
    }
    if (activeProvider === "cloudflare" && typeof env?.AI?.run !== "function") {
        const error = new Error("Binding Cloudflare Workers AI belum tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    if (!isQuoteMode && !await isPrivateReferenceBucket(config)) {
        const error = new Error("Bucket privat Supabase Storage untuk foto karakter belum tersedia.");
        error.status = 503;
        throw error;
    }

    const [characters, pages] = await Promise.all([
        isQuoteMode
            ? Promise.resolve([])
            : supabaseRequest(
                config,
                tablePath("social_characters", `select=id,owner_id,display_name,reference_object_key,reference_mime_type,prompt_notes&id=eq.${encodeURIComponent(characterId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
            ),
        supabaseRequest(
            config,
            tablePath("social_page_connections", `select=id,owner_id,page_id,page_name,can_publish,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(pageConnectionId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
        )
    ]);
    const character = characters?.[0] || null;
    const page = pages?.[0];
    if ((!isQuoteMode && !character) || !page) {
        const error = new Error(
            isQuoteMode
                ? "Koneksi Facebook Page tidak ditemukan untuk akun ini."
                : "Karakter atau koneksi Facebook Page tidak ditemukan untuk akun ini."
        );
        error.status = 404;
        throw error;
    }
    if (page.can_publish === false) {
        const error = new Error("Koneksi Facebook Page belum memiliki izin CREATE_CONTENT.");
        error.status = 409;
        throw error;
    }

    /* Pakaian hanya berasal dari outfit yang dipilih pada mode karakter. */
    const outfitSelection = isQuoteMode
        ? { outfit: null, ready: false }
        : await pickOutfitForPost(config, userId, characterId);
    const outfit = outfitSelection.outfit;
    const outfitLibraryReady = outfitSelection.ready;
    const garmentObjectKey = outfit?.object_key || "";
    const garmentMimeType = outfit?.mime_type || "";

    const [settingsRows, previousPreviews, song] = await Promise.all([
        supabaseRequest(
            config,
            tablePath("social_publisher_user_settings", `select=caption_template,external_link&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
        ),
        supabaseRequest(
            config,
            tablePath("social_post_runs", "select=id&status=eq.generating&schedule_id=is.null&owner_id=eq." + encodeURIComponent(userId))
        ),
        useRandomSong ? pickSongForPost(config, userId, { requirePlayableAudio: isQuoteMode }) : Promise.resolve(null)
    ]);
    for (const previous of previousPreviews || []) {
        await supabaseRequest(
            config,
            tablePath("social_post_runs", `id=eq.${encodeURIComponent(previous.id)}&owner_id=eq.${encodeURIComponent(userId)}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    status: "failed",
                    error_message: "Pratinjau manual digantikan oleh permintaan baru.",
                    finished_at: new Date().toISOString()
                })
            }
        );
    }
    const postingSettings = settingsRows?.[0] || {
        caption_template: isQuoteMode ? "Renungan hari ini ✨ #KataMutiara #GENZAI" : "Cerita hari ini ✨",
        external_link: ""
    };
    const now = new Date().toISOString();
    let runRows;
    const initialRunBody = {
        owner_id: userId,
        schedule_id: null,
        page_connection_id: pageConnectionId,
        status: "generating",
        scheduled_for: now,
        started_at: now,
        ...(outfitLibraryReady ? outfitRunValues(outfit) : {}),
        ...(isQuoteMode || song ? quoteAndSongRunValues({ postMode, quotePublishTarget: isQuoteMode ? quotePublishTarget : "", song }) : {})
    };
    try {
        runRows = await supabaseRequest(
            config,
            tablePath("social_post_runs", "select=id,status,scheduled_for,created_at"),
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify(initialRunBody)
            }
        );
    } catch (insertError) {
        if (!isMissingQuoteRunColumns(insertError)) throw insertError;
        const legacyRunBody = { ...initialRunBody };
        for (const key of ["post_mode", "quote_text", "quote_theme", "quote_publish_target", "song_id", "song_title", "song_artist", "song_facebook_url"]) {
            delete legacyRunBody[key];
        }
        runRows = await supabaseRequest(
            config,
            tablePath("social_post_runs", "select=id,status,scheduled_for,created_at"),
            {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify(legacyRunBody)
            }
        );
    }
    const run = runRows?.[0];
    if (!run?.id) {
        const error = new Error("Run posting manual gagal dicatat.");
        error.status = 500;
        throw error;
    }

    try {
        if (isQuoteMode) {
            let recentQuotes = [];
            try {
                const recentQuoteRuns = await supabaseRequest(
                    config,
                    tablePath("social_post_runs", `select=quote_text,scene_plan&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=8`)
                );
                recentQuotes = (recentQuoteRuns || [])
                    .map(item => item.quote_text || item.scene_plan?.quote_text)
                    .filter(Boolean);
            } catch {
                // Jangan blokir pratinjau bila riwayat kutipan belum tersedia.
            }
            const quotePlan = {
                ...createQuotePlan([], Math.random, quoteOverridesFromSchedule({
                    quote_theme: body.quote_theme,
                    quote_visual_style: body.quote_visual_style,
                    scene_details: body.scene_details
                })),
                aspect_ratio: "9:16"
            };
            const manualCustomQuote = cleanQuoteText(body.custom_quote);
            const quoteResult = manualCustomQuote
                ? {
                    quoteText: manualCustomQuote,
                    contextualCaption: "",
                    model: "manual-quote"
                }
                : await generateSocialQuote({
                    env,
                    quotePlan,
                    recentQuotes,
                    imageProvider: quoteAiProvider,
                    textProvider: hasQwenCloudKey ? "qwencloud" : textProvider,
                    llmModel: quoteLlmModel
                });
            if (!manualCustomQuote && quoteAiProvider === "qwencloud") {
                recordModelUsage(config, quoteResult.model || quoteLlmModel).catch(recordError => {
                    console.error("Could not record QwenCloud LLM usage:", recordError?.message || "unknown error");
                });
            }
            const quoteText = quoteResult.quoteText;
            const resolvedQuoteModel = quoteResult.model || quoteLlmModel || "solid-black";
            const prompt = "solid-black-background (#000000)";

            const audioBytes = await resolveStorySongAudioBytes(env, config, song);
            const storyCard = await renderQuoteStoryCard({
                solidBlack: true,
                quoteText,
                authorName: page.page_name
            });
            const encodedStory = encodeStoryMp4({
                rgba: storyCard.rgba,
                width: storyCard.width,
                height: storyCard.height,
                audioBytes,
                maxDurationSec: maxQuoteVideoDurationForTarget(quotePublishTarget)
            });
            // Postingan Kata-kata Mutiara + Musik memakai latar hitam polos (#000000) tanpa kuota gambar + teks LLM QwenCloud.
            const caption = quoteText;
            const sceneRecord = {
                ...quotePlan,
                background_mode: "solid_black",
                post_mode: "quote",
                quote_publish_target: quotePublishTarget,
                quote_llm_model: resolvedQuoteModel,
                quote_text: quoteText,
                quote_signature: storyCard.signatureText || "",
                ...(song ? {
                    song_id: song.id || null,
                    song_title: song.title || "",
                    song_artist: song.artist || "",
                    song_facebook_url: ""
                } : {})
            };

            await patchManualRunWithFallback(config, run.id, userId, {
                status: "generating",
                scene_plan: sceneRecord,
                generated_prompt: prompt,
                caption,
                image_model: resolvedQuoteModel,
                ...quoteAndSongRunValues({
                    postMode: "quote",
                    quoteText,
                    quoteTheme: quotePlan.themeLabel,
                    quotePublishTarget,
                    song: song ? { ...song, facebook_url: "" } : null
                }),
                error_message: null
            });

            return {
                run_id: run.id,
                status: "preview",
                post_mode: "quote",
                quote_publish_target: quotePublishTarget,
                is_story: quotePublishTarget === "story",
                page_name: page.page_name,
                quote_signature: storyCard.signatureText || "",
                image_base64: bytesToBase64(storyCard.pngBytes),
                image_mime_type: "image/png",
                video_base64: bytesToBase64(encodedStory.mp4Bytes),
                video_mime_type: "video/mp4",
                duration_seconds: encodedStory.durationSec,
                image_model: resolvedQuoteModel,
                quote_llm_model: resolvedQuoteModel,
                aspect_ratio: "9:16",
                scene: sceneRecord,
                quote_text: quoteText,
                quote_theme: quotePlan.themeLabel,
                contextual_caption: "",
                caption,
                outfit: null,
                song: song ? { ...song, facebook_url: "" } : null
            };
        }

        /*
         * Diambil lewat `downloadModelReference`: Supabase memperkecil gambar
         * lebih dulu sehingga Worker tidak perlu men-decode foto 4–12 MP di
         * dalam request (itu yang memicu Error 1102 "Worker exceeded resource
         * limits" pada foto 928 KB + outfit 752 KB).
         */
        /*
         * 1024 px, bukan 512: foto utuh tetap diperkecil ke 512 untuk
         * `input_image_0`, tetapi potret wajah dipotong dari versi 1024 px
         * sehingga wajahnya ~2x lebih besar dan kemiripan naik. Versi 512 px
         * hanya menyisakan wajah ~40 px pada foto badan penuh.
         */
        const referenceSource = imageProvider === "opus"
            ? {
                bytes: await downloadReferenceObject(config, character.reference_object_key),
                mimeType: character.reference_mime_type,
                source: "original"
            }
            : await downloadModelReference(
                config,
                character.reference_object_key,
                { maxSide: imageProvider === "cloudflare" ? 1024 : 512 }
            );
        const referenceBytes = referenceSource.bytes;
        if (!referenceBytes.length || referenceBytes.length > MAX_REFERENCE_BYTES) {
            throw new Error("Ukuran foto referensi karakter tidak valid.");
        }
        const referenceMimeType = referenceSource.mimeType || character.reference_mime_type;
        /*
         * Outfit juga diunduh untuk Cloudflare: FLUX.2 klein menerima foto
         * pakaian sebagai `input_image_1` agar potongan pakaian konsisten.
         * Khusus Opus, lewati percobaan transformasi 512px Supabase agar hemat
         * subrequest dan resolusi asli (300px–6000px) terjaga.
         */
        const garmentSource = garmentObjectKey
            ? (imageProvider === "opus"
                ? {
                    bytes: await downloadReferenceObject(config, garmentObjectKey),
                    mimeType: garmentMimeType,
                    source: "original"
                }
                : await downloadModelReference(config, garmentObjectKey))
            : null;
        const garmentBytes = garmentSource?.bytes || null;
        const garmentMime = garmentSource?.mimeType || garmentMimeType;
        const effectiveAspectRatio = imageProvider === "opus"
            ? resolveOpusAspectRatio(env, aspectRatio)
            : aspectRatio;
        const scene = applyOutfitToScene(
            { ...createScenePlan([]), aspect_ratio: effectiveAspectRatio },
            outfit
        );
        const referenceImageUrl = (imageProvider === "cloudflare" || imageProvider === "opus")
            ? await createSignedReferenceUrl(config, character.reference_object_key)
            : "";
        const opusGarmentUrl = (imageProvider === "opus" && garmentObjectKey)
            ? await createSignedReferenceUrl(config, garmentObjectKey)
            : "";
        const prompt = buildImagePrompt({
            characterName: character.display_name,
            characterNotes: character.prompt_notes,
            scene,
            aspectRatio: effectiveAspectRatio,
            outfitName: outfit?.name,
            outfitNotes: outfit?.notes,
            hasOutfitReference: Boolean(garmentObjectKey),
            useReferenceOutfit: !garmentObjectKey
        });
        const generated = await generateSocialImage({
            env,
            prompt,
            referenceBytes,
            referenceMimeType,
            aspectRatio: effectiveAspectRatio,
            imageProvider,
            ...(imageProvider === "cloudflare" ? {
                personImageUrl: referenceImageUrl,
                /* Tanpa outfit, foto referensi karakter juga menjadi acuan
                   pakaian supaya pakaian default mengikuti foto tersebut. */
                garmentImageUrls: [garmentObjectKey
                    ? await createSignedReferenceUrl(config, garmentObjectKey)
                    : referenceImageUrl]
            } : imageProvider === "opus" ? {
                personImageUrl: referenceImageUrl,
                ...(opusGarmentUrl ? { garmentImageUrls: [opusGarmentUrl] } : {})
            } : {}),
            ...(imageProvider === "cloudflare" ? {
                garmentBytes,
                garmentMimeType: garmentMime
            } : {
                garmentBytes,
                garmentMimeType: garmentMime,
                ...(imageProvider === "qwencloud"
                    ? { imageModel }
                    : imageProvider === "opus"
                        ? { imageModel: opusModel || normalizeOpusImageModel(imageModel, env) }
                        : {})
            })
        });
        if (!generated?.bytes?.length) throw new Error("Provider gambar tidak mengembalikan gambar.");
        /*
         * Cloudflare bisa turun ke model gratis (SDXL img2img / FLUX schnell)
         * ketika try-on Pruna tidak tersedia di akun ini. Alasannya diteruskan
         * ke UI agar admin tahu model mana yang benar-benar dipakai.
         */
        const imageNote = Array.isArray(generated?.warnings) && generated.warnings.length
            ? generated.warnings.join(" ").slice(0, 600)
            : "";
        if (imageNote) {
            console.warn("[Social Publisher] Cloudflare image fallback:", imageNote);
        }
        if (imageProvider === "qwencloud") {
            recordModelUsage(config, generated.model).catch(recordError => {
                console.error("Could not record QwenCloud model usage:", recordError?.message || "unknown error");
            });
        }
        const cleanedBlob = await stripImageMetadata(
            generated.bytes,
            generated.mimeType
        );
        const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
        const contextualCaption = await generateSocialContextCaption({
            env,
            imageBytes: cleanedBytes,
            imageMimeType: cleanedBlob.type,
            characterName: character.display_name,
            scene,
            imageProvider,
            textProvider
        });
        const baseCaption = renderCaption(postingSettings.caption_template, scene, character.display_name);
        const caption = composeSocialCaption({
            baseCaption,
            contextualCaption,
            externalLink: postingSettings.external_link,
            outfit: outfitCaptionSource(outfit),
            song
        });
        const sceneRecord = song
            ? {
                ...scene,
                song_id: song.id || null,
                song_title: song.title || "",
                song_artist: song.artist || "",
                song_facebook_url: song.facebook_url || ""
            }
            : scene;

        await patchManualRunWithFallback(config, run.id, userId, {
            status: "generating",
            scene_plan: sceneRecord,
            generated_prompt: prompt,
            caption,
            image_model: generated.model,
            ...(outfitLibraryReady ? outfitRunValues(outfit) : {}),
            ...(song ? quoteAndSongRunValues({ postMode: "character", song }) : {}),
            error_message: null
        });
        return {
            run_id: run.id,
            status: "preview",
            page_name: page.page_name,
            image_base64: bytesToBase64(cleanedBytes),
            image_mime_type: cleanedBlob.type,
            image_model: generated.model,
            ...(imageNote ? { image_note: imageNote } : {}),
            aspect_ratio: effectiveAspectRatio,
            scene: sceneRecord,
            contextual_caption: contextualCaption,
            caption,
            outfit: outfitCaptionSource(outfit),
            ...(song ? { song } : {})
        };
    } catch (error) {
        const failedQuotaModel = error?.llmModel
            ? error.llmModel
            : (imageProvider === "qwencloud" && !isQuoteMode ? imageModel : "");
        if (failedQuotaModel && (error?.quotaExhausted === true || error?.status === 429)) {
            recordModelUsage(config, failedQuotaModel, { quotaError: true, message: error?.message }).catch(recordError => {
                console.error("Could not record QwenCloud quota failure:", recordError?.message || "unknown error");
            });
        }
        const safeMessage = String(error?.message || "Pembuatan pratinjau manual gagal.")
            .replace(/(access_token|api[_-]?key)=?[^&\s]+/gi, "$1=[redacted]")
            .slice(0, 1000);
        try {
            await supabaseRequest(
                config,
                tablePath("social_post_runs", `id=eq.${encodeURIComponent(run.id)}&owner_id=eq.${encodeURIComponent(userId)}`),
                {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({
                        status: "failed",
                        error_message: safeMessage,
                        finished_at: new Date().toISOString()
                    })
                }
            );
        } catch (updateError) {
            console.error("Could not record manual Social Publisher failure:", updateError?.message || "unknown error");
        }
        const failure = new Error(safeMessage);
        failure.status = Number(error?.status) || 502;
        throw failure;
    }
}

function hasValidMp4Signature(bytes) {
    if (!bytes || bytes.length < 32) return false;
    return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

async function publishManualPost(req, res, config, userId, env) {
    const runId = cleanText(getHeader(req, "x-manual-run-id"), 80);
    const headerQuoteTarget = cleanText(getHeader(req, "x-quote-target"), 40);
    const rawContentType = String(getHeader(req, "content-type") || "").split(";")[0].trim().toLowerCase();
    const isQuoteVideo = rawContentType === "video/mp4";
    const imageMimeType = isQuoteVideo ? "" : normalizeMimeType(rawContentType);
    const payloadBytes = bytesFromBody(req.body);

    if (isQuoteVideo) {
        if (!runId || !payloadBytes.length || payloadBytes.length > 20 * 1024 * 1024 || !hasValidMp4Signature(payloadBytes)) {
            const error = new Error("Pratinjau Video Kata Mutiara tidak valid. Buat ulang pratinjau sebelum menerbitkan.");
            error.status = 400;
            throw error;
        }
    } else if (!runId || !imageMimeType || !payloadBytes.length || payloadBytes.length > 12 * 1024 * 1024 || !hasValidImageSignature(payloadBytes, imageMimeType)) {
        const error = new Error("Pratinjau tidak valid. Buat ulang gambar sebelum menerbitkan.");
        error.status = 400;
        throw error;
    }

    const runs = await supabaseRequest(
        config,
        tablePath("social_post_runs", `select=id,status,page_connection_id,scene_plan,generated_prompt,caption,image_model&owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(runId)}&schedule_id=is.null&limit=1`)
    );
    const run = runs?.[0];
    if (!run || run.status !== "generating" || !run.page_connection_id || !run.caption) {
        const error = new Error("Pratinjau tidak ditemukan atau sudah digunakan. Buat gambar baru.");
        error.status = 409;
        throw error;
    }

    const pages = await supabaseRequest(
        config,
        tablePath("social_page_connections", `select=id,page_id,page_name,can_publish,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(run.page_connection_id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    const page = pages?.[0];
    if (!page || page.can_publish === false) {
        const error = new Error("Facebook Page tidak ditemukan atau tidak memiliki izin CREATE_CONTENT.");
        error.status = 409;
        throw error;
    }

    const pageAccessToken = await decryptSecret(
        page.page_token_ciphertext,
        page.page_token_iv,
        envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")
    );

    const quoteTarget = isQuoteVideo
        ? normalizeQuotePublishTarget(headerQuoteTarget || run.scene_plan?.quote_publish_target, "feed")
        : "";

    try {
        let published;
        if (isQuoteVideo) {
            published = await publishFacebookQuoteVideo({
                env,
                pageId: page.page_id,
                pageAccessToken,
                videoBytes: payloadBytes,
                target: quoteTarget
            });
        } else {
            const cleanedBlob = await stripImageMetadata(payloadBytes, imageMimeType);
            const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
            published = await publishFacebookPhoto({
                env,
                pageId: page.page_id,
                pageAccessToken,
                caption: run.caption,
                imageBytes: cleanedBytes,
                imageMimeType: cleanedBlob.type
            });
        }
        const profileShareUrl = makeProfileShareUrl(published.permalinkUrl);
        await patchManualRunWithFallback(config, run.id, userId, {
            status: "posted",
            ...(isQuoteVideo ? {
                quote_publish_target: quoteTarget,
                scene_plan: {
                    ...(run.scene_plan && typeof run.scene_plan === "object" ? run.scene_plan : {}),
                    quote_publish_target: quoteTarget
                }
            } : {}),
            facebook_photo_id: published.photoId || published.videoId || null,
            facebook_post_id: published.postId || null,
            permalink_url: published.permalinkUrl || null,
            profile_share_url: profileShareUrl || null,
            finished_at: new Date().toISOString(),
            error_message: null
        });
        return json(res, 200, {
            success: true,
            post: {
                id: run.id,
                status: "posted",
                is_story: published.target === "story",
                target: published.target || (isQuoteVideo ? quoteTarget : "photo"),
                page_name: page.page_name,
                caption: run.caption,
                permalink_url: published.permalinkUrl || null
            }
        });
    } catch (error) {
        const safeMessage = String(error?.message || "Posting manual gagal.")
            .replace(/(access_token|api[_-]?key)=?[^&\s]+/gi, "$1=[redacted]")
            .slice(0, 1000);
        await supabaseRequest(
            config,
            tablePath("social_post_runs", `id=eq.${encodeURIComponent(run.id)}&owner_id=eq.${encodeURIComponent(userId)}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ status: "failed", error_message: safeMessage, finished_at: new Date().toISOString() })
            }
        ).catch(updateError => {
            console.error("Could not record manual Social Publisher failure:", updateError?.message || "unknown error");
        });
        const failure = new Error(safeMessage);
        failure.status = Number(error?.status) || 502;
        failure.code = String(error?.code || "");
        failure.retrySafe = error?.retrySafe !== false;
        failure.needsReconnect = error?.needsReconnect === true;
        throw failure;
    }
}

async function checkPageConnection(config, userId, env, body = {}) {
    const id = cleanText(body.id, 80);
    if (!id) {
        const error = new Error("ID koneksi Page wajib diisi.");
        error.status = 400;
        throw error;
    }

    const rows = await supabaseRequest(
        config,
        tablePath("social_page_connections", `select=id,page_id,page_name,can_publish,page_tasks,token_checked_at,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
    );
    const page = rows?.[0];
    if (!page) {
        const error = new Error("Koneksi Facebook Page tidak ditemukan.");
        error.status = 404;
        throw error;
    }

    const pageAccessToken = await decryptSecret(
        page.page_token_ciphertext,
        page.page_token_iv,
        envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")
    );

    let access = null;
    let failure = null;
    try {
        access = await checkFacebookPageAccess({ env, pageId: page.page_id, pageAccessToken });
    } catch (error) {
        failure = error;
    }

    const tasksRead = Boolean(access?.tasksRead !== false);
    const canPublish = failure ? false : access.canPublish;
    const tasks = failure || !tasksRead ? (Array.isArray(page.page_tasks) ? page.page_tasks : []) : access.tasks;
    const checkedAt = new Date().toISOString();
    const definitiveFailure = failure && !["facebook_unreachable", "facebook_unavailable"].includes(failure?.code);
    if (!failure || definitiveFailure) {
        await supabaseRequest(
            config,
            tablePath("social_page_connections", `id=eq.${encodeURIComponent(page.id)}&owner_id=eq.${encodeURIComponent(userId)}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    can_publish: canPublish,
                    page_tasks: tasks,
                    token_checked_at: checkedAt,
                    updated_at: checkedAt
                })
            }
        );
    }

    const token = failure ? null : await inspectFacebookPageToken({ env, pageAccessToken });
    let message;
    if (failure) {
        message = failure.message;
    } else if (!canPublish) {
        message = `Page "${access.pageName || page.page_name}" terhubung, tetapi akun Facebook yang dipakai belum punya tugas CREATE_CONTENT. Beri akses konten pada Page lalu hubungkan ulang.`;
    } else if (!tasksRead) {
        message = `Page "${access.pageName || page.page_name}" siap dipakai: token Page masih valid dan penerbitan tetap berjalan. Daftar tugas Page tidak dapat dibaca karena Graph API hanya mengizinkan field tasks pada User token (bukan Page token), sehingga peran CREATE_CONTENT belum dapat dipastikan — ini normal, bukan error. Bila nanti gagal dengan #200, periksa izin aplikasi Meta.`;
    } else {
        message = `Izin posting Page "${access.pageName || page.page_name}" siap (CREATE_CONTENT terdeteksi).`;
    }

    return {
        connection: {
            id: page.id,
            page_id: page.page_id,
            page_name: access?.pageName || page.page_name,
            can_publish: canPublish,
            page_tasks: tasks,
            token_checked_at: (!failure || definitiveFailure) ? checkedAt : page.token_checked_at || null
        },
        can_publish: canPublish,
        tasks_read: failure ? false : tasksRead,
        warning: access?.warning || "",
        token: token
            ? {
                valid: token.valid,
                type: token.type,
                expires_at: token.expiresAt,
                data_access_expires_at: token.dataAccessExpiresAt,
                app_id: token.appId,
                scopes: token.scopes
            }
            : null,
        code: failure?.code || "",
        needs_reconnect: failure?.needsReconnect === true,
        retry_safe: failure ? failure.retrySafe !== false : true,
        message
    };
}

async function discardManualPost(config, userId, body) {
    const runId = cleanText(body?.run_id, 80);
    if (!runId) {
        const error = new Error("ID pratinjau tidak valid.");
        error.status = 400;
        throw error;
    }
    const rows = await supabaseRequest(
        config,
        tablePath("social_post_runs", `id=eq.${encodeURIComponent(runId)}&owner_id=eq.${encodeURIComponent(userId)}&schedule_id=is.null&status=eq.generating&select=id`),
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                status: "failed",
                error_message: "Pratinjau manual dibuang sebelum diterbitkan.",
                finished_at: new Date().toISOString()
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Pratinjau tidak ditemukan atau sudah digunakan.");
        error.status = 409;
        throw error;
    }
    return { run_id: runId, status: "discarded" };
}

/**
 * Batalkan run yang menggantung di status `generating` (mis. permintaan mati
 * saat deploy, atau pratinjau manual yang halamannya sudah di-refresh sehingga
 * byte gambarnya hilang). Tanpa aksi ini baris seperti itu tertinggal selamanya
 * di riwayat dan mengunci jadwal autopost terkait.
 */
async function cancelPostRun(config, userId, body = {}) {
    const runId = cleanText(body?.run_id, 80);
    if (!runId) {
        const error = new Error("ID run tidak valid.");
        error.status = 400;
        throw error;
    }
    const rows = await supabaseRequest(
        config,
        tablePath("social_post_runs", `id=eq.${encodeURIComponent(runId)}&owner_id=eq.${encodeURIComponent(userId)}&status=eq.generating&select=id,schedule_id`),
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                status: "failed",
                error_message: "Dibatalkan dari riwayat oleh pengguna.",
                finished_at: new Date().toISOString()
            })
        }
    );
    if (!rows?.length) {
        const error = new Error("Run tidak ditemukan, bukan milik akun ini, atau sudah selesai diproses.");
        error.status = 409;
        throw error;
    }
    const row = rows[0];
    return { run_id: runId, status: "cancelled", schedule_id: row.schedule_id || null };
}

async function assertAutopublishReady(config, env) {
    const missing = [];
    const imageProvider = await getSocialImageProvider(config);
    if (imageProvider === "gemini" && !envValue(env, "GEMINI_API_KEY")) missing.push("GEMINI_API_KEY");
    if (imageProvider === "cloudflare" && typeof env?.AI?.run !== "function") missing.push("binding Cloudflare Workers AI (AI)");
    if (!envValue(env, "META_APP_ID") || !envValue(env, "META_APP_SECRET") || !envValue(env, "META_REDIRECT_URI") || !envValue(env, "META_LOGIN_CONFIG_ID")) missing.push("konfigurasi OAuth Meta (termasuk ID Facebook Login for Business)");
    if (!envValue(env, "SOCIAL_TOKEN_ENCRYPTION_KEY")) missing.push("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!await isPrivateReferenceBucket(config)) missing.push("bucket privat Supabase Storage untuk referensi");
    if (missing.length) {
        const error = new Error(`Belum dapat mengaktifkan autopost. Lengkapi: ${missing.join(", ")}.`);
        error.status = 409;
        throw error;
    }
}

/**
 * Switch autopublish MILIK USER INI.
 * Disimpan di social_publisher_user_settings.owner_id = user, jadi mematikan
 * autopost hanya berlaku untuk jadwal milik user tersebut. Nilai default untuk
 * baris yang belum ada adalah aktif, sehingga jadwal lama tetap berjalan.
 */
async function setUserAutopublish(config, userId, env, enabled) {
    if (enabled) await assertAutopublishReady(config, env);
    const rows = await supabaseRequest(config, tablePath("social_publisher_user_settings", "on_conflict=owner_id&select=owner_id,autopublish_enabled,updated_at"), {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ owner_id: userId, autopublish_enabled: enabled, updated_at: new Date().toISOString() })
    });
    return rows?.[0] || { owner_id: userId, autopublish_enabled: enabled };
}

/**
 * Master switch global (admin/owner). Menghentikan autopost SEMUA user sekaligus
 * dan dipakai saat perawatan/insiden, bukan sehari-hari.
 */
async function setGlobalEnabled(config, userId, env, enabled) {
    if (enabled) await assertAutopublishReady(config, env);

    const rows = await supabaseRequest(config, tablePath("social_publisher_config", "on_conflict=id&select=id,global_enabled,updated_at"), {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ id: true, global_enabled: enabled, updated_by: userId, updated_at: new Date().toISOString() })
    });
    return rows?.[0] || { id: true, global_enabled: enabled };
}

async function handlePost(req, res, config, userId, env, action, profile = null) {
    if (action !== "studio-access-status" && !action.startsWith("studio-admin-")) {
        await ensureStudioAccess(config, userId);
    }
    if (action === "upload-reference") return uploadReference(req, res, config, userId);
    if (action === "replace-reference") return replaceReference(req, res, config, userId);
    if (action === "upload-outfit") return uploadOutfit(req, res, config, userId);
    if (action === "replace-outfit-photo") return replaceOutfitPhoto(req, res, config, userId);
    if (action === "upload-song") return uploadFacebookSongAudio(req, res, config, userId);
    if (action === "manual-publish") return await publishManualPost(req, res, config, userId, env);
    if (action === "check-page") {
        return json(res, 200, { success: true, ...(await checkPageConnection(config, userId, env, req.body && typeof req.body === "object" ? req.body : {})) });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (action === "manual-generate") {
        const preview = await generateManualPost(config, userId, env, body);
        return json(res, 200, { success: true, preview });
    }
    if (action === "manual-discard") {
        const discarded = await discardManualPost(config, userId, body);
        return json(res, 200, { success: true, discarded });
    }
    if (action === "cancel-run") {
        const cancelled = await cancelPostRun(config, userId, body);
        return json(res, 200, { success: true, cancelled });
    }
    if (action === "save-posting-settings") {
        const postingSettings = await savePostingSettings(config, userId, body);
        return json(res, 200, { success: true, postingSettings });
    }
    if (action === "studio-admin-save") {
        const access = await saveStudioAccess(config, userId, body);
        return json(res, 200, { success: true, access });
    }
    if (action === "studio-admin-set-post-limit") {
        const targetId = cleanText(body.user_id, 80);
        if (!targetId) return json(res, 400, { success: false, error: "ID user wajib diisi." });
        let postLimit = null;
        if (body.post_limit !== null && body.post_limit !== undefined && body.post_limit !== "") {
            const parsed = Number(body.post_limit);
            if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
                return json(res, 400, { success: false, error: "Batas posting harus bilangan bulat 0–999, atau kosongkan untuk default role." });
            }
            postLimit = parsed;
        }
        const rows = await supabaseRequest(
            config,
            tablePath("profiles", `id=eq.${encodeURIComponent(targetId)}&select=id,email,name,role,status,post_limit`),
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({ post_limit: postLimit })
            }
        );
        if (!rows?.length) return json(res, 404, { success: false, error: "User tidak ditemukan." });
        return json(res, 200, { success: true, profile: rows[0] });
    }
    if (action === "studio-admin-extend") {
        const access = await extendStudioAccess(config, userId, body);
        return json(res, 200, { success: true, access });
    }
    if (action === "studio-admin-stop") {
        const access = await stopStudioAccess(config, userId, body);
        return json(res, 200, { success: true, access });
    }
    if (action === "studio-admin-save-price") {
        const pricing = await saveStudioPricing(config, userId, body);
        return json(res, 200, { success: true, pricing });
    }
    if (action === "studio-admin-image-provider") {
        const settings = await saveSocialImageProvider(config, userId, body, env);
        return json(res, 200, { success: true, settings });
    }
    if (action === "studio-admin-image-provider-test") {
        /*
         * Tes provider Cloudflare: memanggil model gratis `@cf/...` dan (opsional)
         * try-on Pruna, lalu melaporkan error asli tiap model. Dipakai panel admin
         * supaya penyebab kegagalan (binding, kuota Neuron, kredit AI Gateway,
         * model tidak tersedia) langsung terlihat.
         */
        const provider = String(body?.provider || "cloudflare").toLowerCase();
        if (provider === "tencent") {
            /*
             * Tes Tencent: satu gambar berbayar per klik. Foto contoh wajah
             * sungguhan dipakai sebagai referensi supaya jalur identitas ikut
             * diuji, dan error asli Tencent dikembalikan apa adanya.
             */
            const result = await testTencentImageProvider({ env });
            return json(res, 200, { success: true, provider, test: result });
        }
        if (provider === "puter") {
            /*
             * Tes Puter: satu gambar sungguhan per klik yang MEMOTONG kuota
             * akun Puter operator (User-Pays). Foto contoh dipakai sebagai
             * referensi supaya jalur `input_images` ikut teruji.
             */
            const result = await testPuterImageProvider({ env });
            return json(res, 200, { success: true, provider, test: result });
        }
        if (provider === "opus") {
            /*
             * Tes Opus Labs (Product Ad Studio / Opus Video Tools MCP):
             * satu gambar sungguhan per klik yang memotong kredit akun OpusClip
             * operator sendiri. Foto contoh dipakai sebagai referensi supaya
             * alur `import_assets` + `generate_keyframes` ikut teruji.
             */
            const savedSettings = body?.image_model
                ? null
                : await getSocialImageSettings(config, env).catch(() => null);
            const requestedOpusModel = body?.image_model
                ? normalizeOpusImageModel(body.image_model, env)
                : (savedSettings?.opusModel || opusImageModel(env));
            const result = await testOpusImageProvider({ env, imageModel: requestedOpusModel });
            return json(res, 200, { success: true, provider, test: result });
        }
        const includeTryOn = body?.include_try_on === true;
        const result = await testCloudflareImageProvider({ env, includeTryOn });
        return json(res, 200, { success: true, provider: "cloudflare", test: result });
    }
    if (action === "studio-admin-model-quota") {
        const result = await saveModelQuotaSettings(config, body);
        return json(res, 200, { success: true, ...result });
    }
    if (action === "set-autopublish") {
        if (typeof body.enabled !== "boolean") return json(res, 400, { success: false, error: "Nilai enabled harus boolean." });
        const settings = await setUserAutopublish(config, userId, env, body.enabled);
        return json(res, 200, { success: true, autopublishEnabled: settings.autopublish_enabled !== false });
    }
    if (action === "set-global-enabled") {
        requireStudioAdmin(profile);
        if (typeof body.enabled !== "boolean") return json(res, 400, { success: false, error: "Nilai enabled harus boolean." });
        const settings = await setGlobalEnabled(config, userId, env, body.enabled);
        return json(res, 200, { success: true, globalEnabled: settings.global_enabled === true });
    }
    if (action === "save-character") {
        return json(res, 200, { success: true, character: await saveCharacter(config, userId, body) });
    }
    if (action === "delete-character") {
        return json(res, 200, { success: true, ...(await deleteCharacter(config, userId, body)) });
    }
    if (action === "save-outfit") {
        return json(res, 200, { success: true, outfit: await saveOutfit(config, userId, body) });
    }
    if (action === "delete-outfit") {
        return json(res, 200, { success: true, ...(await deleteOutfit(config, userId, body)) });
    }
    if (action === "save-song") {
        return json(res, 200, { success: true, song: await saveFacebookSong(config, userId, body) });
    }
    if (action === "delete-song") {
        return json(res, 200, { success: true, ...(await deleteFacebookSong(config, userId, body)) });
    }
    if (action === "seed-default-songs") {
        return json(res, 200, { success: true, ...(await seedDefaultFacebookSongs(config, userId)) });
    }
    if (action === "save-schedule") {
        return json(res, 200, { success: true, schedule: await saveSchedule(config, userId, body, profile) });
    }
    if (action === "set-schedule-autopublish") {
        const id = cleanText(body.id, 80);
        if (!id) return json(res, 400, { success: false, error: "ID jadwal wajib diisi." });
        if (typeof body.enabled !== "boolean") return json(res, 400, { success: false, error: "Nilai enabled harus boolean." });
        const rows = await supabaseRequest(
            config,
            tablePath("social_post_schedules", `id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=${SCHEDULE_COLUMNS}`),
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({ autopublish_enabled: body.enabled, updated_at: new Date().toISOString() })
            }
        ).catch(rethrowMissingScheduleSceneSchema);
        if (!rows?.length) return json(res, 404, { success: false, error: "Jadwal tidak ditemukan." });
        return json(res, 200, { success: true, schedule: rows[0] });
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

async function handleGet(req, res, config, userId, env, action, profile = null) {
    if (action === "studio-access-status") {
        const access = await getStudioAccessStatus(config, userId);
        return json(res, 200, { success: true, access });
    }
    if (action === "studio-pricing") {
        return json(res, 200, { success: true, pricing: await getStudioPricing(config) });
    }
    if (action === "studio-admin-users") {
        return json(res, 200, { success: true, users: await listStudioUsers(config) });
    }
    if (action === "studio-admin-image-provider") {
        const [imageSettings, quotasByModel] = await Promise.all([
            getSocialImageSettings(config, env),
            getModelQuotas(config)
        ]);
        const imageProvider = imageSettings.provider;
        const imageModel = imageSettings.imageModel;
        const quoteLlmModel = imageSettings.quoteLlmModel;
        const captionProvider = imageSettings.textProvider === "auto"
            ? (Boolean(envValue(env, "TENCENT_TOKENHUB_KEY") || envValue(env, "TENCENT_API_KEY"))
                ? "tencent"
                : ["cloudflare", "gemini", "qwencloud"].includes(imageProvider)
                    ? imageProvider
                    : (typeof env?.AI?.run === "function" ? "cloudflare" : "tencent"))
            : imageSettings.textProvider;
        return json(res, 200, {
            success: true,
            settings: {
                image_provider: imageProvider,
                text_provider: imageSettings.textProvider,
                caption_provider: captionProvider,
                image_model: imageModel,
                quote_llm_model: quoteLlmModel,
                qwencloud_models: quotaSummaryRows(quotasByModel),
                qwencloud_llm_models: llmQuotaSummaryRows(quotasByModel),
                gemini_configured: Boolean(envValue(env, "GEMINI_API_KEY")),
        tencent_configured: Boolean(envValue(env, "TENCENT_TOKENHUB_KEY") || envValue(env, "TENCENT_API_KEY")),
                cloudflare_configured: typeof env?.AI?.run === "function",
                cloudflare_identity_model: "@cf/black-forest-labs/flux-2-klein-4b",
                cloudflare_free_model: "@cf/black-forest-labs/flux-1-schnell",
                cloudflare_img2img_model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
                cloudflare_tryon_model: "pruna/p-image-try-on",
                cloudflare_tryon_needs_credits: true,
                qwencloud_configured: Boolean(envValue(env, "QWENCLOUD_API_KEY")),
                puter_configured: Boolean(envValue(env, "PUTER_AUTH_TOKEN")),
                puter_model: String(envValue(env, "PUTER_IMAGE_MODEL") || "gemini-3.1-flash-image"),
                opus_configured: opusConfigured(env),
                opus_model: imageSettings.opusModel || opusImageModel(env),
                opus_models: OPUS_IMAGE_MODELS,
                opus_max_reference_images: OPUS_MAX_REFERENCE_IMAGES,
                opus_aspect_ratio: OPUS_DEFAULT_ASPECT_RATIO,
                opus_quality: OPUS_DEFAULT_IMAGE_QUALITY
            }
        });
    }
    if (action !== "oauth-start" && action !== "studio-pricing") {
        await ensureStudioAccess(config, userId);
    }
    if (action === "dashboard") {
        return json(res, 200, await getDashboard(config, userId, env, profile, {
            page: getQuery(req, "runs_page") || getQuery(req, "page"),
            perPage: getQuery(req, "runs_limit") || getQuery(req, "limit")
        }));
    }
    if (action === "runs") {
        const result = await listRunsForDashboard(config, userId, {
            page: getQuery(req, "page") || getQuery(req, "runs_page"),
            perPage: getQuery(req, "limit") || getQuery(req, "per_page") || getQuery(req, "runs_limit")
        });
        return json(res, 200, {
            success: true,
            runs: result.runs,
            runsPagination: result.pagination
        });
    }
    if (action === "outfits") {
        const characterId = cleanText(getQuery(req, "character_id"), 80);
        const { outfits, ready } = await listOutfitsForDashboard(config, userId);
        return json(res, 200, {
            success: true,
            outfitLibraryReady: ready,
            outfits: characterId ? outfits.filter(outfit => outfit.character_id === characterId) : outfits
        });
    }
    if (action === "songs") {
        const { songs, ready } = await listFacebookSongsForUser(config, userId);
        return json(res, 200, {
            success: true,
            songLibraryReady: ready,
            songs,
            defaultSongs: DEFAULT_FACEBOOK_SONGS
        });
    }
    if (action === "song-audio") {
        const sendAudioBytes = (rawBytes, contentType, cacheControl) => {
            const audioBytes = rawBytes instanceof Uint8Array
                ? rawBytes
                : new Uint8Array(rawBytes.buffer || rawBytes, rawBytes.byteOffset || 0, rawBytes.byteLength ?? rawBytes.length ?? 0);
            const total = audioBytes.byteLength;
            res.setHeader("Content-Type", contentType);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cache-Control", cacheControl);

            const rangeHeader = String(getHeader(req, "range") || "").trim();
            const rangeMatch = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
            if (rangeMatch && total > 0) {
                let start = rangeMatch[1] !== "" ? Number(rangeMatch[1]) : 0;
                let end = rangeMatch[2] !== "" ? Number(rangeMatch[2]) : total - 1;
                if (rangeMatch[1] === "" && rangeMatch[2] !== "") {
                    const suffixLen = Number(rangeMatch[2]);
                    start = Math.max(0, total - suffixLen);
                    end = total - 1;
                }
                if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= total || end < start) {
                    res.setHeader("Content-Range", `bytes */${total}`);
                    return res.status(416).end();
                }
                end = Math.min(end, total - 1);
                const slice = audioBytes.subarray(start, end + 1);
                res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
                res.setHeader("Content-Length", String(slice.byteLength));
                return res.status(206).end(slice);
            }

            res.setHeader("Content-Length", String(total));
            return res.status(200).end(audioBytes);
        };

        const id = cleanText(getQuery(req, "id"), 80);
        const slug = cleanText(getQuery(req, "slug"), 80);
        if (slug) {
            const builtin = findBuiltinStorySong(slug);
            if (!builtin) return json(res, 404, { success: false, error: "Musik bawaan tidak ditemukan." });
            const bytes = await loadBuiltinStoryAudio(env, builtin.audio_object_key);
            if (!bytes?.length) return json(res, 404, { success: false, error: "File musik bawaan tidak ditemukan." });
            return sendAudioBytes(bytes, builtin.audio_mime_type || "audio/mp4", "private, max-age=3600");
        }
        if (!id) return json(res, 400, { success: false, error: "ID lagu wajib diisi." });
        const rows = await supabaseRequest(
            config,
            tablePath("social_facebook_songs", `select=audio_object_key,audio_mime_type&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`)
        );
        const song = rows?.[0];
        if (!song || !song.audio_object_key) {
            return json(res, 404, { success: false, error: "File audio lagu tidak ditemukan." });
        }
        let bytes;
        let mimeType = song.audio_mime_type || "";
        const keyStr = String(song.audio_object_key);
        if (!mimeType) {
            if (/\.mp3$/i.test(keyStr)) mimeType = "audio/mpeg";
            else if (/\.aac$/i.test(keyStr)) mimeType = "audio/aac";
            else if (/\.mp4$/i.test(keyStr)) mimeType = "video/mp4";
            else mimeType = "audio/mp4";
        }
        if (keyStr.startsWith("builtin:")) {
            const builtin = findBuiltinStorySong(keyStr);
            bytes = await loadBuiltinStoryAudio(env, keyStr);
            mimeType = builtin?.audio_mime_type || mimeType;
        } else {
            try {
                bytes = await downloadStoryAudioObject(config, keyStr);
            } catch (error) {
                if (error?.status === 404) return json(res, 404, { success: false, error: "File audio tidak tersedia di Supabase Storage." });
                throw error;
            }
        }
        if (!bytes?.length) return json(res, 404, { success: false, error: "File audio kosong." });
        return sendAudioBytes(bytes, mimeType, "private, no-store");
    }
    if (action === "oauth-start") {
        return json(res, 200, { success: true, ...(await startOAuth(config, userId, env, res)) });
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
    if (action === "outfit") {
        const id = cleanText(getQuery(req, "outfit_id"), 80);
        if (!id) return json(res, 400, { success: false, error: "ID outfit wajib diisi." });
        const rows = await supabaseRequest(config, tablePath("social_outfits", `select=object_key,mime_type&id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`));
        const outfit = rows?.[0];
        if (!outfit) return json(res, 404, { success: false, error: "Outfit tidak ditemukan." });
        if (!await isPrivateReferenceBucket(config)) {
            return json(res, 503, { success: false, error: "Bucket privat Supabase Storage belum tersedia." });
        }
        let bytes;
        try {
            bytes = await downloadReferenceObject(config, outfit.object_key);
        } catch (error) {
            if (error?.status === 404) return json(res, 404, { success: false, error: "File outfit tidak tersedia di Supabase Storage." });
            throw error;
        }
        res.setHeader("Content-Type", outfit.mime_type || "application/octet-stream");
        res.setHeader("Content-Length", String(bytes.length));
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).end(bytes);
    }
    return json(res, 404, { success: false, error: "Action tidak dikenal." });
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name, X-Character-Name, X-Character-Consent, X-Character-Adult, X-Garment-Rights, X-Outfit-Name, X-Outfit-Order-Url, X-Outfit-Notes, X-Outfit-Rights, X-Manual-Run-Id, X-Quote-Target, X-Song-Title, X-Song-Artist, X-Song-Mood");
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
        res.setHeader(
            "Set-Cookie",
            `${OAUTH_STATE_COOKIE}=; Path=${OAUTH_STATE_COOKIE_PATH}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`
        );
        return handleOAuthCallback(req, res, env);
    }
    if (req.method !== "GET" && req.method !== "POST") {
        return json(res, 405, { success: false, error: "Method tidak didukung." });
    }

    try {
        const { config, userId, profile } = await verifyAdmin(req, env);
        if (action.startsWith("studio-admin-")) {
            requireStudioAdmin(profile);
        }
        if (req.method === "GET") return await handleGet(req, res, config, userId, env, action, profile);
        return await handlePost(req, res, config, userId, env, action, profile);
    } catch (rawError) {
        const error = migrationError(rawError);
        /*
         * `status === 503` dengan `error.message` kosong dulu menghasilkan
         * `{"success":false}` tanpa `error`, sehingga klien hanya bisa
         * menampilkan "Permintaan gagal (HTTP 503)". Pesan sekarang selalu ada.
         */
        const { status, message, missingMessage } = describeApiFailure(error, 500);
        const payload = { success: false, error: message };
        if (error?.code) payload.code = String(error.code);
        if (error?.retrySafe === false) payload.retry_safe = false;
        if (error?.needsReconnect === true) payload.needs_reconnect = true;
        if (missingMessage || status >= 500) {
            console.error("Social Publisher API error:", status, loggableErrorDetails(error));
        }
        return json(res, status, payload);
    }
}
