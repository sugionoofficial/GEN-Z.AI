import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { encryptApiKey } from "../api/admin-provider-credentials.js";

/*
 * 64 karakter heksadesimal = 32 byte = AES-256.
 */
const ENCRYPTION_KEY = "a".repeat(64);
const OTHER_ENCRYPTION_KEY = "b".repeat(64);

/*
 * Dekripsi dicerminkan dari api/generate.js (decryptAesGcm) supaya test
 * memverifikasi format yang benar-benar dipakai saat runtime.
 */
function decryptAesGcm(payload, encryptionKey = ENCRYPTION_KEY) {
    const key = Buffer.from(encryptionKey, "hex");
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(payload.iv, "base64")
    );

    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

    return Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, "base64")),
        decipher.final()
    ]).toString("utf8");
}

test("encrypts a provider API key so it can be decrypted with the configured key", () => {
    const plaintext = "sk-provider-secret-value";
    const encrypted = encryptApiKey(plaintext, ENCRYPTION_KEY);

    assert.equal(decryptAesGcm(encrypted), plaintext);
    assert.notEqual(encrypted.ciphertext, plaintext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.tag);
});

test("uses a fresh IV for every encryption", () => {
    const first = encryptApiKey("same-secret", ENCRYPTION_KEY);
    const second = encryptApiKey("same-secret", ENCRYPTION_KEY);

    assert.notEqual(first.iv, second.iv);
    assert.notEqual(first.ciphertext, second.ciphertext);
});

test("rejects an encryption key that does not decode to 32 bytes", () => {
    assert.throws(
        () => encryptApiKey("secret", "abc123"),
        /PROVIDER_CREDENTIAL_ENCRYPTION_KEY/
    );
});

test("produces a ciphertext that cannot be read with a different key", () => {
    const encrypted = encryptApiKey("secret", ENCRYPTION_KEY);

    assert.throws(() => decryptAesGcm(encrypted, OTHER_ENCRYPTION_KEY));
});
