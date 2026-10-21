import {
    buildDeletionResponse,
    escapeHtml,
    FACEBOOK_DATA_DELETION_STEPS,
    generateConfirmationCode,
    renderInstructionsPage,
    renderStatusNotFoundPage,
    renderStatusPage,
    resolveContact,
    resolvePublicOrigin
} from "../lib/social-publisher/data-deletion.js";
import { parseSignedRequest, SignedRequestError } from "../lib/social-publisher/signed-request.js";

/**
 * Meta Data Deletion Request Callback.
 *
 * Public endpoint (no user session). Meta POSTs
 * `signed_request=<sig>.<payload>`; we verify the HMAC with META_APP_SECRET,
 * delete the data received from Facebook, and answer with the status URL plus a
 * confirmation code. `GET ?code=...` renders the public status page; a bare GET
 * renders the public deletion instructions that App Review expects.
 */

const CONFIRMATION_CODE_PATTERN = /^[A-Z0-9]{6,32}$/;

function envValue(env, name) {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(env?.[name] || processValue || "").trim();
}

function getSupabaseConfig(env) {
    return {
        url: envValue(env, "SUPABASE_URL").replace(/\/+$/, ""),
        serviceRoleKey: envValue(env, "SUPABASE_SERVICE_ROLE_KEY")
    };
}

function tablePath(table, params = "") {
    return `/rest/v1/${table}${params ? `?${params}` : ""}`;
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
        const error = new Error(
            String(data?.message || data?.hint || `Supabase request gagal (HTTP ${response.status}).`).slice(0, 500)
        );
        error.status = response.status;
        error.code = String(data?.code || "");
        throw error;
    }
    return data;
}

function isMissingTable(error) {
    return error?.code === "PGRST205" || error?.code === "42P01" ||
        /does not exist|schema cache|relation .* does not exist/i.test(String(error?.message || ""));
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

function json(res, status, body) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(body);
}

function html(res, status, body) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(status).end(body);
}

/** Meta posts form-encoded data; also accept JSON and a query fallback. */
function readSignedRequest(req) {
    const body = req.body;
    if (typeof body === "string") {
        const params = new URLSearchParams(body);
        return params.get("signed_request") || "";
    }
    if (body && typeof body === "object" && !ArrayBuffer.isView(body)) {
        const value = body.signed_request;
        if (Array.isArray(value)) return String(value[0] || "");
        if (typeof value === "string") return value;
    }
    if (body instanceof Uint8Array || ArrayBuffer.isView(body)) {
        const text = new TextDecoder().decode(body);
        if (text) {
            const trimmed = text.trim();
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (typeof parsed?.signed_request === "string") return parsed.signed_request;
                } catch {
                    // fall through to form parsing
                }
            }
            const params = new URLSearchParams(trimmed);
            if (params.get("signed_request")) return params.get("signed_request");
        }
    }
    return getQuery(req, "signed_request");
}

async function findOwnerIds(config, fbUserId) {
    if (!fbUserId) return [];
    try {
        const rows = await supabaseRequest(
            config,
            tablePath("social_facebook_identities", `select=owner_id&fb_user_id=eq.${encodeURIComponent(fbUserId)}`)
        );
        return (Array.isArray(rows) ? rows : []).map(row => row.owner_id).filter(Boolean);
    } catch (error) {
        // Older deployments may not have run the identity migration yet.
        if (isMissingTable(error)) return [];
        throw error;
    }
}

async function deleteRowsForOwner(config, table, ownerId, column = "owner_id") {
    const rows = await supabaseRequest(
        config,
        tablePath(table, `${column}=eq.${encodeURIComponent(ownerId)}&select=id`),
        {
            method: "DELETE",
            headers: { Prefer: "return=representation" }
        }
    );
    return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Deletes Facebook-derived rows for every matched GEN-Z.AI account, following
 * FACEBOOK_DATA_DELETION_STEPS order so the RESTRICT foreign keys never block.
 */
async function deleteFacebookData(config, ownerIds) {
    const counts = Object.fromEntries(FACEBOOK_DATA_DELETION_STEPS.map(step => [step.table, 0]));
    for (const ownerId of ownerIds) {
        counts.social_post_runs += await deleteRowsForOwner(config, "social_post_runs", ownerId);
        counts.social_post_schedules += await deleteRowsForOwner(config, "social_post_schedules", ownerId);
        counts.social_page_connections += await deleteRowsForOwner(config, "social_page_connections", ownerId);
        counts.facebook_oauth_states += await deleteRowsForOwner(config, "facebook_oauth_states", ownerId, "user_id");
        counts.social_facebook_identities += await deleteRowsForOwner(config, "social_facebook_identities", ownerId);
    }
    return counts;
}

async function createDeletionRequest(config, { confirmationCode, fbUserId, ownerIds }) {
    const rows = await supabaseRequest(
        config,
        tablePath("social_data_deletion_requests", "select=id,confirmation_code,status,requested_at"),
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                confirmation_code: confirmationCode,
                fb_user_id: fbUserId,
                status: "pending",
                matched_user_ids: ownerIds
            })
        }
    );
    return rows?.[0] || null;
}

async function finishDeletionRequest(config, id, values) {
    await supabaseRequest(
        config,
        tablePath("social_data_deletion_requests", `id=eq.${encodeURIComponent(id)}`),
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(values)
        }
    );
}

async function handlePost(req, res, env) {
    const appSecret = envValue(env, "META_APP_SECRET");
    if (!appSecret) {
        return json(res, 503, { error: "META_APP_SECRET belum dikonfigurasi pada server." });
    }

    const signedRequest = readSignedRequest(req);
    if (!signedRequest) {
        return json(res, 400, { error: "signed_request wajib diisi." });
    }

    let payload;
    try {
        payload = await parseSignedRequest(signedRequest, appSecret);
    } catch (error) {
        const status = error instanceof SignedRequestError ? error.status : 400;
        return json(res, status, { error: error?.message || "signed_request tidak valid." });
    }

    const fbUserId = String(payload.user_id || "").trim().slice(0, 80);
    if (!fbUserId) {
        return json(res, 400, { error: "signed_request tidak memuat user_id Facebook." });
    }

    const config = getSupabaseConfig(env);
    const origin = resolvePublicOrigin(req, env);
    const confirmationCode = generateConfirmationCode();

    let requestRow;
    try {
        requestRow = await createDeletionRequest(config, {
            confirmationCode,
            fbUserId,
            ownerIds: []
        });
    } catch (error) {
        if (isMissingTable(error)) {
            return json(res, 503, {
                error: "Tabel penghapusan data belum tersedia. Jalankan supabase/social-auto-publisher.sql di Supabase SQL Editor."
            });
        }
        throw error;
    }
    if (!requestRow?.id) {
        return json(res, 500, { error: "Permintaan penghapusan data gagal dicatat." });
    }

    try {
        const ownerIds = await findOwnerIds(config, fbUserId);
        const counts = await deleteFacebookData(config, ownerIds);
        await finishDeletionRequest(config, requestRow.id, {
            status: "completed",
            matched_user_ids: ownerIds,
            deleted_counts: counts,
            completed_at: new Date().toISOString()
        });
    } catch (error) {
        const safeMessage = String(error?.message || "Penghapusan data gagal.").slice(0, 500);
        console.error("Facebook data deletion failed:", safeMessage);
        await finishDeletionRequest(config, requestRow.id, {
            status: "failed",
            error_message: safeMessage,
            completed_at: new Date().toISOString()
        }).catch(updateError => {
            console.error("Could not record deletion failure:", updateError?.message || "unknown error");
        });
    }

    // Meta expects a 200 with these two fields so the person receives a
    // confirmation code and a status URL, even when follow-up is required.
    return json(res, 200, buildDeletionResponse(origin, confirmationCode));
}

async function handleGet(req, res, env) {
    const contact = resolveContact(env);
    const code = getQuery(req, "code").trim().toUpperCase();

    if (!code) {
        const origin = resolvePublicOrigin(req, env);
        return html(res, 200, renderInstructionsPage({
            callbackUrl: `${origin}/api/facebook-data-deletion`,
            contact
        }));
    }

    if (!CONFIRMATION_CODE_PATTERN.test(code)) {
        return html(res, 400, renderStatusNotFoundPage({ contact }));
    }

    const config = getSupabaseConfig(env);
    let rows;
    try {
        rows = await supabaseRequest(
            config,
            tablePath(
                "social_data_deletion_requests",
                `select=confirmation_code,status,matched_user_ids,deleted_counts,error_message,requested_at,completed_at&confirmation_code=eq.${encodeURIComponent(code)}&limit=1`
            )
        );
    } catch (error) {
        if (isMissingTable(error)) {
            return html(res, 503, renderStatusNotFoundPage({ contact }));
        }
        throw error;
    }

    const request = rows?.[0];
    if (!request) {
        return html(res, 404, renderStatusNotFoundPage({ contact }));
    }
    return html(res, 200, renderStatusPage({ request, contact }));
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
    }

    const env = req.env || {};

    try {
        if (req.method === "GET" || req.method === "HEAD") {
            return await handleGet(req, res, env);
        }
        if (req.method === "POST") {
            return await handlePost(req, res, env);
        }
        return json(res, 405, { error: "Method tidak didukung." });
    } catch (error) {
        console.error("Facebook data deletion endpoint failed:", error?.message || "unknown error");
        if (String(getHeader(req, "accept")).includes("text/html")) {
            return html(res, 500, renderStatusNotFoundPage({ contact: resolveContact(env) }));
        }
        return json(res, 500, { error: "Terjadi kesalahan internal." });
    }
}

export { deleteFacebookData, findOwnerIds, readSignedRequest, escapeHtml };
