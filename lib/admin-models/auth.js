//api/admin-models/auth.js?v=1.1
// ========================================
// GEN-Z.AI
// ADMIN MODEL API
// File: api/admin-models/auth.js
// ========================================

import {
    supabaseRequest,
    getSupabaseError
} from "./supabase.js";


// ========================================
// HEADER
// ========================================

const getHeader = (
    req,
    name
) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


// ========================================
// BEARER TOKEN
// ========================================

const getBearerToken = (
    req
) => {

    const authorization =
        getHeader(
            req,
            "authorization"
        );

    if (!authorization) {
        return null;
    }

    const match =
        String(
            authorization
        ).match(
            /^Bearer\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;

};


// ========================================
// VERIFY ADMIN
// ========================================

export const verifyAdmin = async (
    req,
    config
) => {

    const token =
        getBearerToken(req);


    if (!token) {

        return {

            ok: false,

            status: 401,

            error:
                "Session tidak ditemukan. Silakan login kembali."

        };

    }


    if (
        !config.url ||
        !config.anonKey ||
        !config.serviceRoleKey
    ) {

        return {

            ok: false,

            status: 500,

            error:
                "Konfigurasi Supabase server belum lengkap."

        };

    }


    // ====================================
    // VERIFY SUPABASE USER
    // ====================================

    const authResult =
        await supabaseRequest(

            config.url,

            "/auth/v1/user",

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.anonKey,

                    "Authorization":
                        `Bearer ${token}`

                }

            }

        );


    if (
        !authResult.response.ok ||
        !authResult.data?.id
    ) {

        console.error(
            "SUPABASE AUTH ERROR:",
            authResult.data
        );

        return {

            ok: false,

            status: 401,

            error:
                "Session Supabase tidak valid atau sudah kedaluwarsa."

        };

    }


    const userId =
        authResult.data.id;


    // ====================================
    // LOAD PROFILE
    // ====================================

    const profilePath =
        `/rest/v1/profiles?select=id,email,name,role,status,credits&id=eq.${encodeURIComponent(userId)}&limit=1`;


    const profileResult =
        await supabaseRequest(

            config.url,

            profilePath,

            {

                method: "GET",

                headers: {

                    "apikey":
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                }

            }

        );


    if (
        !profileResult.response.ok
    ) {

        console.error(
            "PROFILE CHECK ERROR:",
            profileResult.data
        );

        return {

            ok: false,

            status: 500,

            error:
                getSupabaseError(
                    profileResult.data,
                    "Gagal memeriksa profile admin."
                )

        };

    }


    const profile =
        Array.isArray(
            profileResult.data
        )
            ? profileResult.data[0]
            : null;


    if (!profile) {

        return {

            ok: false,

            status: 403,

            error:
                "Profile admin tidak ditemukan."

        };

    }


    // ====================================
    // ROLE
    // ====================================

    const role =
        String(
            profile.role || ""
        )
            .trim()
            .toUpperCase();


    // ====================================
    // ACCOUNT STATUS
    // ====================================

    const accountStatus =
        String(
            profile.status || ""
        )
            .trim()
            .toLowerCase();


    // ====================================
    // ADMIN / OWNER ONLY
    // ====================================

    if (
        ![
            "ADMIN",
            "OWNER"
        ].includes(role)
    ) {

        return {

            ok: false,

            status: 403,

            error:
                "Anda tidak memiliki akses admin."

        };

    }


    // ====================================
    // ACTIVE ONLY
    // ====================================

    if (
        accountStatus !== "active"
    ) {

        return {

            ok: false,

            status: 403,

            error:
                "Akun admin tidak aktif."

        };

    }


    // ====================================
    // SUCCESS
    // ====================================

    return {

        ok: true,

        userId,

        profile: {

            ...profile,

            role

        }

    };

};
