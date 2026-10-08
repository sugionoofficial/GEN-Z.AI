//api/admin-models/supabase.js?v=2222.1
// ========================================
// GEN-Z.AI
// ADMIN MODEL API
// File: api/admin-models/supabase.js
// ========================================

export const supabaseRequest = async (
    url,
    path,
    options = {}
) => {

    if (!url) {

        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );

    }

    const response =
        await fetch(
            `${url}${path}`,
            options
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(text);

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


export const getSupabaseError = (
    data,
    fallback
) => {

    if (!data) {
        return fallback;
    }

    return (
        data.message ||
        data.error_description ||
        data.error ||
        data.details ||
        data.hint ||
        data.msg ||
        fallback
    );

};
