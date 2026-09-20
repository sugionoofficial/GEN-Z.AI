/* =========================================================
   GEN-Z.AI
   USER DASHBOARD STATE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-state.js

   Tanggung jawab:
   - Menyimpan seluruh state dashboard
   - Menyediakan getter/setter state
   - Menentukan page mode dari URL
   - Menjaga state tetap terpusat
   - Menyediakan compatibility API untuk module lama

   Tidak bertanggung jawab:
   - Auth
   - Query Supabase
   - Render UI
   - Upload
   - CRUD
   - Event listener
   - Modal UI
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       NAMESPACE
    ===================================================== */

    window.GENZDashboard =
        window.GENZDashboard || {};

    const dashboard =
        window.GENZDashboard;


    /* =====================================================
       PRIVATE STATE
    ===================================================== */

    const state = {

        /* -------------------------------------------------
           AUTH
        ------------------------------------------------- */

        currentUser: null,

        currentProfile: null,

        role: null,

        isAuthenticated: false,

        isAdmin: false,

        isOwner: false,


        /* -------------------------------------------------
           PAGE MODE
        ------------------------------------------------- */

        editMode: false,

        initialized: false,

        loading: false,

        saving: false,

        deleting: false,


        /* -------------------------------------------------
           VIDEO DATA
        ------------------------------------------------- */

        videos: [],

        activeCategory: "all",

        selectedVideoId: null,


        /* -------------------------------------------------
           MODAL
        ------------------------------------------------- */

        modalOpen: false,

        modalMode: null,


        /* -------------------------------------------------
           UPLOAD
        ------------------------------------------------- */

        uploadInProgress: false,

        uploadProgress: 0,

        uploadProgressText: "",


        /* -------------------------------------------------
           ERROR
        ------------------------------------------------- */

        error: null,


        /* -------------------------------------------------
           TOAST
        ------------------------------------------------- */

        toastTimer: null
    };


    /* =====================================================
       INTERNAL HELPERS
    ===================================================== */

    function cloneArray(value) {

        return Array.isArray(value)
            ? value.slice()
            : [];
    }


    function normalizeRole(role) {

        if (
            typeof role !== "string"
        ) {

            return "";
        }


        return role
            .trim()
            .toUpperCase();
    }


    function readEditModeFromURL() {

        try {

            const params =
                new URLSearchParams(
                    window.location.search
                );


            const value =
                params.get("edit");


            if (
                value === null
            ) {

                return false;
            }


            return (
                value === "1" ||
                value === "true" ||
                value === "yes"
            );

        } catch (error) {

            return false;
        }
    }


    function normalizeProgress(value) {

        const numeric =
            Number(value);


        if (
            !Number.isFinite(
                numeric
            )
        ) {

            return 0;
        }


        return Math.max(
            0,
            Math.min(
                100,
                numeric
            )
        );
    }


    /* =====================================================
       AUTH STATE
    ===================================================== */

    function setCurrentUser(user) {

        state.currentUser =
            user || null;


        state.isAuthenticated =
            !!user;
    }


    function getCurrentUser() {

        return state.currentUser;
    }


    function setCurrentProfile(profile) {

        state.currentProfile =
            profile || null;


        const role =
            normalizeRole(
                profile &&
                profile.role
            );


        state.role =
            role || null;


        state.isAdmin =
            role === "ADMIN" ||
            role === "OWNER";


        state.isOwner =
            role === "OWNER";
    }


    function getCurrentProfile() {

        return state.currentProfile;
    }


    function getRole() {

        return state.role;
    }


    function setRole(role) {

        const normalizedRole =
            normalizeRole(
                role
            );


        state.role =
            normalizedRole || null;


        state.isAdmin =
            normalizedRole === "ADMIN" ||
            normalizedRole === "OWNER";


        state.isOwner =
            normalizedRole === "OWNER";
    }


    function isAuthenticated() {

        return state.isAuthenticated;
    }


    function isAdmin() {

        return state.isAdmin;
    }


    function isOwner() {

        return state.isOwner;
    }


    /* =====================================================
       PAGE MODE
    ===================================================== */

    function setEditMode(value) {

        state.editMode =
            value === true;


        return state.editMode;
    }


    function initializeEditMode() {

        /*
         * URL adalah sumber awal page mode.
         *
         * Authorization tetap ditentukan oleh
         * dashboard-auth.js.
         *
         * Jadi:
         *
         * ?edit=1
         *     =
         * requested edit mode
         *
         * bukan otomatis =
         * authorized edit mode.
         */

        state.editMode =
            readEditModeFromURL();


        return state.editMode;
    }


    function isEditMode() {

        return state.editMode === true;
    }


    function setInitialized(value) {

        state.initialized =
            value === true;
    }


    function isInitialized() {

        return state.initialized;
    }


    /* =====================================================
       LOADING
    ===================================================== */

    function setLoading(value) {

        state.loading =
            value === true;
    }


    function isLoading() {

        return state.loading;
    }


    function setSaving(value) {

        state.saving =
            value === true;
    }


    function isSaving() {

        return state.saving;
    }


    function setDeleting(value) {

        state.deleting =
            value === true;
    }


    function isDeleting() {

        return state.deleting;
    }


    /* =====================================================
       VIDEO STATE
    ===================================================== */

    function setVideos(videos) {

        state.videos =
            cloneArray(
                videos
            );
    }


    function getVideos() {

        return state.videos;
    }


    function addVideo(video) {

        if (!video) {

            return;
        }


        state.videos.push(
            video
        );
    }


    function updateVideo(
        videoId,
        updatedVideo
    ) {

        if (
            !videoId ||
            !updatedVideo
        ) {

            return false;
        }


        const index =
            state.videos.findIndex(
                function (video) {

                    return (
                        String(video.id) ===
                        String(videoId)
                    );

                }
            );


        if (
            index === -1
        ) {

            return false;
        }


        state.videos[index] = {

            ...state.videos[index],

            ...updatedVideo

        };


        return true;
    }


    function removeVideo(
        videoId
    ) {

        if (!videoId) {

            return false;
        }


        const oldLength =
            state.videos.length;


        state.videos =
            state.videos.filter(
                function (video) {

                    return (
                        String(video.id) !==
                        String(videoId)
                    );

                }
            );


        return (
            state.videos.length !==
            oldLength
        );
    }


    function clearVideos() {

        state.videos = [];
    }


    function setActiveCategory(
        category
    ) {

        state.activeCategory =
            typeof category === "string" &&
            category.trim()
                ? category.trim()
                : "all";
    }


    function getActiveCategory() {

        return state.activeCategory;
    }


    function setSelectedVideoId(
        videoId
    ) {

        state.selectedVideoId =
            videoId || null;
    }


    function getSelectedVideoId() {

        return state.selectedVideoId;
    }


    function getVideoById(
        videoId
    ) {

        if (!videoId) {

            return null;
        }


        return (
            state.videos.find(
                function (video) {

                    return (
                        String(video.id) ===
                        String(videoId)
                    );

                }
            ) || null
        );
    }


    /* =====================================================
       MODAL STATE
    ===================================================== */

    function setModalState(
        open,
        mode,
        videoId
    ) {

        state.modalOpen =
            open === true;


        state.modalMode =
            mode || null;


        state.selectedVideoId =
            videoId || null;
    }


    function isModalOpen() {

        return state.modalOpen;
    }


    function getModalMode() {

        return state.modalMode;
    }


    /* =====================================================
       UPLOAD STATE
    ===================================================== */

    function setUploadState(
        inProgress,
        progress,
        text
    ) {

        state.uploadInProgress =
            inProgress === true;


        state.uploadProgress =
            normalizeProgress(
                progress
            );


        state.uploadProgressText =
            typeof text === "string"
                ? text
                : "";
    }


    function setUploadInProgress(
        value
    ) {

        state.uploadInProgress =
            value === true;
    }


    function setUploadProgress(
        value
    ) {

        state.uploadProgress =
            normalizeProgress(
                value
            );
    }


    function setUploadProgressText(
        text
    ) {

        state.uploadProgressText =
            typeof text === "string"
                ? text
                : "";
    }


    function isUploadInProgress() {

        return (
            state.uploadInProgress === true
        );
    }


    function getUploadProgress() {

        return state.uploadProgress;
    }


    function getUploadProgressText() {

        return state.uploadProgressText;
    }


    /* =====================================================
       ERROR STATE
    ===================================================== */

    function setError(error) {

        state.error =
            error || null;
    }


    function getError() {

        return state.error;
    }


    function clearError() {

        state.error =
            null;
    }


    /* =====================================================
       RESET TRANSIENT STATE
    ===================================================== */

    function resetTransientState() {

        state.selectedVideoId =
            null;


        state.modalOpen =
            false;


        state.modalMode =
            null;


        state.saving =
            false;


        state.deleting =
            false;


        state.uploadInProgress =
            false;


        state.uploadProgress =
            0;


        state.uploadProgressText =
            "";


        state.error =
            null;
    }


    /* =====================================================
       RESET ALL
    ===================================================== */

    function resetAll() {

        state.currentUser =
            null;


        state.currentProfile =
            null;


        state.role =
            null;


        state.isAuthenticated =
            false;


        state.isAdmin =
            false;


        state.isOwner =
            false;


        state.editMode =
            false;


        state.initialized =
            false;


        state.loading =
            false;


        state.saving =
            false;


        state.deleting =
            false;


        state.videos =
            [];


        state.activeCategory =
            "all";


        state.selectedVideoId =
            null;


        state.modalOpen =
            false;


        state.modalMode =
            null;


        state.uploadInProgress =
            false;


        state.uploadProgress =
            0;


        state.uploadProgressText =
            "";


        state.error =
            null;


        state.toastTimer =
            null;
    }


    /* =====================================================
       SNAPSHOT
    ===================================================== */

    function getSnapshot() {

        return {

            currentUser:
                state.currentUser,

            currentProfile:
                state.currentProfile,

            role:
                state.role,

            isAuthenticated:
                state.isAuthenticated,

            isAdmin:
                state.isAdmin,

            isOwner:
                state.isOwner,

            editMode:
                state.editMode,

            initialized:
                state.initialized,

            loading:
                state.loading,

            saving:
                state.saving,

            deleting:
                state.deleting,

            videos:
                cloneArray(
                    state.videos
                ),

            activeCategory:
                state.activeCategory,

            selectedVideoId:
                state.selectedVideoId,

            modalOpen:
                state.modalOpen,

            modalMode:
                state.modalMode,

            uploadInProgress:
                state.uploadInProgress,

            uploadProgress:
                state.uploadProgress,

            uploadProgressText:
                state.uploadProgressText,

            error:
                state.error
        };
    }


    /* =====================================================
       PUBLIC STATE
    ===================================================== */

    dashboard.state =
        state;


    /* =====================================================
       AUTH API
    ===================================================== */

    dashboard.setCurrentUser =
        setCurrentUser;

    dashboard.getCurrentUser =
        getCurrentUser;

    dashboard.setCurrentProfile =
        setCurrentProfile;

    dashboard.getCurrentProfile =
        getCurrentProfile;

    dashboard.getRole =
        getRole;

    dashboard.setRole =
        setRole;

    dashboard.isAuthenticated =
        isAuthenticated;

    dashboard.isAdmin =
        isAdmin;

    dashboard.isOwner =
        isOwner;


    /* =====================================================
       PAGE API
    ===================================================== */

    dashboard.setEditMode =
        setEditMode;

    dashboard.initializeEditMode =
        initializeEditMode;

    dashboard.isEditMode =
        isEditMode;

    dashboard.setInitialized =
        setInitialized;

    dashboard.isInitialized =
        isInitialized;


    /* =====================================================
       LOADING API
    ===================================================== */

    dashboard.setLoading =
        setLoading;

    dashboard.isLoading =
        isLoading;

    dashboard.setSaving =
        setSaving;

    dashboard.isSaving =
        isSaving;

    dashboard.setDeleting =
        setDeleting;

    dashboard.isDeleting =
        isDeleting;


    /* =====================================================
       VIDEO API
    ===================================================== */

    dashboard.setVideos =
        setVideos;

    dashboard.getVideos =
        getVideos;

    dashboard.addVideo =
        addVideo;

    dashboard.updateVideo =
        updateVideo;

    dashboard.removeVideo =
        removeVideo;

    dashboard.clearVideos =
        clearVideos;

    dashboard.setActiveCategory =
        setActiveCategory;

    dashboard.getActiveCategory =
        getActiveCategory;

    dashboard.setSelectedVideoId =
        setSelectedVideoId;

    dashboard.getSelectedVideoId =
        getSelectedVideoId;

    dashboard.getVideoById =
        getVideoById;


    /* =====================================================
       MODAL API
    ===================================================== */

    dashboard.setModalState =
        setModalState;

    dashboard.isModalOpen =
        isModalOpen;

    dashboard.getModalMode =
        getModalMode;


    /* =====================================================
       UPLOAD API
    ===================================================== */

    dashboard.setUploadState =
        setUploadState;

    dashboard.setUploadInProgress =
        setUploadInProgress;

    dashboard.setUploadProgress =
        setUploadProgress;

    dashboard.setUploadProgressText =
        setUploadProgressText;

    dashboard.isUploadInProgress =
        isUploadInProgress;

    dashboard.getUploadProgress =
        getUploadProgress;

    dashboard.getUploadProgressText =
        getUploadProgressText;


    /* =====================================================
       ERROR API
    ===================================================== */

    dashboard.setError =
        setError;

    dashboard.getError =
        getError;

    dashboard.clearError =
        clearError;


    /* =====================================================
       RESET API
    ===================================================== */

    dashboard.resetTransientState =
        resetTransientState;

    dashboard.resetAll =
        resetAll;


    /* =====================================================
       DEBUG API
    ===================================================== */

    dashboard.getSnapshot =
        getSnapshot;


    /* =====================================================
       INITIALIZE PAGE MODE
    ===================================================== */

    /*
     * Jalankan setelah state API tersedia.
     *
     * Ini menggantikan fungsi isEditMode() milik
     * dashboard-config.js tanpa kehilangan nilai URL.
     */

    initializeEditMode();


    /* =====================================================
       READY FLAG
    ===================================================== */

    dashboard.stateReady =
        true;

})();
