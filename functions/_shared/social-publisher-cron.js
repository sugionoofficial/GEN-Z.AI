import { applyOutfitToScene, buildImagePrompt, composeSocialCaption, createScenePlan, pickRandomOutfit, renderCaption, sceneOverridesFromSchedule } from "../../lib/social-publisher/utils.js";
import { buildQuoteImagePrompt, createQuotePlan, normalizeQuotePublishTarget, normalizeSocialPostMode, pickRandomFacebookSong, quoteOverridesFromSchedule } from "../../lib/social-publisher/quotes.js";
import { decryptSecret, normalizeTextProvider, generateSocialContextCaption, generateSocialImage, generateSocialQuote, generateSocialQuoteImage, makeProfileShareUrl, publishFacebookPhoto, publishFacebookQuoteVideo } from "../../lib/social-publisher/providers.js";
import { createSignedReferenceUrl, downloadModelReference, downloadReferenceObject, isPrivateReferenceBucket, resolveStorySongAudioBytes } from "../../lib/social-publisher/storage.js";
import { encodeStoryMp4, maxQuoteVideoDurationForTarget, renderQuoteStoryCard } from "../../lib/social-publisher/story-video.js";
import { normalizeQwenCloudImageModel, normalizeQwenCloudLlmModel, recordModelUsage } from "../../lib/social-publisher/quotas.js";
import { normalizeOpusImageModel, resolveOpusAspectRatio } from "../../lib/social-publisher/opus.js";
import { stripImageMetadataBytes } from "../../metadata-cleaner/assets/js/metadata-cleaner-image.js";

function value(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

function getConfig(env) {
    return {
        url: value(env, "SUPABASE_URL").replace(/\/+$/, ""),
        serviceRoleKey: value(env, "SUPABASE_SERVICE_ROLE_KEY")
    };
}

async function dbRequest(config, path, options = {}) {
    if (!config.url || !config.serviceRoleKey) throw new Error("Supabase server configuration is missing.");
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
        try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    if (!response.ok) {
        const error = new Error(String(data?.message || data?.error_description || `Supabase HTTP ${response.status}`).slice(0, 500));
        error.status = response.status;
        error.code = String(data?.code || "");
        throw error;
    }
    return data;
}

function table(tableName, query = "") {
    return `/rest/v1/${tableName}${query ? `?${query}` : ""}`;
}

async function updateRun(config, runId, values) {
    try {
        await dbRequest(config, table("social_post_runs", `id=eq.${encodeURIComponent(runId)}`), {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(values)
        });
    } catch (error) {
        if (!isMissingQuoteRunColumn(error) || !hasQuoteOrSongRunFields(values)) throw error;
        const fallbackValues = { ...values };
        for (const key of ["post_mode", "quote_text", "quote_theme", "quote_publish_target", "song_id", "song_title", "song_artist", "song_facebook_url"]) {
            delete fallbackValues[key];
        }
        await dbRequest(config, table("social_post_runs", `id=eq.${encodeURIComponent(runId)}`), {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(fallbackValues)
        });
    }
}

function hasQuoteOrSongRunFields(values = {}) {
    return ["post_mode", "quote_text", "quote_theme", "quote_publish_target", "song_id", "song_title", "song_artist", "song_facebook_url"]
        .some(key => Object.prototype.hasOwnProperty.call(values, key));
}

function isMissingQuoteRunColumn(error) {
    if (error?.code === "PGRST204" || error?.code === "42703") {
        return /(post_mode|quote_text|quote_theme|quote_publish_target|song_id|song_title|song_artist|song_facebook_url)/i.test(String(error?.message || ""));
    }
    return /(post_mode|quote_text|quote_theme|quote_publish_target|song_id|song_title|song_artist|song_facebook_url)/i.test(String(error?.message || ""))
        && /does not exist|schema cache|column/i.test(String(error?.message || ""));
}

const SUBSCRIPTION_INACTIVE_REASON = "subscription_inactive";

const LEGACY_SCHEDULE_COLUMNS = "id,owner_id,character_id,page_connection_id,enabled,interval_hours,aspect_ratio,caption_template,timezone";
const SCENE_SCHEDULE_COLUMNS = `${LEGACY_SCHEDULE_COLUMNS},autopublish_enabled,scene_location,camera_angle,scene_situation,scene_lighting,scene_atmosphere,scene_condition,scene_details,negative_prompt`;
const QUOTE_BASE_SCHEDULE_COLUMNS = `${SCENE_SCHEDULE_COLUMNS},post_mode,quote_theme,quote_visual_style,use_random_song`;
const FULL_SCHEDULE_COLUMNS = `${QUOTE_BASE_SCHEDULE_COLUMNS},quote_publish_target`;

function isMissingColumnError(error) {
    const message = String(error?.message || "");
    return /does not exist|schema cache|column/i.test(message);
}

function isMissingQuoteTargetColumn(error) {
    const message = String(error?.message || "");
    return /\bquote_publish_target\b/i.test(message) && isMissingColumnError(error);
}

function isMissingQuoteScheduleColumn(error) {
    const message = String(error?.message || "");
    return /\b(post_mode|quote_theme|quote_visual_style|use_random_song|quote_publish_target)\b/i.test(message)
        && isMissingColumnError(error);
}

/**
 * Baris jadwal dengan kolom baru. Bila migration kolom quote/scene belum dijalankan,
 * pakai kolom lama supaya autopost tetap berjalan dengan parameter otomatis.
 */
async function getScheduleForRun(config, scheduleId) {
    try {
        const rows = await dbRequest(config, table(
            "social_post_schedules",
            `select=${FULL_SCHEDULE_COLUMNS}&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
        ));
        return rows?.[0] || null;
    } catch (error) {
        if (!isMissingColumnError(error)) throw error;
        if (isMissingQuoteTargetColumn(error)) {
            try {
                const rows = await dbRequest(config, table(
                    "social_post_schedules",
                    `select=${QUOTE_BASE_SCHEDULE_COLUMNS}&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
                ));
                return rows?.[0] || null;
            } catch (quoteBaseError) {
                if (!isMissingColumnError(quoteBaseError)) throw quoteBaseError;
            }
        }
        if (isMissingQuoteScheduleColumn(error)) {
            console.warn("[Social Publisher] Kolom quote/musik jadwal belum ada; memakai kolom scene.");
            try {
                const rows = await dbRequest(config, table(
                    "social_post_schedules",
                    `select=${SCENE_SCHEDULE_COLUMNS}&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
                ));
                return rows?.[0] || null;
            } catch (sceneError) {
                if (!isMissingColumnError(sceneError)) throw sceneError;
            }
        }
        console.warn("[Social Publisher] Kolom scene jadwal belum ada; memakai kolom lama.");
        const rows = await dbRequest(config, table(
            "social_post_schedules",
            `select=${LEGACY_SCHEDULE_COLUMNS}&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
        ));
        return rows?.[0] || null;
    }
}

/** Pengaturan akun; kolom autopublish_enabled opsional pada database lama. */
async function getUserSettingsRow(config, ownerId) {
    try {
        const rows = await dbRequest(config, table(
            "social_publisher_user_settings",
            `select=caption_template,external_link,autopublish_enabled&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`
        ));
        return rows;
    } catch (error) {
        if (!isMissingColumnError(error)) throw error;
        console.warn("[Social Publisher] Kolom autopublish_enabled belum ada; autopublish akun dianggap aktif.");
        return await dbRequest(config, table(
            "social_publisher_user_settings",
            `select=caption_template,external_link&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`
        ));
    }
}

function isMissingStudioAccessSchema(error) {
    if (error?.code === "PGRST205" || error?.code === "42P01") return true;
    const message = String(error?.message || "");
    return /studio_medsos_access/i.test(message) && /does not exist|schema cache|relation/i.test(message);
}

function isMissingSchedulePausedReason(error) {
    if (error?.code === "PGRST204" || error?.code === "42703") return true;
    return /paused_reason/i.test(String(error?.message || ""));
}

function formatJakartaDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "tanggal tidak diketahui";
    return date.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

/**
 * Auto publish hanya boleh berjalan selama langganan Studio Medsos user aktif.
 * Nilai `active: false` berarti siklus ini harus dihentikan.
 * `unknown: true` dipakai untuk database lama yang belum punya tabel
 * studio_medsos_access supaya autopublish tidak ikut mati.
 */
async function getSubscriptionState(config, ownerId, nowMs = Date.now()) {
    let access = null;
    try {
        const rows = await dbRequest(config, table(
            "studio_medsos_access",
            `select=user_id,is_active,started_at,expires_at&user_id=eq.${encodeURIComponent(ownerId)}&limit=1`
        ));
        access = rows?.[0] || null;
    } catch (error) {
        if (!isMissingStudioAccessSchema(error)) throw error;
        console.warn("[Social Publisher] studio_medsos_access belum tersedia; cek langganan dilewati.");
        return { active: true, unknown: true, reason: "unknown", expiresAt: null };
    }

    const startedAt = Date.parse(access?.started_at || "");
    const expiresAt = Date.parse(access?.expires_at || "");
    const hasAccess = access?.is_active === true &&
        Number.isFinite(startedAt) && startedAt <= nowMs &&
        Number.isFinite(expiresAt) && expiresAt > nowMs;

    if (hasAccess) return { active: true, unknown: false, reason: "active", expiresAt };

    let reason = "inactive";
    if (!access) reason = "missing";
    else if (Number.isFinite(expiresAt) && expiresAt <= nowMs) reason = "expired";
    else if (access.is_active === true && Number.isFinite(startedAt) && startedAt > nowMs) reason = "pending";

    return { active: false, unknown: false, reason, expiresAt: Number.isFinite(expiresAt) ? expiresAt : null };
}

function buildSubscriptionStopMessage(state) {
    if (state.reason === "expired") {
        return `Langganan Studio Medsos berakhir pada ${formatJakartaDate(state.expiresAt)}. Auto publish dijeda otomatis — perpanjang masa aktif lalu aktifkan kembali jadwal ini.`;
    }
    if (state.reason === "pending") {
        return "Masa aktif langganan Studio Medsos belum dimulai. Auto publish dijeda otomatis sampai tanggal mulai langganan tiba.";
    }
    if (state.reason === "missing") {
        return "Akun ini belum memiliki langganan Studio Medsos. Auto publish dijeda otomatis — aktifkan langganan lalu jalankan kembali jadwal ini.";
    }
    return "Langganan Studio Medsos sedang tidak aktif. Auto publish dijeda otomatis — aktifkan langganan lalu jalankan kembali jadwal ini.";
}

/**
 * Jeda jadwal saat langganan tidak aktif. `paused_reason` dipakai admin panel
 * untuk mengaktifkan kembali jadwal otomatis ketika langganan diperpanjang.
 * Kolomnya opsional supaya deployment lama tetap jalan.
 */
async function pauseScheduleForSubscription(config, scheduleId, message) {
    const body = {
        enabled: false,
        paused_reason: SUBSCRIPTION_INACTIVE_REASON,
        updated_at: new Date().toISOString()
    };
    try {
        await dbRequest(config, table("social_post_schedules", `id=eq.${encodeURIComponent(scheduleId)}`), {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(body)
        });
        return;
    } catch (error) {
        if (!isMissingSchedulePausedReason(error)) throw error;
    }
    await dbRequest(config, table("social_post_schedules", `id=eq.${encodeURIComponent(scheduleId)}`), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ enabled: false, updated_at: body.updated_at })
    });
    console.warn(`[Social Publisher] Schedule ${scheduleId} paused without paused_reason (${message.slice(0, 80)}).`);
}

function isMissingOutfitSchema(error) {
    if (error?.code === "PGRST205" || error?.code === "42P01") return true;
    const message = String(error?.message || "");
    return /social_outfits/i.test(message) && /does not exist|schema cache|relation/i.test(message);
}

function isMissingSongSchema(error) {
    if (error?.code === "PGRST205" || error?.code === "42P01") return true;
    const message = String(error?.message || "");
    return /social_facebook_songs/i.test(message) && /does not exist|schema cache|relation/i.test(message);
}

function isMissingRunOutfitColumn(error) {
    if (error?.code === "PGRST204" || error?.code === "42703") return true;
    return /outfit_id|quote_text|song_id|column .* does not exist/i.test(String(error?.message || ""));
}

/**
 * Recent posted runs are used to avoid repeating a composition, outfit, quote, or song.
 * Deployments that have not run newer migrations still fall back to scene-only history.
 */
async function listRecentPostedRuns(config, scheduleId, includeQuoteMusic = false) {
    const base = `select=scene_plan&schedule_id=eq.${encodeURIComponent(scheduleId)}&status=eq.posted&order=created_at.desc&limit=12`;
    const columns = includeQuoteMusic
        ? "scene_plan,quote_text,song_id,song_title,song_artist"
        : "scene_plan,outfit_id";
    try {
        return await dbRequest(config, table("social_post_runs", `select=${columns}&schedule_id=eq.${encodeURIComponent(scheduleId)}&status=eq.posted&order=created_at.desc&limit=12`));
    } catch (error) {
        if (!isMissingRunOutfitColumn(error)) throw error;
        return await dbRequest(config, table("social_post_runs", base));
    }
}

/**
 * Loads the character's active outfit library and picks one at random, skipping
 * outfits used by the latest posts of this schedule when possible.
 */
async function pickScheduledOutfit(config, schedule, previousRuns) {
    let outfits;
    try {
        outfits = await dbRequest(config, table(
            "social_outfits",
            `select=id,character_id,name,object_key,mime_type,order_url,notes,is_active,created_at&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&character_id=eq.${encodeURIComponent(schedule.character_id)}&is_active=eq.true&order=created_at.desc`
        ));
    } catch (error) {
        if (isMissingOutfitSchema(error)) return { outfit: null, ready: false };
        throw error;
    }
    if (!Array.isArray(outfits) || !outfits.length) return { outfit: null, ready: true };
    const recentOutfitIds = (previousRuns || []).map(run => run.outfit_id).filter(Boolean);
    return { outfit: pickRandomOutfit(outfits, recentOutfitIds), ready: true };
}

/**
 * Loads active Facebook songs saved by the account (or falls back to the built-in
 * curated popular Facebook songs list when none are saved yet) and picks one at random,
 * avoiding songs used by recent posts.
 */
async function pickScheduledFacebookSong(config, ownerId, previousRuns = [], { requirePlayableAudio = false } = {}) {
    let songs = [];
    try {
        songs = await dbRequest(config, table(
            "social_facebook_songs",
            `select=id,title,artist,facebook_url,mood,audio_object_key,audio_mime_type,duration_seconds,is_active,created_at&owner_id=eq.${encodeURIComponent(ownerId)}&is_active=eq.true&order=created_at.desc`
        ));
    } catch (error) {
        if (isMissingColumnError(error) && !isMissingSongSchema(error)) {
            songs = await dbRequest(config, table(
                "social_facebook_songs",
                `select=id,title,artist,facebook_url,mood,is_active,created_at&owner_id=eq.${encodeURIComponent(ownerId)}&is_active=eq.true&order=created_at.desc`
            ));
        } else if (isMissingSongSchema(error)) {
            songs = [];
        } else {
            throw error;
        }
    }
    const recentSongs = (previousRuns || [])
        .map(run => ({
            id: run.song_id || run.scene_plan?.song_id || null,
            title: run.song_title || run.scene_plan?.song_title || "",
            artist: run.song_artist || run.scene_plan?.song_artist || ""
        }))
        .filter(item => item.id || item.title);
    return pickRandomFacebookSong(songs, recentSongs, Math.random, {
        fallbackToDefaults: true,
        requirePlayableAudio
    });
}

function cleanError(error) {
    const message = String(error?.message || "Unknown social publishing error");
    return message
        .replace(/(access_token|api[_-]?key)=?[^&\s]+/gi, "$1=[redacted]")
        .slice(0, 1000);
}

async function processRun(env, config, claimedRun) {
    const runId = claimedRun.run_id;
    const scheduleId = claimedRun.schedule_id;
    const now = new Date().toISOString();
    let imageProvider = "gemini";
    let imageModel = "";

    try {
        await updateRun(config, runId, { status: "generating", started_at: now });
        const schedule = await getScheduleForRun(config, scheduleId);
        if (!schedule) throw new Error("Schedule was removed or disabled before processing.");

        /* Switch autopublish milik blok jadwal ini. RPC claim sudah menyaringnya;
           guard ini menjaga run yang terklaim sebelum migration dijalankan. */
        if (schedule.autopublish_enabled === false) {
            const message = "Autopublish untuk jadwal ini sedang dimatikan. Aktifkan lagi pada blok jadwal di Studio Medsos untuk melanjutkan autopost.";
            console.warn(`[Social Publisher] Run ${runId} skipped: ${message}`);
            await updateRun(config, runId, {
                status: "failed",
                error_message: message,
                finished_at: new Date().toISOString()
            });
            return;
        }

        /* Auto publish wajib berhenti ketika masa aktif langganan habis. */
        const subscription = await getSubscriptionState(config, schedule.owner_id, Date.now());
        if (!subscription.active) {
            const message = buildSubscriptionStopMessage(subscription);
            console.warn(`[Social Publisher] Run ${runId} stopped: ${message}`);
            await pauseScheduleForSubscription(config, schedule.id, message).catch(pauseError => {
                console.error(`[Social Publisher] Could not pause schedule ${scheduleId}: ${pauseError?.message || "unknown error"}`);
            });
            await updateRun(config, runId, {
                status: "failed",
                error_message: message,
                finished_at: new Date().toISOString()
            });
            return;
        }

        const postMode = normalizeSocialPostMode(schedule.post_mode);
        const shouldUseRandomSong = postMode === "quote"
            ? schedule.use_random_song !== false
            : schedule.use_random_song === true;

        const [characters, pageConnections, previousRuns, settingsRows, publisherConfigs] = await Promise.all([
            postMode === "quote"
                ? Promise.resolve([])
                : dbRequest(config, table("social_characters", `select=id,owner_id,display_name,reference_object_key,reference_mime_type,prompt_notes&id=eq.${encodeURIComponent(schedule.character_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_page_connections", `select=id,owner_id,page_id,page_name,can_publish,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(schedule.page_connection_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            listRecentPostedRuns(config, schedule.id, postMode === "quote" || shouldUseRandomSong),
            getUserSettingsRow(config, schedule.owner_id),
            dbRequest(config, table("social_publisher_config", "select=image_provider,image_model,text_provider,quote_llm_model&id=eq.true&limit=1"))
                .catch(() => dbRequest(config, table("social_publisher_config", "select=image_provider,image_model,quote_llm_model&id=eq.true&limit=1"))
                    .catch(() => dbRequest(config, table("social_publisher_config", "select=image_provider,image_model&id=eq.true&limit=1"))))
        ]);
        /* Switch autopublish milik user. RPC claim sudah menyaringnya; guard ini
           menjaga run yang terlanjur diklaim sebelum migration dijalankan. */
        if (settingsRows?.[0]?.autopublish_enabled === false) {
            const message = "Autopublish dinonaktifkan oleh pemilik akun Studio Medsos. Aktifkan kembali untuk melanjutkan autopost.";
            console.warn(`[Social Publisher] Run ${runId} skipped: ${message}`);
            await updateRun(config, runId, {
                status: "failed",
                error_message: message,
                finished_at: new Date().toISOString()
            });
            return;
        }

        const page = pageConnections?.[0];
        if (!page) throw new Error("Facebook Page connection was not found; reconnect the Page.");
        if (page.can_publish === false) throw new Error("Facebook Page connection does not have CREATE_CONTENT permission.");

        imageProvider = ["cloudflare", "qwencloud", "tencent", "puter", "opus"].includes(publisherConfigs?.[0]?.image_provider)
            ? publisherConfigs[0].image_provider
            : "gemini";
        const aspectRatio = postMode === "quote"
            ? "9:16"
            : imageProvider === "opus"
                ? resolveOpusAspectRatio(env, schedule.aspect_ratio)
                : (["9:16", "16:9"].includes(schedule.aspect_ratio) ? schedule.aspect_ratio : "9:16");
        imageModel = imageProvider === "opus"
            ? normalizeOpusImageModel(publisherConfigs?.[0]?.image_model, env)
            : normalizeQwenCloudImageModel(publisherConfigs?.[0]?.image_model);
        /* Provider teks terpisah: caption & mutiara boleh dari Tencent (gratis). */
        const textProvider = normalizeTextProvider(publisherConfigs?.[0]?.text_provider);
        const quoteLlmModel = normalizeQwenCloudLlmModel(publisherConfigs?.[0]?.quote_llm_model);
        const settings = settingsRows?.[0];
        const song = shouldUseRandomSong
            ? await pickScheduledFacebookSong(config, schedule.owner_id, previousRuns, {
                requirePlayableAudio: postMode === "quote"
            })
            : null;

        let scenePlanRecord = null;
        let prompt = "";
        let generated = null;
        let cleanedMimeType = "";
        let cleanedBytes = null;
        let storyMp4Bytes = null;
        let caption = "";
        let outfit = null;
        let outfitLibraryReady = false;
        let quoteText = "";
        let quoteThemeLabel = "";
        const quotePublishTarget = normalizeQuotePublishTarget(schedule.quote_publish_target, "feed");

        if (postMode === "quote") {
            const recentPlanKeys = (previousRuns || [])
                .map(item => item.scene_plan?.key)
                .filter(Boolean);
            const recentQuotes = (previousRuns || [])
                .map(item => item.quote_text || item.scene_plan?.quote_text)
                .filter(Boolean);
            const quotePlan = {
                ...createQuotePlan(recentPlanKeys, Math.random, quoteOverridesFromSchedule(schedule)),
                aspect_ratio: "9:16"
            };
            const quoteAiProvider = value(env, "QWENCLOUD_API_KEY") ? "qwencloud" : imageProvider;
            const quoteResult = await generateSocialQuote({
                env,
                quotePlan,
                recentQuotes,
                imageProvider: quoteAiProvider,
                textProvider: value(env, "QWENCLOUD_API_KEY") ? "qwencloud" : textProvider,
                llmModel: quoteLlmModel
            });
            const resolvedQuoteModel = quoteResult.model || quoteLlmModel || "solid-black";
            if (quoteAiProvider === "qwencloud") {
                recordModelUsage(config, resolvedQuoteModel).catch(recordError => {
                    console.error("Could not record QwenCloud LLM usage:", recordError?.message || "unknown error");
                });
            }
            quoteText = quoteResult.quoteText;
            quoteThemeLabel = quotePlan.themeLabel;
            prompt = "solid-black-background (#000000)";
            generated = { model: resolvedQuoteModel };
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
            storyMp4Bytes = encodedStory.mp4Bytes;
            // Postingan Kata-kata Mutiara + Musik memakai latar hitam polos (#000000) tanpa kuota gambar + teks LLM QwenCloud.
            caption = quoteText;
            scenePlanRecord = {
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
        } else {
            const character = characters?.[0];
            if (!character) throw new Error("Character reference was not found.");
            if (!await isPrivateReferenceBucket(config)) throw new Error("Private Supabase Storage reference bucket is not configured.");

            /* Supabase memperkecil gambar lebih dulu agar Worker tidak men-decode
               foto besar di dalam cron (penyebab Error 1102 resource limits).
               Khusus Opus, unduh objek asli tanpa mencoba transformasi 512px agar
               hemat subrequest dan dimensi 300px–6000px terjaga. */
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
            if (!referenceBytes.length || referenceBytes.length > 8 * 1024 * 1024) throw new Error("Reference image size is invalid.");
            const referenceMimeType = referenceSource.mimeType || character.reference_mime_type;

            const recentSceneKeys = (previousRuns || [])
                .map(item => item.scene_plan?.key)
                .filter(Boolean);
            const outfitSelection = await pickScheduledOutfit(config, schedule, previousRuns);
            outfit = outfitSelection.outfit;
            outfitLibraryReady = outfitSelection.ready;
            /* Pakaian hanya dari outfit terpilih; tanpa outfit, pakaian mengikuti
               foto referensi karakter. Tidak ada unggahan pakaian terpisah. */
            const garmentObjectKey = outfit?.object_key || "";
            const garmentMimeType = outfit?.mime_type || "";
            const referenceImageUrl = (imageProvider === "cloudflare" || imageProvider === "opus")
                ? await createSignedReferenceUrl(config, character.reference_object_key)
                : "";
            const opusGarmentUrl = (imageProvider === "opus" && garmentObjectKey)
                ? await createSignedReferenceUrl(config, garmentObjectKey)
                : "";
            /* Cloudflare FLUX.2 klein memakai foto outfit sebagai `input_image_1`. */
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
            /* Parameter detail dari blok jadwal: kolom kosong otomatis diacak,
               angle kosong jatuh ke medium shot. */
            const scene = applyOutfitToScene(
                { ...createScenePlan(recentSceneKeys, Math.random, sceneOverridesFromSchedule(schedule)), aspect_ratio: aspectRatio },
                outfit
            );
            prompt = buildImagePrompt({
                characterName: character.display_name,
                characterNotes: character.prompt_notes,
                scene,
                aspectRatio,
                outfitName: outfit?.name,
                outfitNotes: outfit?.notes,
                hasOutfitReference: Boolean(garmentObjectKey),
                useReferenceOutfit: !garmentObjectKey,
                negativePrompt: schedule.negative_prompt
            });
            generated = await generateSocialImage({
                env,
                prompt,
                referenceBytes,
                referenceMimeType,
                aspectRatio,
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
                    ...(["qwencloud", "opus"].includes(imageProvider) ? { imageModel } : {})
                })
            });
            if (!generated?.bytes?.length) throw new Error("Image provider returned an empty image.");
            if (imageProvider === "qwencloud") {
                recordModelUsage(config, generated.model).catch(recordError => {
                    console.error("Could not record QwenCloud model usage:", recordError?.message || "unknown error");
                });
            }

            const stripped = stripImageMetadataBytes(
                generated.bytes,
                generated.mimeType
            );
            cleanedBytes = stripped.bytes;
            cleanedMimeType = stripped.mimeType;
            const contextualCaption = await generateSocialContextCaption({
                env,
                imageBytes: cleanedBytes,
                imageMimeType: cleanedMimeType,
                characterName: character.display_name,
                scene,
                imageProvider,
                textProvider
            });
            const baseCaption = renderCaption(settings?.caption_template || schedule.caption_template, scene, character.display_name);
            caption = composeSocialCaption({
                baseCaption,
                contextualCaption,
                externalLink: settings?.external_link,
                outfit: outfit ? { id: outfit.id, name: outfit.name, order_url: outfit.order_url || "" } : null,
                song
            });
            scenePlanRecord = song
                ? {
                    ...scene,
                    song_id: song.id || null,
                    song_title: song.title || "",
                    song_artist: song.artist || "",
                    song_facebook_url: song.facebook_url || ""
                }
                : scene;
        }

        const encryptionKey = value(env, "SOCIAL_TOKEN_ENCRYPTION_KEY");
        if (!encryptionKey) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");
        const pageAccessToken = await decryptSecret(
            page.page_token_ciphertext,
            page.page_token_iv,
            encryptionKey
        );
        const published = postMode === "quote"
            ? await publishFacebookQuoteVideo({
                env,
                pageId: page.page_id,
                pageAccessToken,
                videoBytes: storyMp4Bytes,
                target: quotePublishTarget
            })
            : await publishFacebookPhoto({
                env,
                pageId: page.page_id,
                pageAccessToken,
                caption,
                imageBytes: cleanedBytes,
                imageMimeType: cleanedMimeType
            });
        const profileShareUrl = makeProfileShareUrl(published.permalinkUrl);

        await updateRun(config, runId, {
            status: "posted",
            scene_plan: scenePlanRecord,
            generated_prompt: prompt,
            caption,
            image_model: generated.model,
            ...(outfitLibraryReady ? {
                outfit_id: outfit?.id || null,
                outfit_name: outfit?.name || null,
                outfit_order_url: outfit?.order_url || null
            } : {}),
            ...(postMode === "quote" || song ? {
                post_mode: postMode,
                quote_text: quoteText || "",
                quote_theme: quoteThemeLabel || "",
                ...(postMode === "quote" ? { quote_publish_target: quotePublishTarget } : {}),
                song_id: song?.id || null,
                song_title: song?.title || "",
                song_artist: song?.artist || "",
                song_facebook_url: postMode === "quote" ? "" : (song?.facebook_url || "")
            } : {}),
            facebook_photo_id: published.photoId || published.videoId || null,
            facebook_post_id: published.postId || null,
            permalink_url: published.permalinkUrl || null,
            profile_share_url: profileShareUrl || null,
            finished_at: new Date().toISOString(),
            error_message: null
        });
        console.log(`[Social Publisher] Posted run ${runId} to Page ${page.page_id}.`);
    } catch (error) {
        let safeMessage = cleanError(error);
        /* Pesan yang bisa ditindaklanjuti saat migration belum dijalankan. */
        if (/(autopublish_enabled|scene_location|camera_angle|scene_atmosphere|negative_prompt)/i.test(safeMessage)
            && /does not exist|schema cache|column/i.test(safeMessage)) {
            safeMessage = "Kolom jadwal terbaru belum ada di database. Jalankan supabase/social-schedule-autopublish-scene.sql di Supabase SQL Editor, lalu jalankan ulang jadwal ini.";
        }
        console.error(`[Social Publisher] Run ${runId} failed (${error?.code || "error"}): ${safeMessage}`);
        const failedQuotaModel = error?.llmModel
            ? error.llmModel
            : (imageProvider === "qwencloud" && normalizeSocialPostMode(job?.post_mode) !== "quote" ? imageModel : "");
        if (failedQuotaModel && (error?.quotaExhausted === true || error?.status === 429)) {
            recordModelUsage(config, failedQuotaModel, { quotaError: true, message: safeMessage }).catch(recordError => {
                console.error("Could not record QwenCloud quota failure:", recordError?.message || "unknown error");
            });
        }
        await updateRun(config, runId, {
            status: "failed",
            error_message: safeMessage,
            finished_at: new Date().toISOString()
        }).catch(updateError => {
            console.error(`[Social Publisher] Could not record failure for run ${runId}: ${updateError?.message || "unknown error"}`);
        });
    }
}

/*
 * Batas waktu run yang tidak mungkin selesai lagi.
 *
 * Run autopost hanya boleh dilanjutkan `claim_stuck_social_post_runs` selama 30
 * menit sejak dibuat; setelah itu run tersebut yatim dan dulu tertinggal
 * "generating" selamanya di riwayat. Pratinjau manual menyimpan byte gambar
 * hanya di browser, jadi begitu halaman di-refresh pratinjaunya mustahil
 * diterbitkan — baris itu juga harus ditutup, bukan menunggu selamanya.
 */
const AUTO_ABANDONED_TTL_MS = 30 * 60 * 1000;
/*
 * Pratinjau manual dibagi dua: yang belum punya caption berarti proses
 * generate-nya mati di tengah jalan (mis. Error 1102) dan bisa ditutup cepat;
 * yang sudah punya caption memang menunggu keputusan pengguna, jadi diberi
 * waktu jauh lebih panjang.
 */
const MANUAL_STALLED_TTL_MS = 15 * 60 * 1000;
const MANUAL_PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Tutup run yang sudah tidak mungkin diselesaikan lagi.
 *
 * Filter memakai kolom waktu yang benar untuk tiap jenis: autopost memakai
 * `started_at` (diperbarui setiap kali run diklaim/dilanjutkan) supaya run yang
 * baru dilanjutkan tidak ikut tersapu, sedangkan pratinjau manual memakai
 * `created_at` karena tidak punya mekanisme lanjut.
 */
async function failAbandonedRuns(config, now, { filter, message, label }) {
    try {
        const rows = await dbRequest(
            config,
            table("social_post_runs", `${filter}&select=id`),
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    status: "failed",
                    error_message: message,
                    finished_at: new Date(now).toISOString()
                })
            }
        );
        const failed = Array.isArray(rows) ? rows.length : 0;
        if (failed) {
            console.warn(`[Social Publisher] ${failed} run ${label} yang menggantung ditandai gagal.`);
        }
        return failed;
    } catch (error) {
        console.warn(`[Social Publisher] Sapuan run ${label} dilewati:`, error?.message || "unknown error");
        return 0;
    }
}

async function sweepAbandonedRuns(config, now) {
    const nowMs = new Date(now).getTime();
    const autoThreshold = new Date(nowMs - AUTO_ABANDONED_TTL_MS).toISOString();

    const autoMessage = "Proses autopost tidak selesai dan tidak dapat dilanjutkan lagi (di luar jendela 30 menit). Jadwal berikutnya tetap berjalan sesuai interval.";
    const autoGenerating = await failAbandonedRuns(config, now, {
        filter: `status=eq.generating&schedule_id=not.is.null&started_at=lt.${encodeURIComponent(autoThreshold)}`,
        message: autoMessage,
        label: "autopost"
    });
    const autoQueued = await failAbandonedRuns(config, now, {
        filter: `status=eq.queued&schedule_id=not.is.null&created_at=lt.${encodeURIComponent(autoThreshold)}`,
        message: autoMessage,
        label: "autopost"
    });
    const stalledThreshold = new Date(nowMs - MANUAL_STALLED_TTL_MS).toISOString();
    const manualPreviewThreshold = new Date(nowMs - MANUAL_PREVIEW_TTL_MS).toISOString();

    const manualStalled = await failAbandonedRuns(config, now, {
        filter: `status=eq.generating&schedule_id=is.null&caption=is.null&created_at=lt.${encodeURIComponent(stalledThreshold)}`,
        message: "Pembuatan pratinjau manual tidak selesai (permintaan terputus, biasanya karena Worker kehabisan resource). Silakan buat pratinjau baru.",
        label: "manual"
    });
    const manualPreview = await failAbandonedRuns(config, now, {
        filter: `status=eq.generating&schedule_id=is.null&caption=not.is.null&created_at=lt.${encodeURIComponent(manualPreviewThreshold)}`,
        message: "Pratinjau manual kedaluwarsa karena tidak diterbitkan maupun dibuang. Buat pratinjau baru.",
        label: "manual"
    });
    return { auto: autoGenerating + autoQueued, manual: manualStalled + manualPreview };
}

export async function runSocialPublisherCron(env, scheduledTime = new Date()) {
    const config = getConfig(env);
    if (!config.url || !config.serviceRoleKey) {
        console.warn("[Social Publisher] Cron skipped: Supabase credentials are not configured.");
        return { claimed: 0, skipped: true };
    }

    /* Bersihkan run yatim lebih dulu supaya riwayat tidak menumpuk status
       "generating" abadi dan jadwal terkait bisa lanjut. */
    const swept = await sweepAbandonedRuns(config, scheduledTime);

    const claims = await dbRequest(config, "/rest/v1/rpc/claim_due_social_post_schedules", {
        method: "POST",
        body: JSON.stringify({ p_now: new Date(scheduledTime).toISOString(), p_limit: 2 })
    });
    const jobs = Array.isArray(claims) ? claims : [];
    for (const job of jobs) {
        await processRun(env, config, job);
    }

    /* Run autopost yang terjebak (invocation worker mati mendadak, mis. saat deploy):
       klaim ulang supaya alur generate → posting tetap terjaga sampai hasil final.
       Run manual tidak disentuh karena alurnya milik request halaman. */
    let resumed = [];
    try {
        const stuck = await dbRequest(config, "/rest/v1/rpc/claim_stuck_social_post_runs", {
            method: "POST",
            body: JSON.stringify({ p_now: new Date(scheduledTime).toISOString(), p_limit: 2 })
        });
        resumed = Array.isArray(stuck) ? stuck : [];
    } catch (error) {
        console.warn("[Social Publisher] Resume run terjebak dilewati:", error?.message || "unknown error");
    }
    for (const job of resumed) {
        console.log(`[Social Publisher] Melanjutkan run autopost yang terjebak: ${job.run_id}`);
        await processRun(env, config, job);
    }
    return { claimed: jobs.length, resumed: resumed.length, swept, skipped: false };
}
