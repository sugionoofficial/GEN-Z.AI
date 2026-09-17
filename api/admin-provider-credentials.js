// ========================================
// GEN-Z.AI
// ADMIN PROVIDER CREDENTIALS API
// File: api/admin-provider-credentials.js
// ========================================

const json = (res, status, data) => {
    return res
        .status(status)
        .json(data);
};

const getHeader = (req, name) => {
    const headers = req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );
};

const getBearerToken = (req) => {
    const authorization = getHeader(
        req,
        "authorization"
    );

    if (!authorization) {
        return null;
    }

    const match = authorization.match(
        /^Bearer\s+(.+)$/i
    );

    return match
        ? match[1].trim()
        : null;
};

const getSupabaseConfig = () => {
    return {
        url:
            process.env.SUPABASE_URL,

        serviceRoleKey:
            process.env.SUPABASE_SERVICE_ROLE_KEY,

        anonKey:
            process.env.SUPABASE_ANON_KEY ||
            process.env.SUPABASE_KEY
    };
};

const supabaseRequest = async (
    url,
    path,
    options = {}
) => {
    const response = await fetch(
        `${url}${path}`,
        options
    );

    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {
                raw: text
            };
        }
    }

    return {
        response,
        data
    };
};

// ========================================
// VERIFY ADMIN
// ========================================

const verifyAdmin = async (
    req,
    config
) => {
    const token = getBearerToken(req);

    if (!token) {
        return {
            ok: false,
            status: 401,
            error: "Session tidak ditemukan."
        };
    }

    const authResult =
        await supabaseRequest(
            config.url,
            "/auth/v1/user",
            {
                method: "GET",

                headers: {
                    apikey:
                        config.anonKey ||
                        config.serviceRoleKey,

                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    if (
        !authResult.response.ok ||
        !authResult.data?.id
    ) {
        return {
            ok: false,
            status: 401,
            error:
                "Session Supabase tidak valid."
        };
    }

    const userId =
        authResult.data.id;

    const profileResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,status&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",

                headers: {
                    apikey:
                        config.serviceRoleKey,

                    Authorization:
                        `Bearer ${config.serviceRoleKey}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );

    if (
        !profileResult.response.ok
    ) {
        return {
            ok: false,
            status: 500,
            error:
                "Gagal memeriksa profile admin."
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

    const role =
        String(
            profile.role || ""
        ).toUpperCase();

    const accountStatus =
        String(
            profile.status || ""
        ).toLowerCase();

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

    return {
        ok: true,
        userId,
        profile
    };
};

// ========================================
// PARSE BODY
// ========================================

const parseBody = (req) => {
    if (
        req.body &&
        typeof req.body === "object"
    ) {
        return req.body;
    }

    if (
        typeof req.body === "string"
    ) {
        try {
            return JSON.parse(
                req.body
            );
        } catch {
            return {};
        }
    }

    return {};
};

// ========================================
// ENCRYPT API KEY
// ========================================

const encryptApiKey = (
    apiKey,
    encryptionKey
) => {
    const crypto =
        require("crypto");

    const key =
        Buffer.from(
            encryptionKey,
            "hex"
        );

    if (key.length !== 32) {
        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY harus 64 karakter hexadecimal."
        );
    }

    const iv =
        crypto.randomBytes(12);

    const cipher =
        crypto.createCipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    const encrypted =
        Buffer.concat([
            cipher.update(
                apiKey,
                "utf8"
            ),
            cipher.final()
        ]);

    const tag =
        cipher.getAuthTag();

    return {
        ciphertext:
            encrypted.toString(
                "base64"
            ),

        iv:
            iv.toString(
                "base64"
            ),

        tag:
            tag.toString(
                "base64"
            )
    };
};

// ========================================
// MAIN HANDLER
// ========================================

export default async function handler(
    req,
    res
) {
    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    if (
        req.method === "OPTIONS"
    ) {
        return res
            .status(204)
            .end();
    }

    if (
        req.method !== "POST"
    ) {
        return json(
            res,
            405,
            {
                success: false,
                error:
                    "Method tidak diizinkan."
            }
        );
    }

    const config =
        getSupabaseConfig();

    if (
        !config.url ||
        !config.serviceRoleKey
    ) {
        return json(
            res,
            500,
            {
                success: false,
                error:
                    "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."
            }
        );
    }

    if (
        !config.anonKey
    ) {
        return json(
            res,
            500,
            {
                success: false,
                error:
                    "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi."
            }
        );
    }

    if (
        !process.env
            .PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {
        return json(
            res,
            500,
            {
                success: false,
                error:
                    "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
            }
        );
    }

    let admin;

    try {
        admin =
            await verifyAdmin(
                req,
                config
            );
    } catch (error) {
        console.error(
            "ADMIN VERIFY ERROR:",
            error
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Gagal memverifikasi akses admin."
            }
        );
    }

    if (!admin.ok) {
        return json(
            res,
            admin.status,
            {
                success: false,
                error:
                    admin.error
            }
        );
    }

    const body =
        parseBody(req);

    const providerId =
        String(
            body.provider_id ||
            body.providerId ||
            ""
        )
            .trim()
            .toLowerCase();

    const apiKey =
        String(
            body.api_key ||
            body.apiKey ||
            ""
        ).trim();

    if (!providerId) {
        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Provider ID wajib diisi."
            }
        );
    }

    if (!apiKey) {
        return json(
            res,
            400,
            {
                success: false,
                error:
                    "API key wajib diisi."
            }
        );
    }

    if (
        !/^[a-z0-9_-]+$/.test(
            providerId
        )
    ) {
        return json(
            res,
            400,
            {
                success: false,
                error:
                    "Provider ID tidak valid."
            }
        );
    }

    try {
        const encrypted =
            encryptApiKey(
                apiKey,
                process.env
                    .PROVIDER_CREDENTIAL_ENCRYPTION_KEY
            );

        const response =
            await fetch(
                `${config.url}/rest/v1/provider_credentials?on_conflict=provider_id`,
                {
                    method: "POST",

                    headers: {
                        apikey:
                            config.serviceRoleKey,

                        Authorization:
                            `Bearer ${config.serviceRoleKey}`,

                        "Content-Type":
                            "application/json",

                        Prefer:
                            "resolution=merge-duplicates,return=minimal"
                    },

                    body:
                        JSON.stringify({
                            provider_id:
                                providerId,

                            api_key_ciphertext:
                                encrypted.ciphertext,

                            api_key_iv:
                                encrypted.iv,

                            api_key_tag:
                                encrypted.tag,

                            updated_at:
                                new Date()
                                    .toISOString()
                        })
                }
            );

        if (!response.ok) {
            const text =
                await response.text();

            console.error(
                "PROVIDER CREDENTIAL SAVE ERROR:",
                text
            );

            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        "Gagal menyimpan credential provider."
                }
            );
        }

        return json(
            res,
            200,
            {
                success: true,
                provider_id:
                    providerId
            }
        );

    } catch (error) {
        console.error(
            "PROVIDER CREDENTIAL ERROR:",
            error
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    error.message ||
                    "Gagal menyimpan API key provider."
            }
        );
    }
}
