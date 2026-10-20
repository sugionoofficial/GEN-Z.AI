import { buildImagePrompt, composeSocialCaption, createScenePlan, renderCaption } from "../../lib/social-publisher/utils.js";
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
        throw new Error(String(data?.message || data?.error_description || `Supabase HTTP ${response.status}`).slice(0, 500));
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
            `select=id,owner_id,character_id,page_connection_id,enabled,interval_hours,aspect_ratio,caption_template,timezone&id=eq.${encodeURIComponent(scheduleId)}&enabled=eq.true&limit=1`
        ));
        const schedule = schedules?.[0];
        if (!schedule) throw new Error("Schedule was removed or disabled before processing.");

        const [characters, pageConnections, previousRuns, settingsRows, publisherConfigs] = await Promise.all([
            dbRequest(config, table("social_characters", `select=id,owner_id,display_name,reference_object_key,reference_mime_type,garment_object_key,garment_mime_type,prompt_notes&id=eq.${encodeURIComponent(schedule.character_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_page_connections", `select=id,owner_id,page_id,page_name,can_publish,page_token_ciphertext,page_token_iv&id=eq.${encodeURIComponent(schedule.page_connection_id)}&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_post_runs", `select=scene_plan&schedule_id=eq.${encodeURIComponent(schedule.id)}&status=eq.posted&order=created_at.desc&limit=12`)),
            dbRequest(config, table("social_publisher_user_settings", `select=caption_template,external_link&owner_id=eq.${encodeURIComponent(schedule.owner_id)}&limit=1`)),
            dbRequest(config, table("social_publisher_config", "select=image_provider,image_model&id=eq.true&limit=1"))
        ]);
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
        const aspectRatio = ["9:16", "16:9"].includes(schedule.aspect_ratio) ? schedule.aspect_ratio : "9:16";
        imageProvider = ["cloudflare", "qwencloud"].includes(publisherConfigs?.[0]?.image_provider)
            ? publisherConfigs[0].image_provider
            : "gemini";
        imageModel = normalizeQwenCloudImageModel(publisherConfigs?.[0]?.image_model);
        const garmentBytes = imageProvider === "qwencloud" && character.garment_object_key
            ? await downloadReferenceObject(config, character.garment_object_key)
            : null;
        const scene = { ...createScenePlan(recentSceneKeys), aspect_ratio: aspectRatio };
        const prompt = buildImagePrompt({
            characterName: character.display_name,
            characterNotes: character.prompt_notes,
            scene,
            aspectRatio
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
                garmentImageUrls: character.garment_object_key
                    ? [await createSignedReferenceUrl(config, character.garment_object_key)]
                    : []
            } : {}),
            ...(imageProvider === "qwencloud" ? {
                garmentBytes,
                garmentMimeType: character.garment_mime_type,
                imageModel
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
            externalLink: settings?.external_link
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
            facebook_photo_id: published.photoId || null,
            facebook_post_id: published.postId || null,
            permalink_url: published.permalinkUrl || null,
            profile_share_url: profileShareUrl || null,
            finished_at: new Date().toISOString(),
            error_message: null
        });
        console.log(`[Social Publisher] Posted run ${runId} to Page ${page.page_id}.`);
    } catch (error) {
        const safeMessage = cleanError(error);
        console.error(`[Social Publisher] Run ${runId} failed: ${safeMessage}`);
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
