// ========================================
// GEN-Z.AI
// PROVIDERS - SUPABASE MODULE
// File: admin-control/providers/supabase.js
// ========================================

(function () {
    "use strict";

    // Jangan membuat client dua kali
    if (window.GENZProviderSupabase) {
        return;
    }

    // ========================================
    // VALIDASI CONFIG
    // ========================================

    const config = window.GENZ_CONFIG;

    if (!config) {
        console.error(
            "[GEN-Z.AI] GENZ_CONFIG tidak ditemukan."
        );

        window.GENZProviderSupabase = {
            ready: false,
            error: "Konfigurasi GEN-Z.AI tidak ditemukan."
        };

        return;
    }

    if (
        !config.SUPABASE_URL ||
        !config.SUPABASE_KEY
    ) {
        console.error(
            "[GEN-Z.AI] SUPABASE_URL atau SUPABASE_KEY tidak ditemukan."
        );

        window.GENZProviderSupabase = {
            ready: false,
            error: "Konfigurasi Supabase tidak lengkap."
        };

        return;
    }

    // ========================================
    // VALIDASI LIBRARY
    // ========================================

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        console.error(
            "[GEN-Z.AI] Library Supabase belum tersedia."
        );

        window.GENZProviderSupabase = {
            ready: false,
            error: "Library Supabase belum tersedia."
        };

        return;
    }

    // ========================================
    // CREATE CLIENT
    // ========================================

    let client;

    try {
        client = window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_KEY
        );
    } catch (error) {
        console.error(
            "[GEN-Z.AI] Gagal membuat Supabase client:",
            error
        );

        window.GENZProviderSupabase = {
            ready: false,
            error: "Gagal membuat koneksi Supabase."
        };

        return;
    }

    // ========================================
    // SESSION
    // ========================================

    async function getSession() {
        const result =
            await client.auth.getSession();

        if (result.error) {
            throw result.error;
        }

        return result.data?.session || null;
    }

    // ========================================
    // USER
    // ========================================

    async function getUser() {
        const result =
            await client.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        return result.data?.user || null;
    }

    // ========================================
    // ACCESS TOKEN
    // ========================================

    async function getAccessToken() {
        const session =
            await getSession();

        return session?.access_token || null;
    }

    // ========================================
    // AUTH CHECK
    // ========================================

    async function requireSession() {
        const session =
            await getSession();

        if (!session) {
            throw new Error(
                "Session login tidak ditemukan."
            );
        }

        return session;
    }

    // ========================================
    // PUBLIC MODULE
    // ========================================

    window.GENZProviderSupabase = {

        ready: true,

        client,

        getSession,

        getUser,

        getAccessToken,

        requireSession
    };

    console.log(
        "[GEN-Z.AI] Provider Supabase module siap."
    );

})();
