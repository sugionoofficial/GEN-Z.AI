import { applyOutfitToScene, buildImagePrompt, composeSocialCaption, createScenePlan, pickRandomOutfit, renderCaption, sceneOverridesFromSchedule } from "../../lib/social-publisher/utils.js";
import { decryptSecret, generateSocialContextCaption, generateSocialImage, makeProfileShareUrl, publishFacebookPhoto } from "../../lib/social-publisher/providers.js";
import { createSignedReferenceUrl, downloadReferenceObject, isPrivateReferenceBucket } from "../../lib/social-publisher/storage.js";
import { normalizeQwenCloudImageModel, recordModelUsage } from "../../lib/social-publisher/quotas.js";
import { stripImageMetadata } from "../../metadata-cleaner/assets/js/metadata-cleaner-image.js";

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
    await dbRequest(config, table("social_post_runs", `id=eq.${encodeURIComponent(runId)}`), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(values)
    });
}

const SUBSCRIPTION_INACTIVE_REASON = "subscription_inactive";

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

function isMissingRunOutfitColumn(error) {
    if (error?.code === "PGRST204" || error?.code === "42703") return true;
    return /outfit_id|column .* does not exist/i.test(String(error?.message || ""));
}

/**
 * Recent posted runs are used to avoid repeating a composition or an outfit.
 * Deployments that have not run the outfit migration still fall back to the
 * scene only history instead of failing the whole run.
 */
async function listRecentPostedRuns(config, scheduleId) {
    const base = `select=scene_plan&schedule_id=eq.${encodeURIComponent(scheduleId)}&status=eq.posted&order=created_at.desc&limit=12`;
    try {
        return await dbRequest(config, table("social_post_runs", `select=scene_plan,outfit_id&schedule_id=eq.${encodeURIComponent(scheduleId)}&status=eq.posted&order=created_at.desc&limit=12`));
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
        const schedules = await dbRequest(config, table(
            "social_post_schedules",
            `select=id,owner_id,character_id,page_connection_id,enabled,autopublish_enabled,interval_hours,aspect_ratio,caption_template,timezone,scene_location,camera_angle,scene_situation,scene_lighting,scene_atmosphere,scene_condition,scene_details,negative_prompt&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
        ));
        const schedule = schedules?.[0];
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

        const [characters, pageConnections, previousRuns, settingsRows, publisherConfigs] = await Promise.all([
            dbRequest(config, table("social_characters", `select=id,owner_id,display_name,reference_object_key,reference_mime_type,garment_object_key,garment_mime_type,prompt_notes&id=eq.${encodeURIComponent(schedule.character_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_page_connections", `select=id,owner_id,page_id,page_name,can_publish,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(schedule.page_connection_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            listRecentPostedRuns(config, schedule.id),
            dbRequest(config, table("social_publisher_user_settings", `select=caption_template,external_link,autopublish_enabled&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_publisher_config", "select=image_provider,image_model&id=eq.true&limit=1"))
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

        const character = characters?.[0];
        const page = pageConnections?.[0];
        if (!character) throw new Error("Character reference was not found.");
        if (!page) throw new Error("Facebook Page connection was not found; reconnect the Page.");
        if (page.can_publish === false) throw new Error("Facebook Page connection does not have CREATE_CONTENT permission.");
        if (!await isPrivateReferenceBucket(config)) throw new Error("Private Supabase Storage reference bucket is not configured.");

        const referenceBytes = await downloadReferenceObject(config, character.reference_object_key);
        if (!referenceBytes.length || referenceBytes.length > 8 * 1024 * 1024) throw new Error("Reference image size is invalid.");

        const recentSceneKeys = (previousRuns || [])
            .map(item => item.scene_plan?.key)
            .filter(Boolean);
        const { outfit, ready: outfitLibraryReady } = await pickScheduledOutfit(config, schedule, previousRuns);
        const garmentObjectKey = outfit?.object_key || character.garment_object_key || "";
        const garmentMimeType = outfit?.mime_type || character.garment_mime_type || "";
        const aspectRatio = ["9:16", "16:9"].includes(schedule.aspect_ratio) ? schedule.aspect_ratio : "9:16";
        imageProvider = ["cloudflare", "qwencloud"].includes(publisherConfigs?.[0]?.image_provider)
            ? publisherConfigs[0].image_provider
            : "gemini";
        imageModel = normalizeQwenCloudImageModel(publisherConfigs?.[0]?.image_model);
        const garmentBytes = garmentObjectKey && imageProvider !== "cloudflare"
            ? await downloadReferenceObject(config, garmentObjectKey)
            : null;
        /* Parameter detail dari blok jadwal: kolom kosong otomatis diacak,
           angle kosong jatuh ke medium shot. */
        const scene = applyOutfitToScene(
            { ...createScenePlan(recentSceneKeys, Math.random, sceneOverridesFromSchedule(schedule)), aspect_ratio: aspectRatio },
            outfit
        );
        const prompt = buildImagePrompt({
            characterName: character.display_name,
            characterNotes: character.prompt_notes,
            scene,
            aspectRatio,
            outfitName: outfit?.name,
            outfitNotes: outfit?.notes,
            hasOutfitReference: Boolean(garmentObjectKey),
            negativePrompt: schedule.negative_prompt
        });
        const generated = await generateSocialImage({
            env,
            prompt,
            referenceBytes,
            referenceMimeType: character.reference_mime_type,
            aspectRatio,
            imageProvider,
            ...(imageProvider === "cloudflare" ? {
                personImageUrl: await createSignedReferenceUrl(config, character.reference_object_key),
                garmentImageUrls: garmentObjectKey
                    ? [await createSignedReferenceUrl(config, garmentObjectKey)]
                    : []
            } : {}),
            ...(imageProvider !== "cloudflare" ? {
                garmentBytes,
                garmentMimeType,
                ...(imageProvider === "qwencloud" ? { imageModel } : {})
            } : {})
        });
        if (!generated?.bytes?.length) throw new Error("Image provider returned an empty image.");
        if (imageProvider === "qwencloud") {
            recordModelUsage(config, generated.model).catch(recordError => {
                console.error("Could not record QwenCloud model usage:", recordError?.message || "unknown error");
            });
        }

        const cleanedBlob = await stripImageMetadata(
            new Blob([generated.bytes], { type: generated.mimeType }),
            generated.mimeType
        );
        const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
        const contextualCaption = await generateSocialContextCaption({
            env,
            imageBytes: cleanedBytes,
            imageMimeType: cleanedBlob.type,
            characterName: character.display_name,
            scene,
            imageProvider
        });
        const settings = settingsRows?.[0];
        const baseCaption = renderCaption(settings?.caption_template || schedule.caption_template, scene, character.display_name);
        const caption = composeSocialCaption({
            baseCaption,
            contextualCaption,
            externalLink: settings?.external_link,
            outfit: outfit ? { id: outfit.id, name: outfit.name, order_url: outfit.order_url || "" } : null
        });

        const encryptionKey = value(env, "SOCIAL_TOKEN_ENCRYPTION_KEY");
        if (!encryptionKey) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");
        const pageAccessToken = await decryptSecret(
            page.page_token_ciphertext,
            page.page_token_iv,
            encryptionKey
        );
        const published = await publishFacebookPhoto({
            env,
            pageId: page.page_id,
            pageAccessToken,
            caption,
            imageBytes: cleanedBytes,
            imageMimeType: cleanedBlob.type
        });
        const profileShareUrl = makeProfileShareUrl(published.permalinkUrl);

        await updateRun(config, runId, {
            status: "posted",
            scene_plan: scene,
            generated_prompt: prompt,
            caption,
            image_model: generated.model,
            ...(outfitLibraryReady ? {
                outfit_id: outfit?.id || null,
                outfit_name: outfit?.name || null,
                outfit_order_url: outfit?.order_url || null
            } : {}),
            facebook_photo_id: published.photoId || null,
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
        if (imageProvider === "qwencloud" && (error?.quotaExhausted === true || error?.status === 429)) {
            recordModelUsage(config, imageModel, { quotaError: true, message: safeMessage }).catch(recordError => {
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

export async function runSocialPublisherCron(env, scheduledTime = new Date()) {
    const config = getConfig(env);
    if (!config.url || !config.serviceRoleKey) {
        console.warn("[Social Publisher] Cron skipped: Supabase credentials are not configured.");
        return { claimed: 0, skipped: true };
    }

    const claims = await dbRequest(config, "/rest/v1/rpc/claim_due_social_post_schedules", {
        method: "POST",
        body: JSON.stringify({ p_now: new Date(scheduledTime).toISOString(), p_limit: 2 })
    });
    const jobs = Array.isArray(claims) ? claims : [];
    for (const job of jobs) {
        await processRun(env, config, job);
    }
    return { claimed: jobs.length, skipped: false };
}
