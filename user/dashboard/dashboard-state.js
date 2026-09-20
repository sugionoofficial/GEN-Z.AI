/* =========================================================
   GEN-Z.AI
   USER DASHBOARD STATE
   ---------------------------------------------------------
   File:
   user/dashboard/dashboard-state.js

   Tanggung jawab:
   - Menyimpan seluruh state dashboard
   - Menyediakan getter/setter state
   - Menjaga state tetap terpusat

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

    window.GENZDashboard = window.GENZDashboard || {};


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


    /* =====================================================
       AUTH STATE
    ===================================================== */

    function setCurrentUser(user) {

        state.currentUser = user || null;

        state.isAuthenticated = !!user;
    }


    function getCurrentUser() {

        return state.currentUser;
    }


    function setCurrentProfile(profile) {

        state.currentProfile = profile || null;

        const role = normalizeRole(
            profile && profile.role
        );

        state.role = role || null;

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
            normalizeRole(role);

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

        state.editMode = value === true;
    }


    function isEditMode() {

        return state.editMode;
    }


    function setInitialized(value) {

        state.initialized = value === true;
    }


    function isInitialized() {

        return state.initialized;
    }


    /* =====================================================
       LOADING
    ===================================================== */

    function setLoading(value) {

        state.loading = value === true;
    }


    function isLoading() {

        return state.loading;
    }


    function setSaving(value) {

        state.saving = value === true;
    }


    function isSaving() {

        return state.saving;
    }


    function setDeleting(value) {

        state.deleting = value === true;
    }


    function isDeleting() {

        return state.deleting;
    }


    /* =====================================================
       VIDEO STATE
    ===================================================== */

    function setVideos(videos) {

        state.videos = cloneArray(videos);
    }


    function getVideos() {

        return state.videos;
    }


    function addVideo(video) {

        if (!video) {
            return;
        }

        state.videos.push(video);
    }


    function updateVideo(videoId, updatedVideo) {

        if (!videoId || !updatedVideo) {
            return false;
        }

        const index =
            state.videos.findIndex(function (video) {

                return String(video.id) ===
                    String(videoId);

            });

        if (index === -1) {
            return false;
        }

        state.videos[index] = {
            ...state.videos[index],
            ...updatedVideo
        };

        return true;
    }


    function removeVideo(videoId) {

        if (!videoId) {
            return false;
        }

        const oldLength =
            state.videos.length;

        state.videos =
            state.videos.filter(function (video) {

                return String(video.id) !==
                    String(videoId);

            });

        return (
            state.videos.length !== oldLength
        );
    }


    function clearVideos() {

        state.videos = [];
    }


    function setActiveCategory(category) {

        state.activeCategory =
            typeof category === "string" &&
            category.trim()
                ? category
                : "all";
    }


    function getActiveCategory() {

        return state.activeCategory;
    }


    function setSelectedVideoId(videoId) {

        state.selectedVideoId =
            videoId || null;
    }


    function getSelectedVideoId() {

        return state.selectedVideoId;
    }


    function getVideoById(videoId) {

        if (!videoId) {
            return null;
        }

        return (
            state.videos.find(function (video) {

                return String(video.id) ===
                    String(videoId);

            }) || null
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
            Number.isFinite(progress)
                ? Math.max(
                    0,
                    Math.min(100, progress)
                )
                : 0;

        state.uploadProgressText =
            typeof text === "string"
                ? text
                : "";
    }


    function isUploadInProgress() {

        return state.uploadInProgress;
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

        state.error = null;
    }


    /* =====================================================
       RESET
    ===================================================== */

    function resetTransientState() {

        state.selectedVideoId = null;

        state.modalOpen = false;

        state.modalMode = null;

        state.saving = false;

        state.deleting = false;

        state.uploadInProgress = false;

        state.uploadProgress = 0;

        state.uploadProgressText = "";

        state.error = null;
    }


    function resetAll() {

        state.currentUser = null;

        state.currentProfile = null;

        state.role = null;

        state.isAuthenticated = false;

        state.isAdmin = false;

        state.isOwner = false;

        state.editMode = false;

        state.initialized = false;

        state.loading = false;

        state.saving = false;

        state.deleting = false;

        state.videos = [];

        state.activeCategory = "all";

        state.selectedVideoId = null;

        state.modalOpen = false;

        state.modalMode = null;

        state.uploadInProgress = false;

        state.uploadProgress = 0;

        state.uploadProgressText = "";

        state.error = null;

        state.toastTimer = null;
    }


    /* =====================================================
       SNAPSHOT
       Digunakan debugging tanpa memberikan akses langsung
       ke object state internal.
    ===================================================== */

    function getSnapshot() {

        return {
            currentUser: state.currentUser,
            currentProfile: state.currentProfile,
            role: state.role,

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
                cloneArray(state.videos),

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
       PUBLIC API
    ===================================================== */

    window.GENZDashboard.state = state;


    /* Auth */
    window.GENZDashboard.setCurrentUser =
        setCurrentUser;

    window.GENZDashboard.getCurrentUser =
        getCurrentUser;

    window.GENZDashboard.setCurrentProfile =
        setCurrentProfile;

    window.GENZDashboard.getCurrentProfile =
        getCurrentProfile;

    window.GENZDashboard.getRole =
        getRole;

    window.GENZDashboard.setRole =
        setRole;

    window.GENZDashboard.isAuthenticated =
        isAuthenticated;

    window.GENZDashboard.isAdmin =
        isAdmin;

    window.GENZDashboard.isOwner =
        isOwner;


    /* Page */
    window.GENZDashboard.setEditMode =
        setEditMode;

    window.GENZDashboard.isEditMode =
        isEditMode;

    window.GENZDashboard.setInitialized =
        setInitialized;

    window.GENZDashboard.isInitialized =
        isInitialized;


    /* Loading */
    window.GENZDashboard.setLoading =
        setLoading;

    window.GENZDashboard.isLoading =
        isLoading;

    window.GENZDashboard.setSaving =
        setSaving;

    window.GENZDashboard.isSaving =
        isSaving;

    window.GENZDashboard.setDeleting =
        setDeleting;

    window.GENZDashboard.isDeleting =
        isDeleting;


    /* Videos */
    window.GENZDashboard.setVideos =
        setVideos;

    window.GENZDashboard.getVideos =
        getVideos;

    window.GENZDashboard.addVideo =
        addVideo;

    window.GENZDashboard.updateVideo =
        updateVideo;

    window.GENZDashboard.removeVideo =
        removeVideo;

    window.GENZDashboard.clearVideos =
        clearVideos;

    window.GENZDashboard.setActiveCategory =
        setActiveCategory;

    window.GENZDashboard.getActiveCategory =
        getActiveCategory;

    window.GENZDashboard.setSelectedVideoId =
        setSelectedVideoId;

    window.GENZDashboard.getSelectedVideoId =
        getSelectedVideoId;

    window.GENZDashboard.getVideoById =
        getVideoById;


    /* Modal */
    window.GENZDashboard.setModalState =
        setModalState;

    window.GENZDashboard.isModalOpen =
        isModalOpen;

    window.GENZDashboard.getModalMode =
        getModalMode;


    /* Upload */
    window.GENZDashboard.setUploadState =
        setUploadState;

    window.GENZDashboard.isUploadInProgress =
        isUploadInProgress;

    window.GENZDashboard.getUploadProgress =
        getUploadProgress;

    window.GENZDashboard.getUploadProgressText =
        getUploadProgressText;


    /* Error */
    window.GENZDashboard.setError =
        setError;

    window.GENZDashboard.getError =
        getError;

    window.GENZDashboard.clearError =
        clearError;


    /* Reset */
    window.GENZDashboard.resetTransientState =
        resetTransientState;

    window.GENZDashboard.resetAll =
        resetAll;


    /* Debug */
    window.GENZDashboard.getSnapshot =
        getSnapshot;


    /* =====================================================
       READY FLAG
    ===================================================== */

    window.GENZDashboard.stateReady = true;

})();
