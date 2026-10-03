/* =========================================================
   GEN-Z.AI
   VIDDRA SESSION
   ---------------------------------------------------------
   File:
   api/viddra/session.js

   Fungsi:
   - Menyimpan JWT VidDra dalam HttpOnly cookie terenkripsi
   - Membaca session VidDra dari request
   - Menghapus session VidDra
   - JWT VidDra tidak pernah dikirim ke JavaScript browser
========================================================= */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes
} from "node:crypto";


const COOKIE_NAME =
    "genz_viddra_session";


const SESSION_SECRET =
    String(
        process.env.VIDDRA_SESSION_SECRET || ""
    ).trim();


const COOKIE_MAX_AGE =
    60 * 60 * 24;


/* =========================================================
   SECRET
========================================================= */

function getKey() {

    if (
        !SESSION_SECRET
    ) {

        throw new Error(
            "VIDDRA_SESSION_SECRET is not configured"
        );

    }


    /*
     * AES-256 membutuhkan key 32 byte.
     *
     * Secret environment variable di-hash menjadi
     * SHA-256 agar selalu menghasilkan 32 byte.
     */

    return createHash(
        "sha256"
    )
        .update(
            SESSION_SECRET
        )
        .digest();

}


/* =========================================================
   ENCRYPT
========================================================= */

function encrypt(
    value
) {

    const key =
        getKey();


    const iv =
        randomBytes(
            12
        );


    const cipher =
        createCipheriv(
            "aes-256-gcm",
            key,
            iv
        );


    const encrypted =
        Buffer.concat([
            cipher.update(
                value,
                "utf8"
            ),
            cipher.final()
        ]);


    const authTag =
        cipher.getAuthTag();


    return [

        iv.toString(
            "base64url"
        ),

        authTag.toString(
            "base64url"
        ),

        encrypted.toString(
            "base64url"
        )

    ].join(
        "."
    );

}


/* =========================================================
   DECRYPT
========================================================= */

function decrypt(
    value
) {

    try {

        const parts =
            String(
                value || ""
            ).split(
                "."
            );


        if (
            parts.length !== 3
        ) {

            return null;

        }


        const [
            ivEncoded,
            tagEncoded,
            encryptedEncoded
        ] = parts;


        const iv =
            Buffer.from(
                ivEncoded,
                "base64url"
            );


        const authTag =
            Buffer.from(
                tagEncoded,
                "base64url"
            );


        const encrypted =
            Buffer.from(
                encryptedEncoded,
                "base64url"
            );


        const key =
            getKey();


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
        String(
            req.headers?.cookie ||
            req.headers?.Cookie ||
            ""
        );


    if (
        !header
    ) {

        return {};

    }


    const cookies = {};


    for (
        const part
        of header.split(";")
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


        cookies[name] =
            decodeURIComponent(
                value
            );

    }


    return cookies;

}


/* =========================================================
   CREATE COOKIE
========================================================= */

export function createVidDraSessionCookie(
    token
) {

    const cleanToken =
        String(
            token || ""
        ).trim();


    if (
        !cleanToken
    ) {

        throw new Error(
            "VidDra token is required"
        );

    }


    const encrypted =
        encrypt(
            cleanToken
        );


    return [

        `${COOKIE_NAME}=${encodeURIComponent(encrypted)}`,

        "Path=/",

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        `Max-Age=${COOKIE_MAX_AGE}`

    ].join(
        "; "
    );

}


/* =========================================================
   READ SESSION
========================================================= */

export function getVidDraSession(
    req
) {

    try {

        const cookies =
            parseCookies(
                req
            );


        const encrypted =
            cookies[
                COOKIE_NAME
            ];


        if (
            !encrypted
        ) {

            return null;

        }


        const token =
            decrypt(
                encrypted
            );


        if (
            !token
        ) {

            return null;

        }


        return token;

    } catch {

        return null;

    }

}


/* =========================================================
   CLEAR COOKIE
========================================================= */

export function clearVidDraSessionCookie() {

    return [

        `${COOKIE_NAME}=`,

        "Path=/",

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        "Max-Age=0"

    ].join(
        "; "
    );

}
