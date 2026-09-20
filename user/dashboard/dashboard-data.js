/* =========================================================
   GEN-Z.AI
   USER DASHBOARD DATA MODULE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-data.js

   Tanggung jawab:
   - Query dashboard_videos
   - Load video
   - Create video
   - Update video
   - Delete video
   - Storage upload/delete
   - Public URL video & thumbnail

   Tidak bertanggung jawab:
   - Auth
   - Render UI
   - Modal
   - Event listener
========================================================= */

(function () {
    "use strict";

    window.GENZDashboard =
        window.GENZDashboard || {};

    const dashboard =
        window.GENZDashboard;


    /* =====================================================
       DEPENDENCY
    ===================================================== */

    function getClient() {

        if (
            typeof dashboard.requireSupabase ===
            "function"
        ) {
            return dashboard.requireSupabase();
        }

        if (
            window.supabaseClient
        ) {
            return window.supabaseClient;
        }

        if (
            window.GENZ_SUPABASE
        ) {
            return window.GENZ_SUPABASE;
        }

        throw new Error(
            "Supabase client belum tersedia."
        );
    }


    function getConfig() {

        if (!dashboard.config) {

            throw new Error(
                "Dashboard config belum tersedia."
            );
        }

        return dashboard.config;
    }


    /* =====================================================
       TABLE
    ===================================================== */

    function getVideoTable() {

        return getConfig()
            .tables
            .videos;
    }


    function getStorageBucket() {

        return getConfig()
            .storage
            .bucket;
    }


    /* =====================================================
       NORMALIZE VIDEO
    ===================================================== */

    function normalizeVideo(video) {

        if (!video) {
            return null;
        }

        return {
            id: video.id ?? null,

            title:
                typeof video.title === "string"
                    ? video.title
                    : "",

            description:
                typeof video.description === "string"
                    ? video.description
                    : "",

            category:
                typeof video.category === "string"
                    ? video.category
                    : "",

            aspect_ratio:
                typeof video.aspect_ratio === "string"
                    ? video.aspect_ratio
                    : "16:9",

            video_path:
                typeof video.video_path === "string"
                    ? video.video_path
                    : "",

            thumbnail_path:
                typeof video.thumbnail_path === "string"
                    ? video.thumbnail_path
                    : "",

            sort_order:
                Number.isFinite(
                    Number(video.sort_order)
                )
                    ? Number(video.sort_order)
                    : 0,

            is_active:
                video.is_active === true,

            created_at:
                video.created_at ?? null,

            updated_at:
                video.updated_at ?? null
        };
    }


    function normalizeVideos(videos) {

        if (!Array.isArray(videos)) {
            return [];
        }

        return videos
            .map(normalizeVideo)
            .filter(Boolean);
    }


    /* =====================================================
       PUBLIC STORAGE URL
    ===================================================== */

    function getPublicUrl(path) {

        if (
            !path ||
            typeof path !== "string"
        ) {
            return "";
        }

        const supabase =
            getClient();

        const result =
            supabase
                .storage
                .from(getStorageBucket())
                .getPublicUrl(path);

        return (
            result &&
            result.data &&
            result.data.publicUrl
        )
            ? result.data.publicUrl
            : "";
    }


    function attachPublicUrls(video) {

        if (!video) {
            return null;
        }

        return {
            ...video,

            video_url:
                getPublicUrl(
                    video.video_path
                ),

            thumbnail_url:
                getPublicUrl(
                    video.thumbnail_path
                )
        };
    }


    /* =====================================================
       LOAD VIDEOS
    ===================================================== */

    async function loadVideos(options = {}) {

        const supabase =
            getClient();

        const config =
            getConfig();


        /*
         * Edit mode hanya boleh digunakan jika auth module
         * sudah memberikan akses management.
         */

        const editMode =
            typeof dashboard.isEditMode === "function"
                ? dashboard.isEditMode()
                : false;

        const managementAccess =
            typeof dashboard.hasManagementAccess ===
            "function"
                ? dashboard.hasManagementAccess()
                : false;


        /*
         * Normal USER:
         * hanya video aktif.
         *
         * ADMIN / OWNER:
         * dapat melihat semua video ketika edit mode.
         */

        const includeInactive =
            options.includeInactive === true &&
            editMode &&
            managementAccess;


        let query =
            supabase
                .from(
                    config.tables.videos
                )
                .select(
                    config.videoSelect
                )
                .order(
                    "sort_order",
                    {
                        ascending: true,
                        nullsFirst: false
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (!includeInactive) {

            query =
                query.eq(
                    "is_active",
                    true
                );
        }


        const result =
            await query;


        if (result.error) {
            throw result.error;
        }


        const videos =
            normalizeVideos(
                result.data || []
            ).map(
                attachPublicUrls
            );


        dashboard.setVideos(
            videos
        );


        dashboard.clearError();


        return videos;
    }


    /* =====================================================
       GET SINGLE VIDEO
    ===================================================== */

    async function getVideo(videoId) {

        if (!videoId) {
            throw new Error(
                "Video ID tidak tersedia."
            );
        }

        const supabase =
            getClient();

        const config =
            getConfig();


        const result =
            await supabase
                .from(
                    config.tables.videos
                )
                .select(
                    config.videoSelect
                )
                .eq(
                    "id",
                    videoId
                )
                .maybeSingle();


        if (result.error) {
            throw result.error;
        }


        if (!result.data) {
            return null;
        }


        return attachPublicUrls(
            normalizeVideo(
                result.data
            )
        );
    }


    /* =====================================================
       VALIDATION
    ===================================================== */

    function validateTitle(title) {

        const value =
            typeof title === "string"
                ? title.trim()
                : "";

        if (!value) {

            throw new Error(
                "Judul video wajib diisi."
            );
        }

        if (value.length > 150) {

            throw new Error(
                "Judul video maksimal 150 karakter."
            );
        }

        return value;
    }


    function validateDescription(description) {

        if (
            description === null ||
            typeof description === "undefined"
        ) {
            return "";
        }

        const value =
            String(description).trim();

        if (value.length > 1000) {

            throw new Error(
                "Deskripsi maksimal 1000 karakter."
            );
        }

        return value;
    }


    function validateCategory(category) {

        const value =
            typeof category === "string"
                ? category.trim()
                : "";

        const categories =
            typeof dashboard.getCategoryValues ===
            "function"
                ? dashboard.getCategoryValues()
                : [];


        if (!value) {

            throw new Error(
                "Kategori video wajib dipilih."
            );
        }


        if (
            categories.length &&
            !categories.includes(value)
        ) {

            throw new Error(
                "Kategori video tidak valid."
            );
        }


        return value;
    }


    function validateAspectRatio(aspectRatio) {

        const value =
            typeof aspectRatio === "string"
                ? aspectRatio.trim()
                : "16:9";

        const ratios =
            getConfig()
                .aspectRatios || [];


        if (
            ratios.length &&
            !ratios.includes(value)
        ) {

            throw new Error(
                "Aspect ratio tidak valid."
            );
        }


        return value;
    }


    function validateSortOrder(sortOrder) {

        const value =
            Number(sortOrder);


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            return 0;
        }


        return Math.floor(value);
    }


    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateVideoFile(file) {

        if (!file) {
            return;
        }


        if (
            typeof dashboard.isVideoFile ===
            "function" &&
            !dashboard.isVideoFile(file)
        ) {

            throw new Error(
                "File video tidak valid."
            );
        }


        const maxSize =
            getConfig()
                .upload
                .maxVideoSize;


        if (
            Number(file.size) >
            maxSize
        ) {

            throw new Error(
                "Ukuran video terlalu besar. " +
                "Maksimal " +
                dashboard.formatFileSize(maxSize) +
                "."
            );
        }
    }


    function validateThumbnailFile(file) {

        if (!file) {
            return;
        }


        if (
            typeof dashboard.isImageFile ===
            "function" &&
            !dashboard.isImageFile(file)
        ) {

            throw new Error(
                "File thumbnail tidak valid."
            );
        }


        const maxSize =
            getConfig()
                .upload
                .maxThumbnailSize;


        if (
            Number(file.size) >
            maxSize
        ) {

            throw new Error(
                "Ukuran thumbnail terlalu besar. " +
                "Maksimal " +
                dashboard.formatFileSize(maxSize) +
                "."
            );
        }
    }


    /* =====================================================
       PATH GENERATOR
    ===================================================== */

    function getCurrentUserId() {

        const user =
            dashboard.getCurrentUser();

        if (
            !user ||
            !user.id
        ) {

            throw new Error(
                "User belum terautentikasi."
            );
        }

        return user.id;
    }


    function createSafeExtension(file, fallback) {

        if (
            !file ||
            typeof file.name !== "string"
        ) {
            return fallback;
        }


        const parts =
            file.name
                .split(".");


        if (parts.length < 2) {
            return fallback;
        }


        const extension =
            parts
                .pop()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );


        return extension || fallback;
    }


    function createUniqueName(file, fallback) {

        const extension =
            createSafeExtension(
                file,
                fallback
            );


        const randomPart =
            Math.random()
                .toString(36)
                .slice(2, 12);


        const timestamp =
            Date.now();


        return (
            timestamp +
            "-" +
            randomPart +
            "." +
            extension
        );
    }


    function createVideoPath(file) {

        const userId =
            getCurrentUserId();


        return (
            "videos/" +
            userId +
            "/" +
            createUniqueName(
                file,
                "mp4"
            )
        );
    }


    function createThumbnailPath(file) {

        const userId =
            getCurrentUserId();


        return (
            "thumbnails/" +
            userId +
            "/" +
            createUniqueName(
                file,
                "jpg"
            )
        );
    }


    /* =====================================================
       STORAGE UPLOAD
    ===================================================== */

    async function uploadFile(
        file,
        path,
        options = {}
    ) {

        if (!file) {
            return null;
        }


        const supabase =
            getClient();


        const result =
            await supabase
                .storage
                .from(getStorageBucket())
                .upload(
                    path,
                    file,
                    {
                        cacheControl:
                            options.cacheControl ||
                            "3600",

                        upsert:
                            false,

                        contentType:
                            file.type || undefined
                    }
                );


        if (result.error) {
            throw result.error;
        }


        return {
            path: path,
            fullPath:
                result.data &&
                result.data.fullPath
                    ? result.data.fullPath
                    : null
        };
    }


    /* =====================================================
       STORAGE DELETE
    ===================================================== */

    async function deleteStorageFiles(paths) {

        if (
            !Array.isArray(paths) ||
            paths.length === 0
        ) {
            return {
                success: true,
                removed: []
            };
        }


        const validPaths =
            paths.filter(function (path) {

                return (
                    typeof path === "string" &&
                    path.trim()
                );

            });


        if (!validPaths.length) {

            return {
                success: true,
                removed: []
            };
        }


        const supabase =
            getClient();


        const result =
            await supabase
                .storage
                .from(getStorageBucket())
                .remove(
                    validPaths
                );


        if (result.error) {
            throw result.error;
        }


        return {
            success: true,
            removed: validPaths
        };
    }


    /* =====================================================
       BUILD INSERT DATA
    ===================================================== */

    function buildInsertPayload(data) {

        const payload = {

            title:
                validateTitle(
                    data.title
                ),

            description:
                validateDescription(
                    data.description
                ),

            category:
                validateCategory(
                    data.category
                ),

            aspect_ratio:
                validateAspectRatio(
                    data.aspectRatio
                ),

            video_path:
                data.videoPath || null,

            thumbnail_path:
                data.thumbnailPath || null,

            sort_order:
                validateSortOrder(
                    data.sortOrder
                ),

            is_active:
                data.isActive !== false
        };


        return payload;
    }


    /* =====================================================
       BUILD UPDATE DATA
    ===================================================== */

    function buildUpdatePayload(data) {

        const payload = {

            title:
                validateTitle(
                    data.title
                ),

            description:
                validateDescription(
                    data.description
                ),

            category:
                validateCategory(
                    data.category
                ),

            aspect_ratio:
                validateAspectRatio(
                    data.aspectRatio
                ),

            sort_order:
                validateSortOrder(
                    data.sortOrder
                ),

            is_active:
                data.isActive !== false
        };


        /*
         * Path hanya dimasukkan jika file baru berhasil
         * di-upload. Dengan begitu edit metadata tidak
         * menghapus file lama.
         */

        if (
            data.videoPath
        ) {
            payload.video_path =
                data.videoPath;
        }


        if (
            data.thumbnailPath
        ) {
            payload.thumbnail_path =
                data.thumbnailPath;
        }


        return payload;
    }


    /* =====================================================
       CREATE VIDEO
    ===================================================== */

    async function createVideo(data) {

        if (
            !dashboard.isAdmin()
        ) {

            throw new Error(
                "Anda tidak memiliki akses untuk menambah video."
            );
        }


        if (
            !dashboard.isEditMode()
        ) {

            throw new Error(
                "Mode manajemen video tidak aktif."
            );
        }


        const supabase =
            getClient();

        const config =
            getConfig();


        let videoPath = null;

        let thumbnailPath = null;

        let uploadedPaths = [];


        try {

            /* ---------------------------------------------
               Validate files
            --------------------------------------------- */

            validateVideoFile(
                data.videoFile
            );

            validateThumbnailFile(
                data.thumbnailFile
            );


            /* ---------------------------------------------
               Video upload
            --------------------------------------------- */

            if (data.videoFile) {

                videoPath =
                    createVideoPath(
                        data.videoFile
                    );


                await uploadFile(
                    data.videoFile,
                    videoPath
                );


                uploadedPaths.push(
                    videoPath
                );
            }


            /* ---------------------------------------------
               Thumbnail upload
            --------------------------------------------- */

            if (data.thumbnailFile) {

                thumbnailPath =
                    createThumbnailPath(
                        data.thumbnailFile
                    );


                await uploadFile(
                    data.thumbnailFile,
                    thumbnailPath
                );


                uploadedPaths.push(
                    thumbnailPath
                );
            }


            /* ---------------------------------------------
               Insert database
            --------------------------------------------- */

            const payload =
                buildInsertPayload({
                    ...data,
                    videoPath:
                        videoPath,
                    thumbnailPath:
                        thumbnailPath
                });


            const result =
                await supabase
                    .from(
                        config.tables.videos
                    )
                    .insert(
                        payload
                    )
                    .select(
                        config.videoSelect
                    )
                    .single();


            if (result.error) {
                throw result.error;
            }


            const video =
                attachPublicUrls(
                    normalizeVideo(
                        result.data
                    )
                );


            dashboard.addVideo(
                video
            );


            return video;

        } catch (error) {

            /*
             * Jika database insert gagal setelah file sudah
             * ter-upload, bersihkan file agar tidak menjadi
             * orphan storage.
             */

            if (
                uploadedPaths.length
            ) {

                try {

                    await deleteStorageFiles(
                        uploadedPaths
                    );

                } catch (cleanupError) {

                    console.error(
                        "[GEN-Z.AI] Storage cleanup failed:",
                        cleanupError
                    );
                }
            }


            throw error;
        }
    }


    /* =====================================================
       UPDATE VIDEO
    ===================================================== */

    async function updateVideo(
        videoId,
        data
    ) {

        if (
            !dashboard.isAdmin()
        ) {

            throw new Error(
                "Anda tidak memiliki akses untuk mengedit video."
            );
        }


        if (
            !dashboard.isEditMode()
        ) {

            throw new Error(
                "Mode manajemen video tidak aktif."
            );
        }


        if (!videoId) {

            throw new Error(
                "Video ID tidak tersedia."
            );
        }


        const supabase =
            getClient();

        const config =
            getConfig();


        /*
         * Ambil data lama terlebih dahulu agar path storage
         * lama dapat dibersihkan jika file diganti.
         */

        const existing =
            await getVideo(
                videoId
            );


        if (!existing) {

            throw new Error(
                "Video tidak ditemukan."
            );
        }


        let newVideoPath = null;

        let newThumbnailPath = null;

        let uploadedPaths = [];


        try {

            /* ---------------------------------------------
               Validate new files
            --------------------------------------------- */

            validateVideoFile(
                data.videoFile
            );

            validateThumbnailFile(
                data.thumbnailFile
            );


            /* ---------------------------------------------
               New video
            --------------------------------------------- */

            if (data.videoFile) {

                newVideoPath =
                    createVideoPath(
                        data.videoFile
                    );


                await uploadFile(
                    data.videoFile,
                    newVideoPath
                );


                uploadedPaths.push(
                    newVideoPath
                );
            }


            /* ---------------------------------------------
               New thumbnail
            --------------------------------------------- */

            if (data.thumbnailFile) {

                newThumbnailPath =
                    createThumbnailPath(
                        data.thumbnailFile
                    );


                await uploadFile(
                    data.thumbnailFile,
                    newThumbnailPath
                );


                uploadedPaths.push(
                    newThumbnailPath
                );
            }


            /* ---------------------------------------------
               Update database
            --------------------------------------------- */

            const payload =
                buildUpdatePayload({
                    ...data,

                    videoPath:
                        newVideoPath,

                    thumbnailPath:
                        newThumbnailPath
                });


            const result =
                await supabase
                    .from(
                        config.tables.videos
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        videoId
                    )
                    .select(
                        config.videoSelect
                    )
                    .single();


            if (result.error) {
                throw result.error;
            }


            const updatedVideo =
                attachPublicUrls(
                    normalizeVideo(
                        result.data
                    )
                );


            dashboard.updateVideo(
                videoId,
                updatedVideo
            );


            /* ---------------------------------------------
               Cleanup old files
               Hanya setelah DB berhasil di-update.
            --------------------------------------------- */

            const oldPaths = [];


            if (
                newVideoPath &&
                existing.video_path
            ) {

                oldPaths.push(
                    existing.video_path
                );
            }


            if (
                newThumbnailPath &&
                existing.thumbnail_path
            ) {

                oldPaths.push(
                    existing.thumbnail_path
                );
            }


            if (oldPaths.length) {

                try {

                    await deleteStorageFiles(
                        oldPaths
                    );

                } catch (cleanupError) {

                    console.error(
                        "[GEN-Z.AI] Old storage cleanup failed:",
                        cleanupError
                    );
                }
            }


            return updatedVideo;

        } catch (error) {

            /*
             * Jika update database gagal setelah file baru
             * ter-upload, hapus file baru.
             */

            if (
                uploadedPaths.length
            ) {

                try {

                    await deleteStorageFiles(
                        uploadedPaths
                    );

                } catch (cleanupError) {

                    console.error(
                        "[GEN-Z.AI] New storage cleanup failed:",
                        cleanupError
                    );
                }
            }


            throw error;
        }
    }


    /* =====================================================
       DELETE VIDEO
    ===================================================== */

    async function deleteVideo(videoId) {

        if (
            !dashboard.isAdmin()
        ) {

            throw new Error(
                "Anda tidak memiliki akses untuk menghapus video."
            );
        }


        if (
            !dashboard.isEditMode()
        ) {

            throw new Error(
                "Mode manajemen video tidak aktif."
            );
        }


        if (!videoId) {

            throw new Error(
                "Video ID tidak tersedia."
            );
        }


        const supabase =
            getClient();

        const config =
            getConfig();


        /*
         * Ambil path sebelum row dihapus.
         */

        const existing =
            await getVideo(
                videoId
            );


        if (!existing) {

            throw new Error(
                "Video tidak ditemukan."
            );
        }


        /* -------------------------------------------------
           Delete database row terlebih dahulu.
        ------------------------------------------------- */

        const result =
            await supabase
                .from(
                    config.tables.videos
                )
                .delete()
                .eq(
                    "id",
                    videoId
                );


        if (result.error) {
            throw result.error;
        }


        /*
         * Database berhasil dihapus.
         * Baru bersihkan storage.
         *
         * Jika storage cleanup gagal, data database tetap
         * sudah benar dan error dicatat untuk debugging.
         */

        const storagePaths = [];


        if (
            existing.video_path
        ) {

            storagePaths.push(
                existing.video_path
            );
        }


        if (
            existing.thumbnail_path
        ) {

            storagePaths.push(
                existing.thumbnail_path
            );
        }


        if (
            storagePaths.length
        ) {

            try {

                await deleteStorageFiles(
                    storagePaths
                );

            } catch (storageError) {

                console.error(
                    "[GEN-Z.AI] Storage cleanup after delete failed:",
                    storageError
                );
            }
        }


        dashboard.removeVideo(
            videoId
        );


        return {
            success: true,
            id: videoId
        };
    }


    /* =====================================================
       SEARCH LOCAL VIDEO
       Tidak query Supabase.
       Digunakan oleh render/filter.
    ===================================================== */

    function filterVideos(
        videos,
        category
    ) {

        const source =
            Array.isArray(videos)
                ? videos
                : dashboard.getVideos();


        if (
            !category ||
            category === "all"
        ) {

            return source.slice();
        }


        return source.filter(
            function (video) {

                return (
                    String(
                        video.category || ""
                    ).toUpperCase() ===
                    String(category)
                        .toUpperCase()
                );

            }
        );
    }


    /* =====================================================
       SORT LOCAL VIDEO
    ===================================================== */

    function sortVideos(videos) {

        const source =
            Array.isArray(videos)
                ? videos.slice()
                : [];


        return source.sort(
            function (a, b) {

                const orderA =
                    Number(a.sort_order);


                const orderB =
                    Number(b.sort_order);


                if (
                    Number.isFinite(orderA) &&
                    Number.isFinite(orderB) &&
                    orderA !== orderB
                ) {

                    return orderA - orderB;
                }


                const dateA =
                    a.created_at
                        ? new Date(
                            a.created_at
                        ).getTime()
                        : 0;


                const dateB =
                    b.created_at
                        ? new Date(
                            b.created_at
                        ).getTime()
                        : 0;


                return dateB - dateA;
            }
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    dashboard.getVideoTable =
        getVideoTable;

    dashboard.getStorageBucket =
        getStorageBucket;

    dashboard.normalizeVideo =
        normalizeVideo;

    dashboard.normalizeVideos =
        normalizeVideos;

    dashboard.getPublicUrl =
        getPublicUrl;

    dashboard.attachPublicUrls =
        attachPublicUrls;

    dashboard.loadVideos =
        loadVideos;

    dashboard.getVideo =
        getVideo;

    dashboard.uploadFile =
        uploadFile;

    dashboard.deleteStorageFiles =
        deleteStorageFiles;

    dashboard.validateVideoFile =
        validateVideoFile;

    dashboard.validateThumbnailFile =
        validateThumbnailFile;

    dashboard.createVideo =
        createVideo;

    dashboard.updateVideo =
        updateVideo;

    dashboard.deleteVideo =
        deleteVideo;

    dashboard.filterVideos =
        filterVideos;

    dashboard.sortVideos =
        sortVideos;


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.dataReady = true;

})();
