/**
 * GEN-Z.AI
 * Admin Dashboard - Statistics Module
 *
 * Responsibility:
 * - Total Users
 * - Active Users
 * - Total Generations
 * - Total Credits
 *
 * Tidak menangani:
 * - Authentication UI
 * - Account Activity
 * - Modal
 * - System Information
 */

(function () {
    "use strict";


    /* =====================================================
       STATE
    ====================================================== */

    const state = {
        initialized: false,
        loading: false,
        lastLoadedAt: null
    };


    /* =====================================================
       HELPERS
    ====================================================== */

    function getAuth() {
        return window.GENZDashboardAuth || null;
    }


    function getClient() {
        const auth = getAuth();

        if (auth && typeof auth.getClient === "function") {
            return auth.getClient();
        }

        if (window.GENZ_SUPABASE) {
            return window.GENZ_SUPABASE;
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        return null;
    }


    function getElement(id) {
        return document.getElementById(id);
    }


    function setText(id, value) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        element.textContent = value;
    }


    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "0";
        }

        return new Intl.NumberFormat("id-ID").format(number);
    }


    function formatCredits(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "0";
        }

        return new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 2
        }).format(number);
    }


    function setDiagnostic(message, type) {
        const element = getElement("dashboardDiagnostic");

        if (!element) {
            return;
        }

        element.textContent = message;

        element.classList.remove(
            "is-success",
            "is-warning",
            "is-error"
        );

        if (type) {
            element.classList.add(`is-${type}`);
        }
    }


    function getErrorMessage(error) {
        if (!error) {
            return "Unknown error";
        }

        if (typeof error === "string") {
            return error;
        }

        if (error.message) {
            return error.message;
        }

        return "Unknown error";
    }


    /* =====================================================
       TOTAL USERS
    ====================================================== */

    async function loadTotalUsers(client) {

        const result = await client
            .from("profiles")
            .select("id", {
                count: "exact",
                head: true
            });


        if (result.error) {
            throw new Error(
                `Total Users: ${getErrorMessage(result.error)}`
            );
        }


        return Number(result.count || 0);
    }


    /* =====================================================
       ACTIVE USERS
    ====================================================== */

    async function loadActiveUsers(client) {

        const result = await client
            .from("profiles")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq("status", "active");


        if (result.error) {
            throw new Error(
                `Active Users: ${getErrorMessage(result.error)}`
            );
        }


        return Number(result.count || 0);
    }


    /* =====================================================
       TOTAL GENERATIONS
    ====================================================== */

    async function loadTotalGenerations(client) {

        const result = await client
            .from("generation_history")
            .select("id", {
                count: "exact",
                head: true
            });


        if (result.error) {
            throw new Error(
                `Total Generations: ${getErrorMessage(result.error)}`
            );
        }


        return Number(result.count || 0);
    }


    /* =====================================================
       TOTAL CREDITS
    ====================================================== */

    async function loadTotalCredits(client) {

        const result = await client
            .from("profiles")
            .select("credits");


        if (result.error) {
            throw new Error(
                `Total Credits: ${getErrorMessage(result.error)}`
            );
        }


        const rows = Array.isArray(result.data)
            ? result.data
            : [];


        let total = 0;


        for (const row of rows) {

            if (!row) {
                continue;
            }


            const credits = Number(row.credits);


            if (!Number.isFinite(credits)) {
                continue;
            }


            total += credits;
        }


        return total;
    }


    /* =====================================================
       UPDATE UI
    ====================================================== */

    function updateUI(data) {

        setText(
            "totalUsers",
            formatNumber(data.totalUsers)
        );


        setText(
            "activeUsers",
            formatNumber(data.activeUsers)
        );


        setText(
            "totalGenerations",
            formatNumber(data.totalGenerations)
        );


        setText(
            "totalCredits",
            formatCredits(data.totalCredits)
        );
    }


    /* =====================================================
       LOADING STATE
    ====================================================== */

    function setLoading(isLoading) {

        state.loading = Boolean(isLoading);


        const grid = getElement("statsGrid");

        if (!grid) {
            return;
        }


        grid.classList.toggle(
            "is-loading",
            state.loading
        );
    }


    /* =====================================================
       LOAD
    ====================================================== */

    async function load(options = {}) {

        if (state.loading) {
            return false;
        }


        const auth = getAuth();


        if (
            auth &&
            typeof auth.init === "function" &&
            !auth.state?.initialized
        ) {
            try {
                await auth.init();
            } catch (error) {
                setDiagnostic(
                    `Auth error: ${getErrorMessage(error)}`,
                    "error"
                );

                return false;
            }
        }


        const client = getClient();


        if (!client) {

            setDiagnostic(
                "Supabase client belum tersedia.",
                "error"
            );

            return false;
        }


        setLoading(true);


        try {

            /*
             * Semua statistik dijalankan paralel.
             *
             * Tidak mengubah database.
             * Hanya membaca data.
             */

            const results = await Promise.allSettled([

                loadTotalUsers(client),

                loadActiveUsers(client),

                loadTotalGenerations(client),

                loadTotalCredits(client)

            ]);


            const [
                totalUsersResult,
                activeUsersResult,
                totalGenerationsResult,
                totalCreditsResult
            ] = results;


            const errors = [];


            /*
             * Nilai yang berhasil tetap ditampilkan
             * walaupun salah satu query gagal.
             */

            const data = {
                totalUsers: 0,
                activeUsers: 0,
                totalGenerations: 0,
                totalCredits: 0
            };


            if (
                totalUsersResult.status === "fulfilled"
            ) {
                data.totalUsers =
                    totalUsersResult.value;
            } else {
                errors.push(
                    totalUsersResult.reason
                );
            }


            if (
                activeUsersResult.status === "fulfilled"
            ) {
                data.activeUsers =
                    activeUsersResult.value;
            } else {
                errors.push(
                    activeUsersResult.reason
                );
            }


            if (
                totalGenerationsResult.status === "fulfilled"
            ) {
                data.totalGenerations =
                    totalGenerationsResult.value;
            } else {
                errors.push(
                    totalGenerationsResult.reason
                );
            }


            if (
                totalCreditsResult.status === "fulfilled"
            ) {
                data.totalCredits =
                    totalCreditsResult.value;
            } else {
                errors.push(
                    totalCreditsResult.reason
                );
            }


            updateUI(data);


            state.initialized = true;
            state.lastLoadedAt = Date.now();


            if (errors.length === 0) {

                setDiagnostic(
                    "Dashboard statistics updated.",
                    "success"
                );

            } else {

                setDiagnostic(
                    `${errors.length} statistik gagal dimuat.`,
                    "warning"
                );

                console.warn(
                    "[GENZDashboardStats]",
                    "Partial statistics failure:",
                    errors
                );
            }


            return true;

        } catch (error) {

            console.error(
                "[GENZDashboardStats]",
                error
            );


            setDiagnostic(
                getErrorMessage(error),
                "error"
            );


            return false;

        } finally {

            setLoading(false);
        }
    }


    /* =====================================================
       REFRESH
    ====================================================== */

    async function refresh() {
        return load({
            refresh: true
        });
    }


    /* =====================================================
       INIT
    ====================================================== */

    async function init() {

        if (state.initialized) {
            return true;
        }


        return load({
            initial: true
        });
    }


    /* =====================================================
       GETTERS
    ====================================================== */

    function getState() {
        return {
            ...state
        };
    }


    /* =====================================================
       PUBLIC API
    ====================================================== */

    window.GENZDashboardStats = {

        state,

        init,

        load,

        refresh,

        getState,

        formatNumber,

        formatCredits

    };


})();
