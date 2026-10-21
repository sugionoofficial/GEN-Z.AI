/**
 * Meta `signed_request` verification.
 *
 * Meta posts `signed_request=<signature>.<payload>` to the Deauthorize and Data
 * Deletion callbacks. Both segments are base64url encoded and the signature is
 * an HMAC-SHA256 of the *encoded payload string*, keyed with the app secret:
 *
 *   https://developers.facebook.com/docs/games/gamesonfacebook/security
 *
 * The endpoint is public, so the signature is the only thing that proves the
 * request came from Meta. Anything that fails verification must be rejected
 * with HTTP 400.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class SignedRequestError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "SignedRequestError";
        this.status = status;
    }
}

function normalizeBase64Url(value) {
    const text = String(value || "");
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    return padded + "=".repeat((4 - (padded.length % 4)) % 4);
}

export function base64UrlToBytes(value) {
    const text = String(value || "");
    if (!text || !BASE64_URL_PATTERN.test(text)) {
        throw new SignedRequestError("signed_request tidak valid.");
    }
    let binary;
    try {
        binary = atob(normalizeBase64Url(text));
    } catch {
        throw new SignedRequestError("signed_request tidak valid.");
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function base64UrlToString(value) {
    return decoder.decode(base64UrlToBytes(value));
}

/**
 * Verifies the HMAC and returns the decoded payload.
 * Throws SignedRequestError (HTTP 400) for malformed, unsigned, or tampered input.
 */
export async function parseSignedRequest(signedRequest, appSecret) {
    const raw = String(signedRequest || "").trim();
    if (!raw) throw new SignedRequestError("signed_request wajib diisi.");
    const secret = String(appSecret || "");
    if (!secret) {
        throw new SignedRequestError("META_APP_SECRET belum dikonfigurasi pada server.", 503);
    }

    const parts = raw.split(".");
    if (parts.length !== 2) {
        throw new SignedRequestError("Format signed_request tidak valid.");
    }
    const [signaturePart, payloadPart] = parts;
    if (!signaturePart || !payloadPart) {
        throw new SignedRequestError("Format signed_request tidak valid.");
    }

    const signature = base64UrlToBytes(signaturePart);
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );
    const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        encoder.encode(payloadPart)
    );
    if (!valid) {
        throw new SignedRequestError("Tanda tangan signed_request tidak cocok.");
    }

    let payload;
    try {
        payload = JSON.parse(base64UrlToString(payloadPart));
    } catch {
        throw new SignedRequestError("Payload signed_request tidak dapat dibaca.");
    }
    if (!payload || typeof payload !== "object") {
        throw new SignedRequestError("Payload signed_request tidak valid.");
    }
    if (payload.algorithm && payload.algorithm !== "HMAC-SHA256") {
        throw new SignedRequestError("Algoritma signed_request tidak didukung.");
    }

    return payload;
}

/** Helper for tests and local tooling: builds a valid Meta-signed payload. */
export async function createSignedRequest(payload, appSecret) {
    const payloadPart = btoa(JSON.stringify(payload))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(String(appSecret || "")),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBytes = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart))
    );
    let binary = "";
    for (const byte of signatureBytes) binary += String.fromCharCode(byte);
    const signaturePart = btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    return `${signaturePart}.${payloadPart}`;
}
