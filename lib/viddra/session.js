/* =========================================================
   GEN-Z.AI
   VID DRA SESSION
   ---------------------------------------------------------
   File:
   lib/viddra/session.js

   Fungsi:
   - Menyimpan VidDra JWT dalam encrypted HttpOnly cookie
   - Menyimpan VidDra API Key dalam encrypted HttpOnly cookie
   - Membaca session VidDra
   - Membaca API Key VidDra
   - Menghapus session/API Key
   - Tidak pernah mengekspos secret ke browser JavaScript

   SECURITY:
   - JWT TIDAK pernah dikirim ke browser JavaScript
   - API Key TIDAK pernah dikirim ke browser JavaScript
   - JWT TIDAK disimpan localStorage
   - API Key TIDAK disimpan localStorage
   - JWT dienkripsi sebelum masuk cookie
   - API Key dienkripsi sebelum masuk cookie
========================================================= */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes
} from "node:crypto";


/* =========================================================
   CONFIG
========================================================= */

const COOKIE_NAME =
    "genz_viddra_session";

const API_KEY_COOKIE_NAME =
    "genz_viddra_api_key";

const SESSION_MAX_AGE =
    60 * 60 * 24;

const API_KEY_MAX_AGE =
    60 * 60 * 24;


/* =========================================================
   SECRET
========================================================= */

function getEncryptionKey() {

    const secret =
        process.env.VIDDRA_SESSION_SECRET;

    if (
        !secret ||
        typeof secret !== "string" ||
        secret.length < 32
    ) {

        throw new Error(
            "VIDDRA_SESSION_SECRET belum dikonfigurasi."
        );

    }

    return createHash("sha256")
        .update(secret)
        .digest();

}


/* =========================================================
   ENCRYPT TOKEN
========================================================= */

function encryptToken(token) {

    if (
        !token ||
        typeof token !== "string"
    ) {

        throw new Error(
            "Secret VidDra tidak valid."
        );

    }

    const key =
        getEncryptionKey();

    const iv =
        randomBytes(12);

    const cipher =
        createCipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    const encrypted =
        Buffer.concat([
            cipher.update(
                token,
                "utf8"
            ),
            cipher.final()
        ]);

    const authTag =
        cipher.getAuthTag();


    return [
        iv.toString("base64url"),
        authTag.toString("base64url"),
        encrypted.toString("base64url")
    ].join(".");
}


/* =========================================================
   DECRYPT TOKEN
========================================================= */

function decryptToken(value) {

    if (
        !value ||
        typeof value !== "string"
    ) {

        return null;

    }

    const parts =
        value.split(".");

    if (
        parts.length !== 3
    ) {

        return null;

    }


    try {

        const [
            ivPart,
            authTagPart,
            encryptedPart
        ] = parts;


        const key =
            getEncryptionKey();


        const iv =
            Buffer.from(
                ivPart,
                "base64url"
            );

        const authTag =
            Buffer.from(
                authTagPart,
                "base64url"
            );

        const encrypted =
            Buffer.from(
                encryptedPart,
                "base64url"
            );


        const decipher =
            createDecipheriv(
                "aes-256-gcm",
                key,
                iv
            );


        decipher.setAuthTag(
            authTag
        );


        const decrypted =
            Buffer.concat([
                decipher.update(
                    encrypted
                ),
                decipher.final()
            ]);


        return decrypted.toString(
            "utf8"
        );

    } catch {

        return null;

    }

}


/* =========================================================
   PARSE COOKIE
========================================================= */

function parseCookies(
    req
) {

    const header =
        req?.headers?.cookie;

    if (
        !header ||
        typeof header !== "string"
    ) {

        return {};

    }


    const cookies = {};


    for (
        const part of header.split(";")
    ) {

        const index =
            part.indexOf("=");

        if (
            index === -1
        ) {

            continue;

        }


        const name =
            part
                .slice(
                    0,
                    index
                )
                .trim();

        const value =
            part
                .slice(
                    index + 1
                )
                .trim();


        if (
            !name
        ) {

            continue;

        }


        try {

            cookies[name] =
                decodeURIComponent(
                    value
                );

        } catch {

            cookies[name] =
                value;

        }

    }


    return cookies;

}


/* =========================================================
   CREATE VIDDRA SESSION COOKIE
========================================================= */

export function createVidDraSessionCookie(
    token
) {

    const encryptedToken =
        encryptToken(token);


    return [
        `${COOKIE_NAME}=${encodeURIComponent(encryptedToken)}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        `Max-Age=${SESSION_MAX_AGE}`
    ].join("; ");

}


/* =========================================================
   READ VIDDRA SESSION
========================================================= */

export function getVidDraSession(
    req
) {

    const cookies =
        parseCookies(req);

    const encryptedToken =
        cookies[
            COOKIE_NAME
        ];


    if (
        !encryptedToken
    ) {

        return null;

    }


    return decryptToken(
        encryptedToken
    );

}


/* =========================================================
   CLEAR VIDDRA SESSION COOKIE
========================================================= */

export function clearVidDraSessionCookie() {

    return [
        `${COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0"
    ].join("; ");

}


/* =========================================================
   CREATE VIDDRA API KEY COOKIE
   ---------------------------------------------------------
   API Key dienkripsi menggunakan mekanisme yang sama
   dengan VidDra JWT.

   Browser tidak dapat membaca cookie ini karena:
   HttpOnly
========================================================= */

export function createVidDraApiKeyCookie(
    apiKey
) {

    const encryptedApiKey =
        encryptToken(apiKey);


    return [
        `${API_KEY_COOKIE_NAME}=${encodeURIComponent(encryptedApiKey)}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        `Max-Age=${API_KEY_MAX_AGE}`
    ].join("; ");

}


/* =========================================================
   READ VIDDRA API KEY
========================================================= */

export function getVidDraApiKey(
    req
) {

    const cookies =
        parseCookies(req);

    const encryptedApiKey =
        cookies[
            API_KEY_COOKIE_NAME
        ];


    if (
        !encryptedApiKey
    ) {

        return null;

    }


    return decryptToken(
        encryptedApiKey
    );

}


/* =========================================================
   CLEAR VIDDRA API KEY COOKIE
========================================================= */

export function clearVidDraApiKeyCookie() {

    return [
        `${API_KEY_COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0"
    ].join("; ");

}
