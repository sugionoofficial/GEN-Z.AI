/* =========================================================
   GEN-Z.AI — GENERATED IMAGE PERSISTENCE HELPER
   ---------------------------------------------------------
   File: lib/generate/persist-generated-image.js

   Menyimpan hasil generate gambar (dari URL HTTPS provider
   maupun data URL base64 inline) ke bucket privat
   `user-uploads` pada path milik user:
     upscale-photos/outputs/<userId>/genimg-<ts>-<rand>.<ext>

   Manfaat:
   - Menghasilkan referensi `supabase-private://user-uploads/...`
     yang otomatis ditukar menjadi signed URL oleh API & History
   - Gambar tetap hidup sesuai retensi sistem tanpa bergantung
     pada signed URL singkat CDN provider
   - Mendukung output inline `data:image/...;base64,...`
   - 100% Cloudflare Workers & Node.js compatible
========================================================= */

import {
    buildPrivateMediaRef,
    isPrivateMediaRef
} from "./private-media.js";
import { UPLOAD_BUCKET } from "./upscale-source.js";

const FETCH_IMAGE_TIMEOUT_MS = 18000;
const MAX_PERSIST_IMAGE_BYTES = 35 * 1024 * 1024;

function decodeBase64ToBytes(base64Text) {
    const clean = String(base64Text || "").replace(/\s+/g, "");
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return new Uint8Array(Buffer.from(clean, "base64"));
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function detectImageTypeFromBytes(bytes, fallbackMime = "", sourceUrl = "") {
    if (bytes instanceof Uint8Array && bytes.length >= 12) {
        if (
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47
        ) {
            return { mime: "image/png", ext: "png" };
        }
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
            return { mime: "image/jpeg", ext: "jpg" };
        }
        if (
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x45 &&
            bytes[10] === 0x42 &&
            bytes[11] === 0x50
        ) {
            return { mime: "image/webp", ext: "webp" };
        }
    }

    const mime = String(fallbackMime || "").split(";")[0].trim().toLowerCase();
    if (mime === "image/png") return { mime: "image/png", ext: "png" };
    if (mime === "image/webp") return { mime: "image/webp", ext: "webp" };
    if (mime === "image/jpeg" || mime === "image/jpg") return { mime: "image/jpeg", ext: "jpg" };

    const cleanPath = String(sourceUrl || "").split("?")[0].split("#")[0].toLowerCase();
    if (cleanPath.endsWith(".png")) return { mime: "image/png", ext: "png" };
    if (cleanPath.endsWith(".webp")) return { mime: "image/webp", ext: "webp" };
    return { mime: "image/jpeg", ext: "jpg" };
}

function makeRandomSuffix() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    }
    return Math.random().toString(36).slice(2, 12);
}

export async function persistGeneratedImage({
    sourceUrl,
    userId,
    supabaseUrl,
    serviceKey,
    fetchImpl = globalThis.fetch
} = {}) {
    const rawUrl = String(sourceUrl || "").trim();
    if (!rawUrl) {
        return "";
    }
    if (isPrivateMediaRef(rawUrl)) {
        return rawUrl;
    }

    const cleanUserId = String(userId || "").trim();
    const cleanSupabaseUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
    const cleanServiceKey = String(serviceKey || "").trim();

    if (
        !cleanUserId ||
        !/^[A-Za-z0-9._-]+$/.test(cleanUserId) ||
        !cleanSupabaseUrl ||
        !cleanServiceKey ||
        typeof fetchImpl !== "function"
    ) {
        return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
    }

    try {
        let bytes = null;
        let mimeHint = "";

        const dataMatch = /^data:(image\/(?:png|jpe?g|webp|avif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(rawUrl);
        if (dataMatch) {
            mimeHint = dataMatch[1].toLowerCase();
            bytes = decodeBase64ToBytes(dataMatch[2]);
        } else if (/^https?:\/\//i.test(rawUrl)) {
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            const timer = controller
                ? setTimeout(() => controller.abort(), FETCH_IMAGE_TIMEOUT_MS)
                : null;
            try {
                const resp = await fetchImpl(rawUrl, {
                    method: "GET",
                    ...(controller ? { signal: controller.signal } : {})
                });
                if (!resp.ok) {
                    return rawUrl;
                }
                mimeHint = String(resp.headers?.get?.("content-type") || "").trim();
                const buf = await resp.arrayBuffer();
                bytes = new Uint8Array(buf);
            } finally {
                if (timer) clearTimeout(timer);
            }
        } else {
            return "";
        }

        if (!bytes || bytes.byteLength < 64 || bytes.byteLength > MAX_PERSIST_IMAGE_BYTES) {
            return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
        }

        const detected = detectImageTypeFromBytes(bytes, mimeHint, rawUrl);
        const objectPath = `upscale-photos/outputs/${cleanUserId}/genimg-${Date.now()}-${makeRandomSuffix()}.${detected.ext}`;
        const encodedPath = objectPath
            .split("/")
            .map(segment => encodeURIComponent(segment))
            .join("/");

        const uploadResp = await fetchImpl(
            `${cleanSupabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedPath}`,
            {
                method: "POST",
                headers: {
                    apikey: cleanServiceKey,
                    Authorization: `Bearer ${cleanServiceKey}`,
                    "Content-Type": detected.mime,
                    "x-upsert": "true"
                },
                body: bytes
            }
        );

        if (!uploadResp.ok) {
            return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
        }

        return buildPrivateMediaRef({
            bucket: UPLOAD_BUCKET,
            objectPath
        });
    } catch (err) {
        console.warn("[persist-generated-image] Fallback ke URL asli:", err?.message || err);
        return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
    }
}
