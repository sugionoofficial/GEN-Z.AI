//api/admin-models/config.js?v=12121.1
// ========================================
// GEN-Z.AI
// ADMIN MODEL API
// File: api/admin-models/config.js
// ========================================

export const getSupabaseConfig = () => {

    const url =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        serviceRoleKey;

    return {

        url:
            url
                ? String(url).replace(/\/+$/, "")
                : "",

        serviceRoleKey:
            serviceRoleKey || "",

        anonKey:
            anonKey || ""

    };

};
