/* =========================================================
   GEN-Z.AI
   USER DASHBOARD CONFIG
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-config.js

   Tanggung jawab:
   - Konfigurasi dashboard
   - Nama tabel Supabase
   - Storage bucket
   - Batas ukuran file
   - Daftar kategori
   - Aspect ratio
   - Referensi elemen DOM

   Tidak bertanggung jawab:
   - Auth
   - Query Supabase
   - Render video
   - Upload
   - CRUD
   - Event listener
   - Modal lifecycle
========================================================= */

(function () {
    "use strict";

    window.GENZDashboard = window.GENZDashboard || {};

    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = {

        /* -------------------------------------------------
           SUPABASE
        ------------------------------------------------- */

        tables: {
            videos: "dashboard_videos",
            profiles: "profiles"
        },

        storage: {
            bucket: "dashboard-videos"
        },


        /* -------------------------------------------------
           UPLOAD LIMITS
           Bytes
        ------------------------------------------------- */

        upload: {
            maxVideoSize: 500 * 1024 * 1024,
            maxThumbnailSize: 10 * 1024 * 1024
        },


        /* -------------------------------------------------
           DEFAULT VALUES
        ------------------------------------------------- */

        defaults: {
            category: "TEXT TO VIDEO",
            aspectRatio: "16:9",
            sortOrder: 0,
            isActive: true
        },


        /* -------------------------------------------------
           CATEGORIES
        ------------------------------------------------- */

        categories: [
            {
                value: "all",
                label: "ALL"
            },
            {
                value: "TEXT TO VIDEO",
                label: "TEXT TO VIDEO"
            },
            {
                value: "IMAGE TO VIDEO",
                label: "IMAGE TO VIDEO"
            },
            {
                value: "CHARACTER",
                label: "CHARACTER"
            },
            {
                value: "PRODUCT",
                label: "PRODUCT"
            },
            {
                value: "FASHION",
                label: "FASHION"
            },
            {
                value: "CINEMATIC",
                label: "CINEMATIC"
            },
            {
                value: "SOCIAL MEDIA",
                label: "SOCIAL MEDIA"
            },
            {
                value: "STORY",
                label: "STORY"
            }
        ],


        /* -------------------------------------------------
           ASPECT RATIOS
        ------------------------------------------------- */

        aspectRatios: [
            "16:9",
            "9:16",
            "1:1",
            "4:5"
        ],


        /* -------------------------------------------------
           DATABASE SELECT
           
           Sengaja dipusatkan di config agar apabila schema
           berubah, kita tidak perlu membongkar seluruh modul.
        ------------------------------------------------- */

        videoSelect: [
            "id",
            "title",
            "description",
            "category",
            "aspect_ratio",
            "video_path",
            "thumbnail_path",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at"
        ].join(","),


        /* -------------------------------------------------
           REDIRECT
        ------------------------------------------------- */

        routes: {
            login: "../login.html",
            dashboard: "./dashboard.html",
            generate: "../generate/index.html",
            adminPanel: "../admin-control/admin-panel.html"
        },


        /* -------------------------------------------------
           EDIT MODE
        ------------------------------------------------- */

        editModeQueryParameter: "edit",


        /* -------------------------------------------------
           DOM IDS
           
           Semua modul mengambil elemen melalui object ini.
           Tidak perlu document.getElementById() berulang-ulang
           di setiap file.
        ------------------------------------------------- */

        elements: {

            /* Page */
            page: "dashboardPage",

            /* Header */
            header: "dashboardHeader",
            title: "dashboardTitle",
            subtitle: "dashboardSubtitle",
            actions: "dashboardActions",

            /* Buttons */
            generateButton: "generateButton",
            addVideoButton: "addVideoButton",
            retryVideoButton: "retryVideoButton",
            adminBackButton: "adminBackButton",

            /* Edit mode */
            editModeBanner: "editModeBanner",

            /* Stats */
            dashboardStats: "dashboardStats",
            totalVideoCount: "totalVideoCount",
            activeVideoCount: "activeVideoCount",
            categoryCount: "categoryCount",

            /* Filters */
            categorySection: "categorySection",
            categoryFilters: "categoryFilters",
            videoResultLabel: "videoResultLabel",

            /* Video */
            videoSection: "videoSection",
            videoGrid: "videoGrid",
            videoLoading: "videoLoading",
            videoEmpty: "videoEmpty",
            videoError: "videoError",
            videoErrorMessage: "videoErrorMessage",

            /* Modal */
            videoModal: "videoModal",
            modalTitle: "modalTitle",
            modalClose: "modalClose",
            cancelModalButton: "cancelModalButton",

            /* Form */
            videoForm: "videoForm",
            videoId: "videoId",
            videoTitle: "videoTitle",
            videoDescription: "videoDescription",
            videoCategory: "videoCategory",
            videoAspectRatio: "videoAspectRatio",
            videoFile: "videoFile",
            thumbnailFile: "thumbnailFile",
            videoSortOrder: "videoSortOrder",
            videoIsActive: "videoIsActive",

            /* Existing files */
            currentVideoFile: "currentVideoFile",
            currentThumbnailFile: "currentThumbnailFile",

            /* Save */
            saveVideoButton: "saveVideoButton",

            /* Upload */
            uploadProgress: "uploadProgress",
            uploadProgressPercent: "uploadProgressPercent",
            uploadProgressBar: "uploadProgressBar",
            uploadProgressText: "uploadProgressText",

            /* Toast */
            dashboardToast: "dashboardToast",
            dashboardToastMessage: "dashboardToastMessage"
        }
    };


    /* =====================================================
       DOM CACHE
    ===================================================== */

    function cacheElements() {

        const elements = {};

        Object.keys(CONFIG.elements).forEach(function (key) {

            const id = CONFIG.elements[key];

            elements[key] = document.getElementById(id);

        });

        return elements;
    }


    /* =====================================================
       EDIT MODE
    ===================================================== */

    function isEditMode() {

        const params = new URLSearchParams(
            window.location.search
        );

        return (
            params.get(CONFIG.editModeQueryParameter) === "1"
        );
    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function getCategoryLabel(value) {

        const category = CONFIG.categories.find(function (item) {

            return item.value === value;

        });

        return category
            ? category.label
            : value || "-";
    }


    function getCategoryValues() {

        return CONFIG.categories
            .filter(function (item) {
                return item.value !== "all";
            })
            .map(function (item) {
                return item.value;
            });
    }


    function isVideoFile(file) {

        return !!(
            file &&
            typeof file.type === "string" &&
            file.type.startsWith("video/")
        );
    }


    function isImageFile(file) {

        return !!(
            file &&
            typeof file.type === "string" &&
            file.type.startsWith("image/")
        );
    }


    function formatFileSize(bytes) {

        if (!Number.isFinite(bytes) || bytes <= 0) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        let size = bytes;
        let index = 0;

        while (
            size >= 1024 &&
            index < units.length - 1
        ) {
            size /= 1024;
            index++;
        }

        const decimals =
            index === 0
                ? 0
                : size >= 10
                    ? 1
                    : 2;

        return (
            size.toFixed(decimals) +
            " " +
            units[index]
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZDashboard.config = CONFIG;

    window.GENZDashboard.cacheElements = cacheElements;

    window.GENZDashboard.isEditMode = isEditMode;

    window.GENZDashboard.getCategoryLabel = getCategoryLabel;

    window.GENZDashboard.getCategoryValues = getCategoryValues;

    window.GENZDashboard.isVideoFile = isVideoFile;

    window.GENZDashboard.isImageFile = isImageFile;

    window.GENZDashboard.formatFileSize = formatFileSize;


    /* =====================================================
       CONFIG READY FLAG
    ===================================================== */

    window.GENZDashboard.configReady = true;

})();
