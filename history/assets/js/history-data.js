/* =========================================================
   GEN-Z.AI
   HISTORY DATA MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-data.js

   Tanggung jawab:
   - Query generation_history
   - Menyimpan hasil ke state
   - Helper data history
   - Filter data
   - Status aktif

   Tidak bertanggung jawab:
   - Render HTML
   - Modal
   - Event listener
   - Authentication
   - Polling provider status
========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    App.state = App.state || {
        supabaseClient: null,
        currentUser: null,
        currentProfile: null,
        historyData: [],
        currentFilter: "all",
        autoRefreshTimer: null,
        historyLoadInProgress: false,
        historyStatusSyncInProgress: false
    };

    App.config = App.config || {
        historyTable: "generation_history",
        activeStatuses: ["processing", "pending"]
    };

    if (typeof App.state.historyScope !== "string") {
        App.state.historyScope = "own";
    }

    if (typeof App.state.taskIdSearch !== "string") {
        App.state.taskIdSearch = "";
    }

    if (typeof App.state.historyLoadSequence !== "number") {
        App.state.historyLoadSequence = 0;
    }

    if (typeof App.state.historySearchTruncated !== "boolean") {
        App.state.historySearchTruncated = false;
    }

    /* =====================================================
       INTERNAL HELPERS
    ===================================================== */

    function getState() {
        return App.state;
    }

    function getSupabaseClient() {
        return getState().supabaseClient;
    }

    function getCurrentUser() {
        return getState().currentUser;
    }

    function getCurrentProfile() {
        return getState().currentProfile;
    }

    /* =====================================================
       ROLE
    ===================================================== */

    function normalizeRole(role) {
        return String(role || "")
            .trim()
            .toUpperCase();
    }

    function isAdminOrOwner() {
        const profile = getCurrentProfile();

        const role = normalizeRole(profile?.role);

        return role === "ADMIN" || role === "OWNER";
    }

    App.normalizeRole = normalizeRole;
    App.isAdminOrOwner = isAdminOrOwner;

    /* =====================================================
       CAKUPAN RIWAYAT & PENCARIAN TASK ID
       -----------------------------------------------------
       Admin/owner boleh memilih riwayat global atau pribadi.
       Role user selalu dipaksa ke riwayat pribadi, apa pun
       nilai state yang mungkin tersisa di browser.
    ===================================================== */

    const HISTORY_QUERY_LIMIT = 200;
    const TASK_ID_SEARCH_MAX_LENGTH = 256;

    function normalizeHistoryScope(scope) {
        const value = String(scope || "own").trim().toLowerCase();
        return value === "global" && isAdminOrOwner() ? "global" : "own";
    }

    function getHistoryScope() {
        return normalizeHistoryScope(getState().historyScope);
    }

    function setHistoryScope(scope) {
        const normalized = normalizeHistoryScope(scope);
        getState().historyScope = normalized;
        return normalized;
    }

    function normalizeTaskIdSearch(value) {
        return String(value || "")
            .trim()
            .slice(0, TASK_ID_SEARCH_MAX_LENGTH);
    }

    function getTaskIdSearch() {
        return normalizeTaskIdSearch(getState().taskIdSearch);
    }

    function setTaskIdSearch(value) {
        const normalized = normalizeTaskIdSearch(value);
        getState().taskIdSearch = normalized;
        return normalized;
    }

    /*
     * `%` dan `_` adalah wildcard LIKE/ILIKE. Escape supaya
     * Task ID yang mengandung karakter tersebut dicari harfiah.
     */
    function escapeLikePattern(value) {
        return String(value || "").replace(/[\\%_]/g, "\\$&");
    }

    function getHistoryQueryLimit() {
        return HISTORY_QUERY_LIMIT;
    }

    App.normalizeHistoryScope = normalizeHistoryScope;
    App.getHistoryScope = getHistoryScope;
    App.setHistoryScope = setHistoryScope;
    App.normalizeTaskIdSearch = normalizeTaskIdSearch;
    App.getTaskIdSearch = getTaskIdSearch;
    App.setTaskIdSearch = setTaskIdSearch;
    App.escapeLikePattern = escapeLikePattern;
    App.getHistoryQueryLimit = getHistoryQueryLimit;

    async function loadStatusCounts(client, currentUser, scope) {
        async function countRows(statuses) {
            let query = client
                .from(App.config.historyTable)
                .select("id", {
                    count: "exact",
                    head: true
                });

            if (scope !== "global") {
                query = query.eq("user_id", currentUser.id);
            }

            if (Array.isArray(statuses)) {
                query = query.in("status", statuses);
            } else if (statuses) {
                query = query.eq("status", statuses);
            }

            const { count, error } = await query;

            if (error) {
                console.error(
                    "History status count query error:",
                    error
                );

                throw new Error(
                    "Gagal menghitung status generation history: " +
                    error.message
                );
            }

            return Number(count) || 0;
        }

        const [all, success, processing, pending, failed, cancelled] =
            await Promise.all([
                countRows(),
                countRows(["success", "completed"]),
                countRows("processing"),
                countRows(["pending", "queued"]),
                countRows("failed"),
                countRows("cancelled")
            ]);

        return {
            all,
            success,
            processing,
            pending,
            failed,
            cancelled
        };
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function normalizeStatus(status) {
        const value = String(status || "pending")
            .trim()
            .toLowerCase();

        if (value === "completed") {
            return "success";
        }

        if (value === "queued") {
            return "pending";
        }

        return value;
    }

    function isActiveStatus(status) {
        const normalized = normalizeStatus(status);

        return (
            normalized === "processing" ||
            normalized === "pending"
        );
    }

    App.normalizeStatus = normalizeStatus;
    App.isActiveStatus = isActiveStatus;

    /* =====================================================
       PRIVATE MEDIA (output upscale di bucket privat)
       -----------------------------------------------------
       Output upscale disimpan di bucket privat
       `user-uploads` dan DB menyimpan referensi
       `supabase-private://<bucket>/<object-path>`.

       Halaman riwayat menukarnya menjadi signed URL lewat
       Supabase client. RLS hanya mengizinkan folder milik
       user sendiri (admin/owner boleh semua).
    ===================================================== */

    const PRIVATE_MEDIA_SCHEME =
        "supabase-private";

    const PRIVATE_MEDIA_TTL_SECONDS =
        60 * 60;

    const privateMediaCache =
        new Map();

    /*
     * Signed URL hanya berlaku 1 jam. Halaman riwayat bisa dibiarkan
     * terbuka lebih lama, jadi token diperbarui jauh sebelum habis.
     */
    const PRIVATE_MEDIA_REFRESH_MS =
        5 * 60 * 1000;

    /* =====================================================
       ANTI BANJIR REQUEST "Object not found"
       -----------------------------------------------------
       Laporan pengguna (02/11/2026): konsol halaman History
       dipenuhi ribuan POST 400 ke
       /storage/v1/object/sign/user-uploads/… disertai
       "Gagal membuat signed URL: … Object not found".

       Penyebabnya bukan file yang hilang secara misterius,
       melainkan tiga hal yang saling melipatgandakan:

       1. Cron retensi memang MENGHAPUS file itu (upload
          Generate 1 jam, media upscale 24 jam), tetapi baris
          riwayat menyimpan referensinya selamanya. Setiap
          reload mencoba menandatangani ulang file yang sudah
          pasti tidak ada.
       2. Kegagalan tidak pernah diingat. Hanya URL sukses yang
          masuk cache, jadi setiap auto-refresh/status-sync
          mengulang request yang sama persis.
       3. Satu request per referensi. 200 baris x 3 kolom =
          ratusan POST paralel, dan endpoint per-objek menjawab
          400 untuk file yang hilang sehingga browser mencetak
          satu error jaringan per file.

       Perbaikan:
       -Referensi yang lewat masa retensi tidak pernah
        ditandatangani lagi (hemat request, hasil tetap ditandai
        kedaluwarsa seperti sebelumnya).
       -Referensi yang gagal diingat sebentar (negative cache)
        supaya polling tidak menembak ulang file yang sama.
       -Penandatanganan digabung lewat `createSignedUrls`
        (batch). Endpoint batch menjawab 200 dengan status per
        file, jadi file hilang tidak lagi menjadi error 400 di
        konsol. Satu request menggantikan ratusan.
       -Request yang sama yang sedang berjalan dipakai bersama.
       -Log digabung menjadi satu baris ringkasan, bukan satu
        baris per file.
    ===================================================== */

    /** Upload halaman Generate dihapus cron setelah 1 jam. */
    const PRIVATE_MEDIA_UPLOAD_RETENTION_MS =
        60 * 60 * 1000;

    /** Media riwayat upscale (input + output) disimpan 24 jam. */
    const PRIVATE_MEDIA_HISTORY_RETENTION_MS =
        24 * 60 * 60 * 1000;

    /*
     * Toleransi jam server vs jam browser. Tanpa ini, baris yang
     * umurnya persis di batas retensi bisa dianggap kedaluwarsa
     * beberapa detik terlalu cepat.
     */
    const PRIVATE_MEDIA_RETENTION_GRACE_MS =
        5 * 60 * 1000;

    /**
     * Referensi yang gagal ditandatangani tidak dicoba lagi selama
     * jendela ini. Cukup pendek supaya hasil yang BARU selesai
     * (file belum terupload saat poll pertama) tetap muncul.
     */
    const PRIVATE_MEDIA_MISSING_RETRY_MS =
        60 * 1000;

    /** Batas request paralel saat memakai endpoint per-objek. */
    const PRIVATE_MEDIA_MAX_CONCURRENCY =
        6;

    /** Ukuran satu request batch `createSignedUrls`. */
    const PRIVATE_MEDIA_BATCH_SIZE =
        50;

    /** Batas jumlah entri cache supaya memori tidak tumbuh terus. */
    const PRIVATE_MEDIA_CACHE_LIMIT =
        2000;

    /** ref -> { at } untuk file yang terbukti tidak ada. */
    const privateMediaMissing =
        new Map();

    /** ref -> Promise<string> untuk request yang sedang berjalan. */
    const privateMediaInFlight =
        new Map();

    /** Referensi yang sudah pernah dilaporkan ke konsol. */
    const privateMediaMissingLogged =
        new Set();

    /*
     * Bila server ternyata tidak menyediakan endpoint batch, ingat
     * dan pakai jalur per-objek untuk sisa sesi. Tanpa ini, satu
     * ketidaktersediaan route akan mengosongkan semua thumbnail.
     */
    let privateMediaBatchUnsupported = false;

    /*
     * Kolom yang bisa berisi referensi media privat.
     * `result_url`       = hasil upscale
     * `image_reference_url` / `video_reference_url` = input yang dipakai
     */
    const PRIVATE_MEDIA_FIELDS = [
        "result_url",
        "image_reference_url",
        "video_reference_url"
    ];


    function parsePrivateMediaRef(value) {

        const raw =
            String(value || "")
                .trim();

        if (
            !raw
                .toLowerCase()
                .startsWith(PRIVATE_MEDIA_SCHEME + "://")
        ) {

            return null;
        }

        const rest =
            raw.slice(
                PRIVATE_MEDIA_SCHEME.length + 3
            );

        const slash =
            rest.indexOf("/");

        if (slash <= 0) {
            return null;
        }

        const bucket =
            rest.slice(0, slash).trim();

        const objectPath =
            rest.slice(slash + 1).trim();

        if (
            !bucket ||
            !objectPath ||
            objectPath.includes("..")
        ) {

            return null;
        }

        return {
            bucket,
            objectPath
        };
    }


    function isPrivateMediaRef(value) {

        return Boolean(
            parsePrivateMediaRef(value)
        );
    }


    /**
     * Masa simpan file sesuai aturan cron retensi
     * (lib/storage-retention/cleanup.js). Nilai 0 berarti prefix
     * tidak dikelola cron, jadi umurnya tidak boleh ditebak.
     */
    function getPrivateMediaRetentionMs(parsed) {

        const objectPath =
            String(parsed?.objectPath || "");

        if (
            objectPath.startsWith("generate-input/") ||
            objectPath.startsWith("generate-inputs/")
        ) {

            return PRIVATE_MEDIA_UPLOAD_RETENTION_MS;
        }

        if (
            objectPath.startsWith("upscale-photos/") ||
            objectPath.startsWith("upscale-videos/") ||
            objectPath.startsWith("outputs/")
        ) {

            return PRIVATE_MEDIA_HISTORY_RETENTION_MS;
        }

        return 0;
    }


    function getPrivateMediaItemCreatedAt(item) {

        const raw =
            item?.created_at ||
            item?.createdAt ||
            "";

        if (!raw) {
            return 0;
        }

        const created =
            new Date(raw).getTime();

        return Number.isFinite(created) && created > 0
            ? created
            : 0;
    }


    /**
     * File sudah pasti dihapus cron retensi. Referensi seperti ini
     * tidak perlu dikirim ke Storage API lagi — jawabannya akan
     * selalu "Object not found".
     */
    function isPrivateMediaRetentionExpired(ref, item) {

        const parsed =
            parsePrivateMediaRef(ref);

        if (!parsed) {
            return false;
        }

        const retention =
            getPrivateMediaRetentionMs(parsed);

        if (!retention) {
            return false;
        }

        const created =
            getPrivateMediaItemCreatedAt(item);

        if (!created) {
            return false;
        }

        return (
            Date.now() - created >=
            retention + PRIVATE_MEDIA_RETENTION_GRACE_MS
        );
    }


    function trimPrivateMediaCache(cache) {

        if (cache.size <= PRIVATE_MEDIA_CACHE_LIMIT) {
            return;
        }

        const excess =
            cache.size - PRIVATE_MEDIA_CACHE_LIMIT;

        let removed = 0;

        for (const key of cache.keys()) {

            cache.delete(key);
            removed++;

            if (removed >= excess) {
                break;
            }
        }
    }


    function rememberPrivateMediaUrl(ref, url) {

        privateMediaCache.set(
            ref,
            {
                url,
                expiresAt:
                    Date.now() +
                    (PRIVATE_MEDIA_TTL_SECONDS - 60) * 1000
            }
        );

        privateMediaMissing.delete(ref);
        trimPrivateMediaCache(privateMediaCache);
    }


    function rememberPrivateMediaMissing(refs) {

        const list =
            Array.isArray(refs) ? refs : [refs];

        const now =
            Date.now();

        const fresh = [];

        list.forEach(ref => {

            if (!ref) {
                return;
            }

            privateMediaCache.delete(ref);

            privateMediaMissing.set(ref, { at: now });

            if (!privateMediaMissingLogged.has(ref)) {
                privateMediaMissingLogged.add(ref);
                fresh.push(ref);
            }
        });

        trimPrivateMediaCache(privateMediaMissing);
        trimPrivateMediaCache(privateMediaMissingLogged);

        return fresh;
    }


    function isPrivateMediaMissingCached(ref) {

        const entry =
            privateMediaMissing.get(ref);

        if (!entry) {
            return false;
        }

        if (
            Date.now() - entry.at >=
            PRIVATE_MEDIA_MISSING_RETRY_MS
        ) {

            privateMediaMissing.delete(ref);
            return false;
        }

        return true;
    }


    /**
     * Satu ringkasan per gelombang, bukan satu warning per file.
     * Hanya referensi yang BARU diketahui hilang yang dicatat, jadi
     * auto-refresh tidak mengulang pesan yang sama.
     */
    function logPrivateMediaMissing(freshRefs, reason) {

        if (!freshRefs.length) {
            return;
        }

        const sample =
            freshRefs
                .slice(0, 3)
                .map(ref => {

                    const parsed =
                        parsePrivateMediaRef(ref);

                    return parsed?.objectPath || ref;
                })
                .join(", ");

        console.info(
            "[GEN-Z.AI History] " +
            freshRefs.length +
            " media privat tidak tersedia (" +
            reason +
            "), dilewati tanpa request ulang. Contoh: " +
            sample +
            (freshRefs.length > 3 ? ", …" : "")
        );
    }


    /** Jalankan task dengan batas paralel supaya tidak membanjiri API. */
    async function runPrivateMediaTasks(tasks, limit) {

        const results = [];
        let cursor = 0;

        const workers = [];
        const total =
            Math.min(
                Math.max(Number(limit) || 1, 1),
                tasks.length
            );

        for (let i = 0; i < total; i++) {

            workers.push(
                (async () => {

                    while (cursor < tasks.length) {

                        const index = cursor++;

                        results[index] =
                            await tasks[index]();
                    }
                })()
            );
        }

        await Promise.all(workers);

        return results;
    }


    /** Error yang berarti endpoint batch tidak tersedia di server. */
    function isPrivateMediaBatchRouteError(error) {

        const status =
            Number(error?.status || error?.statusCode || 0);

        return (
            status === 404 ||
            status === 405 ||
            status === 501
        );
    }


    /**
     * Tanda tangani satu per satu. Dipakai oleh client lama yang
     * belum punya `createSignedUrls`, dan sebagai jaring pengaman
     * bila endpoint batch tidak tersedia di server.
     */
    async function signPrivateMediaEntriesIndividually(api, entries, signed) {

        await runPrivateMediaTasks(
            entries.map(entry => async () => {

                try {

                    const {
                        data,
                        error
                    } = await api.createSignedUrl(
                        entry.objectPath,
                        PRIVATE_MEDIA_TTL_SECONDS
                    );

                    const url =
                        error ? "" : (data?.signedUrl || "");

                    if (url) {

                        rememberPrivateMediaUrl(entry.ref, url);
                        signed.set(entry.ref, url);

                    } else {

                        signed.set(entry.ref, "");

                        logPrivateMediaMissing(
                            rememberPrivateMediaMissing([entry.ref]),
                            error?.message || "Object not found"
                        );
                    }

                } catch (err) {

                    signed.set(entry.ref, "");

                    logPrivateMediaMissing(
                        rememberPrivateMediaMissing([entry.ref]),
                        err?.message || "request gagal"
                    );
                }
            }),
            PRIVATE_MEDIA_MAX_CONCURRENCY
        );
    }


    /**
     * Tanda tangani banyak referensi sekaligus.
     *
     * `createSignedUrls` (batch) dipakai bila tersedia: satu POST
     * untuk puluhan path, dan file yang hilang dilaporkan sebagai
     * status per path di dalam respons 200 — bukan error 400 per
     * file. Client lama/test double tetap jalan lewat jalur
     * per-objek dengan batas paralel.
     */
    async function requestPrivateMediaSignatures(client, refs) {

        const signed =
            new Map();

        const byBucket =
            new Map();

        refs.forEach(ref => {

            const parsed =
                parsePrivateMediaRef(ref);

            if (!parsed) {
                signed.set(ref, "");
                return;
            }

            if (!byBucket.has(parsed.bucket)) {
                byBucket.set(parsed.bucket, []);
            }

            byBucket.get(parsed.bucket).push({
                ref,
                objectPath: parsed.objectPath
            });
        });

        const batches = [];

        byBucket.forEach((entries, bucket) => {

            for (
                let offset = 0;
                offset < entries.length;
                offset += PRIVATE_MEDIA_BATCH_SIZE
            ) {

                batches.push({
                    bucket,
                    entries:
                        entries.slice(
                            offset,
                            offset + PRIVATE_MEDIA_BATCH_SIZE
                        )
                });
            }
        });

        await runPrivateMediaTasks(
            batches.map(batch => async () => {

                const api =
                    client.storage.from(batch.bucket);

                if (
                    !privateMediaBatchUnsupported &&
                    typeof api.createSignedUrls === "function"
                ) {

                    try {

                        const {
                            data,
                            error
                        } = await api.createSignedUrls(
                            batch.entries.map(entry => entry.objectPath),
                            PRIVATE_MEDIA_TTL_SECONDS
                        );

                        if (error || !Array.isArray(data)) {

                            /*
                             * Route batch tidak ada / tidak diizinkan
                             * (404/405/501): bukan file yang hilang.
                             * Coba lagi lewat jalur per-objek supaya
                             * media yang masih hidup tetap tampil.
                             */
                            if (isPrivateMediaBatchRouteError(error)) {

                                privateMediaBatchUnsupported = true;

                                await signPrivateMediaEntriesIndividually(
                                    api,
                                    batch.entries,
                                    signed
                                );

                                return;
                            }

                            /*
                             * Kegagalan seluruh batch (mis. sesi
                             * kedaluwarsa) bukan bukti file hilang.
                             * Tetap dicatat sebentar supaya polling
                             * tidak menembak ulang detik itu juga.
                             */
                            const failed =
                                rememberPrivateMediaMissing(
                                    batch.entries.map(entry => entry.ref)
                                );

                            logPrivateMediaMissing(
                                failed,
                                error?.message || "request batch gagal"
                            );

                            batch.entries.forEach(entry => {
                                signed.set(entry.ref, "");
                            });

                            return;
                        }

                        const byPath =
                            new Map();

                        data.forEach(entry => {

                            if (entry && typeof entry.path === "string") {
                                byPath.set(entry.path, entry);
                            }
                        });

                        const missing = [];

                        batch.entries.forEach(entry => {

                            const result =
                                byPath.get(entry.objectPath);

                            const url =
                                result?.signedUrl || "";

                            if (url) {

                                rememberPrivateMediaUrl(entry.ref, url);
                                signed.set(entry.ref, url);

                            } else {

                                missing.push(entry.ref);
                                signed.set(entry.ref, "");
                            }
                        });

                        logPrivateMediaMissing(
                            rememberPrivateMediaMissing(missing),
                            "sudah dihapus / tidak dapat diakses"
                        );

                        return;

                    } catch (err) {

                        const failed =
                            rememberPrivateMediaMissing(
                                batch.entries.map(entry => entry.ref)
                            );

                        logPrivateMediaMissing(
                            failed,
                            err?.message || "request batch gagal"
                        );

                        batch.entries.forEach(entry => {
                            signed.set(entry.ref, "");
                        });

                        return;
                    }
                }

                /* Jalur per-objek untuk client tanpa API batch. */
                await signPrivateMediaEntriesIndividually(
                    api,
                    batch.entries,
                    signed
                );
            }),
            PRIVATE_MEDIA_MAX_CONCURRENCY
        );

        return signed;
    }


    /**
     * Gabungkan request yang sedang berjalan supaya auto-refresh,
     * status sync, dan pergantian scope tidak menandatangani file
     * yang sama berulang kali pada saat bersamaan.
     */
    function signPrivateMediaRefs(client, refs) {

        const unique = [];
        const seen =
            new Set();

        (Array.isArray(refs) ? refs : [refs])
            .forEach(ref => {

                if (
                    typeof ref === "string" &&
                    ref &&
                    !seen.has(ref)
                ) {

                    seen.add(ref);
                    unique.push(ref);
                }
            });

        const pending =
            unique.filter(ref => !privateMediaInFlight.has(ref));

        if (pending.length) {

            const request =
                requestPrivateMediaSignatures(client, pending)
                    .catch(() => new Map());

            pending.forEach(ref => {

                const shared =
                    request.then(signed => {

                        privateMediaInFlight.delete(ref);
                        return signed.get(ref) || "";
                    });

                privateMediaInFlight.set(ref, shared);
            });
        }

        return Promise.all(
            unique.map(ref =>
                privateMediaInFlight.get(ref) ||
                Promise.resolve(privateMediaCache.get(ref)?.url || "")
            )
        ).then(urls => {

            const signed =
                new Map();

            unique.forEach((ref, index) => {
                signed.set(ref, urls[index] || "");
            });

            return signed;
        });
    }


    async function signPrivateMediaUrl(
        client,
        ref,
        options = {}
    ) {

        const parsed =
            parsePrivateMediaRef(ref);

        if (!client || !parsed) {
            return "";
        }

        const cleanRef =
            String(ref).trim();

        const force =
            options.force === true;

        const cached =
            privateMediaCache.get(cleanRef);

        if (
            !force &&
            cached &&
            cached.expiresAt > Date.now()
        ) {

            return cached.url;
        }

        if (!force && isPrivateMediaMissingCached(cleanRef)) {
            return "";
        }

        const signed =
            await signPrivateMediaRefs(client, [cleanRef]);

        return signed.get(cleanRef) || "";
    }


    /**
     * Tulis hasil penandatanganan ke baris riwayat.
     *
     * Hanya `result_url` yang boleh menentukan status kedaluwarsa
     * MEDIA HASIL. Referensi input (foto/video acuan) memang dihapus
     * lebih cepat: upload di halaman Generate hanya disimpan 1 jam.
     * Gagal menandatangani referensi TIDAK berarti hasil generation
     * hilang, jadi baris riwayat tidak boleh ditandai kedaluwarsa
     * hanya karena itu.
     */
    function applyPrivateMediaUrl(item, field, url) {

        const previous =
            item[field];

        const previousExpired =
            field === "result_url"
                ? item.media_expired === true
                : item.reference_expired?.[field] === true;

        /*
         * Kosongkan kalau gagal: lebih baik UI menampilkan
         * placeholder daripada "supabase-private://" mentah.
         */
        item[field] =
            url || "";

        if (!url) {

            if (field === "result_url") {

                item.media_expired = true;

            } else {

                item.reference_expired =
                    item.reference_expired || {};

                item.reference_expired[field] = true;
            }

        } else if (field === "result_url") {

            delete item.media_expired;

        } else if (item.reference_expired) {

            delete item.reference_expired[field];
        }

        return (
            previous !== item[field] ||
            previousExpired !== Boolean(!url)
        );
    }


    async function resolvePrivateMediaRefs(items) {

        if (
            !Array.isArray(items) ||
            !items.length
        ) {

            return items;
        }

        const client =
            getSupabaseClient();

        if (!client) {
            return items;
        }

        const targets = [];
        const needed = [];
        const retentionExpired = [];

        items.forEach(item => {

            if (!item || typeof item !== "object") {
                return;
            }

            PRIVATE_MEDIA_FIELDS.forEach(field => {

                const ref =
                    item[field];

                if (
                    typeof ref !== "string" ||
                    !isPrivateMediaRef(ref)
                ) {

                    return;
                }

                const cleanRef =
                    ref.trim();

                /*
                 * Simpan referensi asli supaya bisa ditandatangani
                 * ulang saat token mendekati kedaluwarsa.
                 */
                item.__privateMediaRefs =
                    item.__privateMediaRefs || {};

                item.__privateMediaRefs[field] =
                    cleanRef;

                /*
                 * File yang sudah lewat masa retensi tidak dikirim
                 * ke Storage API: cron pasti sudah menghapusnya.
                 */
                if (isPrivateMediaRetentionExpired(cleanRef, item)) {

                    retentionExpired.push(cleanRef);
                    applyPrivateMediaUrl(item, field, "");
                    return;
                }

                targets.push({
                    item,
                    field,
                    ref: cleanRef
                });

                const cached =
                    privateMediaCache.get(cleanRef);

                if (
                    cached &&
                    cached.expiresAt > Date.now()
                ) {

                    applyPrivateMediaUrl(item, field, cached.url);
                    return;
                }

                if (isPrivateMediaMissingCached(cleanRef)) {

                    applyPrivateMediaUrl(item, field, "");
                    return;
                }

                needed.push(cleanRef);
            });
        });

        logPrivateMediaMissing(
            rememberPrivateMediaMissing(retentionExpired),
            "lewat masa simpan retensi"
        );

        if (needed.length) {

            const signed =
                await signPrivateMediaRefs(client, needed);

            targets.forEach(target => {

                if (target.item[target.field] !== target.ref) {
                    return;
                }

                const cached =
                    privateMediaCache.get(target.ref);

                if (
                    cached &&
                    cached.expiresAt > Date.now()
                ) {

                    applyPrivateMediaUrl(target.item, target.field, cached.url);
                    return;
                }

                applyPrivateMediaUrl(
                    target.item,
                    target.field,
                    signed.get(target.ref) || ""
                );
            });
        }

        ensurePrivateMediaWatch();

        return items;
    }

    /*
     * Perbarui signed URL yang mendekati kedaluwarsa tanpa reload
     * halaman. Hanya baris yang punya referensi tersimpan, dan
     * hanya file yang masih mungkin ada.
     */
    async function refreshPrivateMediaRefs() {

        const state =
            getState();

        const items =
            Array.isArray(state.historyData)
                ? state.historyData
                : [];

        const client =
            getSupabaseClient();

        if (!client || !items.length) {
            return false;
        }

        const now =
            Date.now();

        const targets = [];
        const needed = [];
        let changed = false;

        items.forEach(item => {

            const refs =
                item?.__privateMediaRefs;

            if (!refs || typeof refs !== "object") {
                return;
            }

            Object.entries(refs).forEach(([field, ref]) => {

                if (
                    typeof ref !== "string" ||
                    !isPrivateMediaRef(ref)
                ) {

                    return;
                }

                /*
                 * Sama seperti resolvePrivateMediaRefs: file yang
                 * sudah dihapus cron tidak ditandatangani ulang.
                 */
                if (isPrivateMediaRetentionExpired(ref, item)) {

                    if (applyPrivateMediaUrl(item, field, "")) {
                        changed = true;
                    }

                    return;
                }

                /*
                 * File yang baru saja terbukti tidak ada dilewati.
                 * Tanpa penjaga ini, timer 5 menit akan mengulang
                 * ratusan request "Object not found" selamanya.
                 */
                if (isPrivateMediaMissingCached(ref)) {
                    return;
                }

                const cached =
                    privateMediaCache.get(ref);

                const needsRefresh =
                    !cached ||
                    cached.expiresAt - now <=
                        PRIVATE_MEDIA_REFRESH_MS;

                if (!needsRefresh) {
                    return;
                }

                targets.push({ item, field, ref });
                needed.push(ref);
            });
        });

        if (!targets.length) {

            if (
                changed &&
                typeof App.renderHistory ===
                    "function"
            ) {

                App.renderHistory();
            }

            return changed;
        }

        const signed =
            await signPrivateMediaRefs(client, needed);

        targets.forEach(target => {

            const url =
                signed.get(target.ref) || "";

            if (applyPrivateMediaUrl(target.item, target.field, url)) {
                changed = true;
            }
        });

        if (
            changed &&
            typeof App.renderHistory ===
                "function"
        ) {

            App.renderHistory();
        }

        return changed;
    }

    App.refreshPrivateMediaRefs =
        refreshPrivateMediaRefs;


    let privateMediaWatchTimer = null;

    function ensurePrivateMediaWatch() {

        if (
            privateMediaWatchTimer ||
            typeof window === "undefined" ||
            typeof window.setInterval !==
                "function"
        ) {

            return;
        }

        privateMediaWatchTimer =
            window.setInterval(() => {

                refreshPrivateMediaRefs()
                    .catch(() => {});

            }, PRIVATE_MEDIA_REFRESH_MS);
    }

    App.ensurePrivateMediaWatch =
        ensurePrivateMediaWatch;


    App.resolvePrivateMediaRefs =
        resolvePrivateMediaRefs;

    App.isPrivateMediaRef =
        isPrivateMediaRef;

    App.isPrivateMediaRetentionExpired =
        isPrivateMediaRetentionExpired;

    /* =====================================================
       LOAD HISTORY
    ===================================================== */

    async function loadHistory(options = {}) {

        const silent = options.silent === true;

        const state = getState();

        const client = getSupabaseClient();
        const currentUser = getCurrentUser();

        if (!client) {
            throw new Error(
                "Supabase client belum tersedia."
            );
        }

        if (!currentUser?.id) {
            throw new Error(
                "User session tidak tersedia."
            );
        }

        /*
         * Setiap request mendapat nomor urut. Scope/pencarian boleh
         * berubah saat request lama masih berjalan; hanya hasil
         * request terbaru yang boleh masuk ke state dan dirender.
         */
        const requestId =
            (Number(state.historyLoadSequence) || 0) + 1;

        state.historyLoadSequence = requestId;
        state.historyLoadInProgress = true;

        const scope = getHistoryScope();
        const taskIdSearch = getTaskIdSearch();

        try {

            /*
             * Loading UI hanya boleh dilakukan
             * ketika bukan silent refresh.
             *
             * Silent refresh dipakai oleh status sync
             * supaya halaman tidak berkedip.
             */
            if (!silent) {

                const elements =
                    App.elements || {};

                if (elements.loadingState) {
                    elements.loadingState.style.display =
                        "block";
                }

                if (elements.tableWrap) {
                    elements.tableWrap.style.display =
                        "none";
                }

                if (elements.emptyState) {
                    elements.emptyState.style.display =
                        "none";
                }

                if (
                    typeof App.hideMessage ===
                    "function"
                ) {
                    App.hideMessage();
                }
            }

            /*
             * Query generation history.
             *
             * Pencarian Task ID dilakukan di server sebelum LIMIT,
             * jadi task lama tetap ditemukan meskipun tidak masuk
             * 200 riwayat terbaru yang sedang ditampilkan.
             */
            let query = client
                .from(App.config.historyTable)
                .select("*")
                .order("created_at", {
                    ascending: false
                })
                .limit(HISTORY_QUERY_LIMIT);

            /*
             * Role user selalu dibatasi ke miliknya sendiri.
             * Admin/owner hanya melihat global bila memilih scope
             * "global"; default halaman adalah riwayat pribadi.
             * RLS Supabase tetap menjadi lapisan keamanan akhir.
             */
            if (scope !== "global") {
                query = query.eq(
                    "user_id",
                    currentUser.id
                );
            }

            if (taskIdSearch) {
                query = query.ilike(
                    "task_id",
                    `%${escapeLikePattern(taskIdSearch)}%`
                );
            }

            const [historyResult, statusCounts] =
                await Promise.all([
                    query,
                    loadStatusCounts(
                        client,
                        currentUser,
                        scope
                    )
                ]);

            const {
                data,
                error
            } = historyResult;

            /*
             * Abaikan respons lama bila pengguna sudah mengganti
             * scope atau kata kunci pencarian.
             */
            if (requestId !== state.historyLoadSequence) {
                return state.historyData;
            }

            if (error) {

                console.error(
                    "History query error:",
                    error
                );

                throw new Error(
                    "Gagal mengambil generation history: " +
                    error.message
                );
            }

            /*
             * Selalu normalisasi menjadi array.
             */
            state.historyData =
                Array.isArray(data)
                    ? data
                    : [];

            state.statusCounts =
                statusCounts;

            state.historySearchTruncated =
                Boolean(taskIdSearch) &&
                state.historyData.length >= HISTORY_QUERY_LIMIT;

            /*
             * Tukar referensi media privat menjadi signed URL
             * sebelum render supaya thumbnail langsung tampil.
             */
            await resolvePrivateMediaRefs(
                state.historyData
            );

            if (requestId !== state.historyLoadSequence) {
                return state.historyData;
            }

            /*
             * Render dilakukan oleh history-render.js.
             *
             * Kita sengaja tidak membuat ketergantungan
             * langsung ke fungsi render di sini.
             */
            if (
                typeof App.renderHistory ===
                "function"
            ) {
                App.renderHistory();
            }

            return state.historyData;

        } finally {

            if (requestId === state.historyLoadSequence) {
                state.historyLoadInProgress =
                    false;
            }
        }
    }

    App.loadHistory = loadHistory;

    /* =====================================================
       GET CURRENT HISTORY DATA
    ===================================================== */

    function getHistoryData() {

        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];
    }

    App.getHistoryData = getHistoryData;

    /* =====================================================
       FILTER
    ===================================================== */

    function setCurrentFilter(filter) {

        const normalized =
            String(filter || "all")
                .trim()
                .toLowerCase();

        const allowedFilters = [
            "all",
            "success",
            "processing",
            "pending",
            "failed",
            "cancelled"
        ];

        getState().currentFilter =
            allowedFilters.includes(normalized)
                ? normalized
                : "all";

        return getState().currentFilter;
    }

    function getCurrentFilter() {

        return (
            getState().currentFilter ||
            "all"
        );
    }

    function getFilteredHistory() {

        const data =
            getHistoryData();

        const filter =
            getCurrentFilter();

        const taskIdSearch =
            getTaskIdSearch().toLowerCase();

        return data.filter(item => {

            const status =
                normalizeStatus(
                    item?.status
                );

            const statusMatches =
                filter === "all" ||
                status === filter;

            if (!statusMatches) {
                return false;
            }

            if (!taskIdSearch) {
                return true;
            }

            /*
             * Query server sudah memakai ILIKE. Filter lokal ini
             * menjaga data lama tidak sempat tampil saat kata kunci
             * baru sedang dimuat, serta menggabungkan pencarian
             * dengan filter status yang sudah ada.
             */
            return getTaskId(item)
                .toLowerCase()
                .includes(taskIdSearch);
        });
    }

    App.setCurrentFilter =
        setCurrentFilter;

    App.getCurrentFilter =
        getCurrentFilter;

    App.getFilteredHistory =
        getFilteredHistory;

    /* =====================================================
       ACTIVE GENERATION
    ===================================================== */

    function hasActiveGeneration() {

        return getHistoryData()
            .some(item => {

                const status =
                    normalizeStatus(
                        item?.status
                    );

                return isActiveStatus(status);
            });
    }

    App.hasActiveGeneration =
        hasActiveGeneration;

    /* =====================================================
       RESULT URL
    ===================================================== */

    function getResultUrl(item) {

        if (!item) {
            return "";
        }

        const value =
            item.result_url;

        if (
            typeof value !== "string"
        ) {
            return "";
        }

        const url =
            value.trim();

        if (!url) {
            return "";
        }

        /*
         * Jangan izinkan javascript:
         * atau scheme berbahaya masuk
         * ke HTML media element.
         */
        const lower =
            url.toLowerCase();

        if (
            lower.startsWith(
                "javascript:"
            ) ||
            lower.startsWith(
                "data:text/html"
            )
        ) {
            return "";
        }

        /*
         * Referensi privat bukan URL yang bisa dimuat browser.
         * Kalau lolos ke <img src>/<video src>, browser menembak
         * "supabase-private://…" yang langsung gagal dan memicu
         * error "Gagal memuat aset" di monitoring.
         *
         * Baris yang belum sempat ditandatangani (mis. render awal
         * sebelum resolvePrivateMediaRefs selesai) harus menampilkan
         * placeholder, bukan URL mentah.
         */
        if (isPrivateMediaRef(url)) {
            return "";
        }

        return url;
    }

    App.getResultUrl =
        getResultUrl;

    /* =====================================================
       BASIC DATA HELPERS
    ===================================================== */

    function getTaskId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.task_id ||
            item.taskId ||
            ""
        ).trim();
    }

    function getModelId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.model_id ||
            item.modelId ||
            ""
        ).trim();
    }

    function getModelName(item) {

        if (!item) {
            return "";
        }

        return String(
            item.model_name ||
            item.modelName ||
            item.model ||
            ""
        ).trim();
    }

    function getProviderName(item) {

        if (!item) {
            return "";
        }

        return String(
            item.provider_name ||
            item.providerName ||
            item.provider ||
            ""
        ).trim();
    }

    function getPrompt(item) {

        if (!item) {
            return "";
        }

        return String(
            item.prompt ||
            item.input_prompt ||
            ""
        ).trim();
    }

    function getUserId(item) {

        if (!item) {
            return "";
        }

        return String(
            item.user_id ||
            ""
        ).trim();
    }

    function getCreditCost(item) {

        if (!item) {
            return 0;
        }

        const value =
            item.credit_cost ??
            item.credits_used ??
            item.cost ??
            0;

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    const AUDIO_COPYRIGHT_HISTORY_MESSAGE =
        "audio pada video/lagu yang anda upload terkena copyright, silahkan gunakan video/lagu yang lain, atau generate tanpa audio";

    const ASSET_PROCESSING_HISTORY_MESSAGE =
        "Gagal memproses media referensi di server provider (aset ditolak oleh validasi format/resolusi atau filter keamanan potret/audio). Silakan coba lagi atau gunakan video/gambar referensi lain (MP4 H.264 720p, durasi 2–15 detik). Kredit untuk proses yang gagal otomatis dikembalikan.";

    const ASSET_AUDIO_FORMAT_HISTORY_MESSAGE =
        "Format audio referensi tidak didukung oleh provider. Silakan gunakan file MP3 atau WAV, atau generate tanpa audio. Kredit untuk proses yang gagal otomatis dikembalikan.";

    const ASSET_VIDEO_FORMAT_HISTORY_MESSAGE =
        "Format atau spesifikasi video/gambar referensi tidak didukung oleh provider (gunakan MP4 H.264 720p, 24–60 FPS, durasi 2–15 detik). Kredit untuk proses yang gagal otomatis dikembalikan.";

    function formatHistoryErrorMessage(rawText) {
        const text = String(rawText || "").trim();
        if (!text) {
            return "";
        }
        if (
            /\b(?:Output|Input)?AudioSensitiveContentDetected\b/i.test(text) ||
            /\baudio[\s_-]*copyright\b/i.test(text) ||
            /\b(?:output|input)?\s*audio\s+may\s+be\s+related\s+to\s+copyright\b/i.test(text) ||
            (/\baudio\b/i.test(text) && /\bcopyright\s+restrictions?\b/i.test(text))
        ) {
            return AUDIO_COPYRIGHT_HISTORY_MESSAGE;
        }
        if (
            /\bAsset\s+asset-[a-z0-9-]+\s+finished\s+as\s+Failed\b/i.test(text) ||
            /\bCreateAsset\s+failed\b/i.test(text)
        ) {
            if (/\bUnsupported\s+audio\s+format\b/i.test(text)) {
                return ASSET_AUDIO_FORMAT_HISTORY_MESSAGE;
            }
            if (
                /\bUnsupported\s+(?:video|image)\s+format\b/i.test(text) ||
                /\bInvalidParameter\.(?:FormatUnsupported|ResolutionUnsupported|DurationOutOfRange|FrameRateOutOfRange)\b/i.test(text)
            ) {
                return ASSET_VIDEO_FORMAT_HISTORY_MESSAGE;
            }
            return ASSET_PROCESSING_HISTORY_MESSAGE;
        }
        return text
            .replace(/\s*A provider request may already have been submitted and charged\.?/gi, "")
            .trim();
    }

    function getErrorMessage(item) {

        if (!item) {
            return "";
        }

        return formatHistoryErrorMessage(
            item.error_message ||
            item.error ||
            item.message ||
            ""
        );
    }

    App.formatHistoryErrorMessage =
        formatHistoryErrorMessage;

    App.getTaskId =
        getTaskId;

    App.getModelId =
        getModelId;

    App.getModelName =
        getModelName;

    App.getProviderName =
        getProviderName;

    App.getPrompt =
        getPrompt;

    App.getUserId =
        getUserId;

    App.getCreditCost =
        getCreditCost;

    App.getErrorMessage =
        getErrorMessage;

    /* =====================================================
       CREATED / COMPLETED DATE
    ===================================================== */

    function getCreatedAt(item) {

        if (!item) {
            return null;
        }

        return (
            item.created_at ||
            item.createdAt ||
            null
        );
    }

    function getCompletedAt(item) {

        if (!item) {
            return null;
        }

        return (
            item.completed_at ||
            item.completedAt ||
            null
        );
    }

    App.getCreatedAt =
        getCreatedAt;

    App.getCompletedAt =
        getCompletedAt;

    /* =====================================================
       DATA LOOKUP
    ===================================================== */

    function findHistoryById(id) {

        const target =
            String(id || "").trim();

        if (!target) {
            return null;
        }

        return getHistoryData()
            .find(item => {

                return String(
                    item?.id || ""
                ).trim() === target;
            }) || null;
    }

    function findHistoryByTaskId(taskId) {

        const target =
            String(taskId || "").trim();

        if (!target) {
            return null;
        }

        return getHistoryData()
            .find(item => {

                return getTaskId(item) === target;
            }) || null;
    }

    App.findHistoryById =
        findHistoryById;

    App.findHistoryByTaskId =
        findHistoryByTaskId;

    /* =====================================================
       STATUS COUNTS
    ===================================================== */

    function getStatusCounts() {

        const loadedCounts =
            getState().statusCounts;

        if (loadedCounts) {
            return loadedCounts;
        }

        const counts = {
            all: 0,
            success: 0,
            processing: 0,
            pending: 0,
            failed: 0,
            cancelled: 0
        };

        const data =
            getHistoryData();

        counts.all =
            data.length;

        data.forEach(item => {

            const status =
                normalizeStatus(
                    item?.status
                );

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        counts,
                        status
                    )
            ) {
                counts[status]++;
            }
        });

        return counts;
    }

    App.getStatusCounts =
        getStatusCounts;

    /* =====================================================
       DEBUG / SAFE SNAPSHOT
    ===================================================== */

    function getDataSnapshot() {

        return {
            total:
                getHistoryData().length,

            filter:
                getCurrentFilter(),

            active:
                hasActiveGeneration(),

            counts:
                getStatusCounts()
        };
    }

    App.getDataSnapshot =
        getDataSnapshot;

})();
