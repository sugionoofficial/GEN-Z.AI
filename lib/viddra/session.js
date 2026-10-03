/* =========================================================
   GEN-Z.AI
   VID DRA SESSION
   ---------------------------------------------------------
   File:
   lib/viddra/session.js

   Fungsi:
   - Menyimpan VidDra JWT dalam HttpOnly cookie
   - Mengenkripsi token sebelum disimpan
   - Membaca session VidDra dari request
   - Menghapus session VidDra

   SECURITY:
   - JWT TIDAK pernah dikirim ke browser JavaScript
   - JWT TIDAK disimpan di localStorage
   - JWT TIDAK dikembalikan oleh API account
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

const SESSION_MAX_AGE =
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
            "Token VidDra tidak valid."
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
   CREATE SESSION COOKIE
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
   READ SESSION
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
   CLEAR SESSION COOKIE
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
