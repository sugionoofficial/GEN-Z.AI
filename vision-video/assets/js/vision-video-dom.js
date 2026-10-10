/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-dom.js

   Fungsi:
   - Centralized DOM references
   - Tidak membuat elemen baru
   - Tidak mengubah struktur HTML
   - Semua modul Vision Video menggunakan DOM registry ini
   - Mendukung registry key maupun CSS selector langsung

   UPDATE (2026-10-10):
   - Tambah key `language` untuk dropdown Output Language
========================================================= */

const GENZVisionVideoDOM = (() => {

    "use strict";


    /* =====================================================
       INTERNAL
    ===================================================== */

    let elements = null;


    /* =====================================================
       ELEMENT DEFINITIONS
    ===================================================== */

    const SELECTORS = Object.freeze({

        /* -------------------------------------------------
           PAGE
        ------------------------------------------------- */

        page:
            "#visionVideoPage",


        /* -------------------------------------------------
           CREDIT
        ------------------------------------------------- */

        creditBadge:
            "#visionVideoCreditBadge",

        creditValue:
            "#visionVideoCreditValue",


        /* -------------------------------------------------
           VIDEO SOURCE
        ------------------------------------------------- */

        sourceCard:
            "#visionVideoSourceCard",

        dropzone:
            "#visionVideoDropzone",

        fileInput:
            "#visionVideoFileInput",

        uploadState:
            "#visionVideoUploadState",

        browseButton:
            "#visionVideoBrowseButton",

        previewState:
            "#visionVideoPreviewState",

        preview:
            "#visionVideoPreview",

        fileName:
            "#visionVideoFileName",

        fileSize:
            "#visionVideoFileSize",

        duration:
            "#visionVideoDuration",

        resolution:
            "#visionVideoResolution",

        fps:
            "#visionVideoFPS",

        removeButton:
            "#visionVideoRemoveButton",


        /* -------------------------------------------------
           SETTINGS
        ------------------------------------------------- */

        settingsCard:
            "#visionVideoSettingsCard",

        model:
            "#visionVideoModel",

        detail:
            "#visionVideoDetail",

        frameMode:
            "#visionVideoFrameMode",

        purpose:
            "#visionVideoPurpose",

        language:
            "#visionVideoLanguage",

        instruction:
            "#visionVideoInstruction",


        /* -------------------------------------------------
           ACTION
        ------------------------------------------------- */

        actionCard:
            "#visionVideoActionCard",

        creditNotice:
            "#visionVideoCreditNotice",

        analyzeButton:
            "#visionVideoAnalyzeButton",

        analyzeButtonText:
            "#visionVideoAnalyzeButtonText",

        analyzeSpinner:
            "#visionVideoAnalyzeSpinner",


        /* -------------------------------------------------
           STATUS
        ------------------------------------------------- */

        status:
            "#visionVideoStatus",

        statusIndicator:
            "#visionVideoStatusIndicator",

        statusText:
            "#visionVideoStatusText",

        progress:
            "#visionVideoProgress",

        progressBar:
            "#visionVideoProgressBar",

        progressText:
            "#visionVideoProgressText",


        /* -------------------------------------------------
           PROMPT
        ------------------------------------------------- */

        promptContainer:
            "#visionVideoPromptContainer",

        promptPlaceholder:
            "#visionVideoPromptPlaceholder",

        promptResult:
            "#visionVideoPromptResult",

        copyButton:
            "#visionVideoCopyButton",


        /* -------------------------------------------------
           ANALYSIS
        ------------------------------------------------- */

        analysisCard:
            "#visionVideoAnalysisCard",

        analysisResult:
            "#visionVideoAnalysisResult",

        analysisPlaceholder:
            "#visionVideoAnalysisPlaceholder",

        analysisCopyButton:
            "#visionVideoAnalysisCopyButton",


        /* -------------------------------------------------
           STRUCTURE
        ------------------------------------------------- */

        structureCard:
            "#visionVideoStructureCard",

        sceneStructure:
            "#visionVideoSceneStructure",

        sceneCount:
            "#visionVideoSceneCount",

        subject:
            "#visionVideoSubject",

        camera:
            "#visionVideoCamera",

        motion:
            "#visionVideoMotion",

        environment:
            "#visionVideoEnvironment",

        lighting:
            "#visionVideoLighting"

    });


    /* =====================================================
       RESOLVE SELECTOR
       -----------------------------------------------------
       Mendukung dua bentuk pemanggilan:
       
       1. Registry key:
          get("model")
          get("fileInput")
          get("analyzeButton")

       2. CSS selector:
          get("#visionVideoModel")
          get(".some-class")
          get("[data-test]")
       
       Jika string cocok dengan key SELECTORS,
       gunakan selector dari registry.

       Jika tidak cocok, gunakan string tersebut
       sebagai CSS selector biasa.
    ===================================================== */

    function resolveSelector(
        selector
    ) {

        if (
            typeof selector !== "string" ||
            !selector
        ) {

            return null;

        }


        if (
            Object.prototype.hasOwnProperty.call(
                SELECTORS,
                selector
            )
        ) {

            return SELECTORS[
                selector
            ];

        }


        return selector;

    }


    /* =====================================================
       GET ELEMENT
    ===================================================== */

    function get(selector) {

        const resolvedSelector =
            resolveSelector(
                selector
            );


        if (
            !resolvedSelector
        ) {

            return null;

        }


        return document.querySelector(
            resolvedSelector
        );

    }


    /* =====================================================
       BUILD REGISTRY
    ===================================================== */

    function build() {

        elements = {};

        for (
            const [key, selector]
            of Object.entries(SELECTORS)
        ) {

            elements[key] =
                get(selector);

        }

        return elements;

    }


    /* =====================================================
       ENSURE
    ===================================================== */

    function ensure() {

        if (!elements) {

            build();

        }

        return elements;

    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function refresh() {

        return build();

    }


    /* =====================================================
       REQUIRED ELEMENTS
    ===================================================== */

    function getRequiredElements() {

        const registry =
            ensure();

        const required = {

            page:
                registry.page,

            dropzone:
                registry.dropzone,

            fileInput:
                registry.fileInput,

            uploadState:
                registry.uploadState,

            browseButton:
                registry.browseButton,

            previewState:
                registry.previewState,

            preview:
                registry.preview,

            removeButton:
                registry.removeButton,

            model:
                registry.model,

            detail:
                registry.detail,

            frameMode:
                registry.frameMode,

            purpose:
                registry.purpose,

            language:
                registry.language,

            instruction:
                registry.instruction,

            analyzeButton:
                registry.analyzeButton,

            analyzeButtonText:
                registry.analyzeButtonText,

            analyzeSpinner:
                registry.analyzeSpinner,

            status:
                registry.status,

            statusIndicator:
                registry.statusIndicator,

            statusText:
                registry.statusText,

            progressBar:
                registry.progressBar,

            progressText:
                registry.progressText,

            promptContainer:
                registry.promptContainer,

            promptPlaceholder:
                registry.promptPlaceholder,

            promptResult:
                registry.promptResult,

            copyButton:
                registry.copyButton,

            analysisResult:
                registry.analysisResult,

            analysisPlaceholder:
                registry.analysisPlaceholder

        };

        return required;

    }


    /* =====================================================
       MISSING REQUIRED ELEMENTS
    ===================================================== */

    function getMissingRequiredElements() {

        const required =
            getRequiredElements();

        return Object.entries(required)

            .filter(
                ([, element]) =>
                    !element
            )

            .map(
                ([key]) =>
                    key
            );

    }


    /* =====================================================
       VALIDATE
    ===================================================== */

    function validate() {

        const missing =
            getMissingRequiredElements();

        if (missing.length > 0) {

            console.error(
                "[GEN-Z.AI Vision Video] Missing DOM elements:",
                missing
            );

            return false;

        }

        return true;

    }


    /* =====================================================
       VALUE
    ===================================================== */

    function value(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return "";

        }

        return element.value ?? "";

    }


    /* =====================================================
       SET VALUE
    ===================================================== */

    function setValue(
        key,
        value
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.value =
            value ?? "";

        return true;

    }


    /* =====================================================
       TEXT
    ===================================================== */

    function text(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return "";

        }

        return element.textContent || "";

    }


    /* =====================================================
       SET TEXT
    ===================================================== */

    function setText(
        key,
        value
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.textContent =
            value ?? "";

        return true;

    }


    /* =====================================================
       SHOW
    ===================================================== */

    function show(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.hidden = false;

        return true;

    }


    /* =====================================================
       HIDE
    ===================================================== */

    function hide(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.hidden = true;

        return true;

    }


    /* =====================================================
       TOGGLE
    ===================================================== */

    function toggle(
        key,
        visible
    ) {

        return visible
            ? show(key)
            : hide(key);

    }


    /* =====================================================
       ENABLE
    ===================================================== */

    function enable(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.disabled = false;

        return true;

    }


    /* =====================================================
       DISABLE
    ===================================================== */

    function disable(key) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.disabled = true;

        return true;

    }


    /* =====================================================
       SET ATTRIBUTE
    ===================================================== */

    function setAttribute(
        key,
        attribute,
        value
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.setAttribute(
            attribute,
            value
        );

        return true;

    }


    /* =====================================================
       REMOVE ATTRIBUTE
    ===================================================== */

    function removeAttribute(
        key,
        attribute
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.removeAttribute(
            attribute
        );

        return true;

    }


    /* =====================================================
       CLASS ADD
    ===================================================== */

    function addClass(
        key,
        className
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.classList.add(
            className
        );

        return true;

    }


    /* =====================================================
       CLASS REMOVE
    ===================================================== */

    function removeClass(
        key,
        className
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        element.classList.remove(
            className
        );

        return true;

    }


    /* =====================================================
       CLASS TOGGLE
    ===================================================== */

    function toggleClass(
        key,
        className,
        force
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (!element) {

            return false;

        }

        return element.classList.toggle(
            className,
            force
        );

    }


    /* =====================================================
       EVENT LISTENER
    ===================================================== */

    function on(
        key,
        event,
        handler,
        options
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (
            !element ||
            typeof handler !== "function"
        ) {

            return false;

        }

        element.addEventListener(
            event,
            handler,
            options
        );

        return true;

    }


    /* =====================================================
       REMOVE EVENT LISTENER
    ===================================================== */

    function off(
        key,
        event,
        handler,
        options
    ) {

        const registry =
            ensure();

        const element =
            registry[key];

        if (
            !element ||
            typeof handler !== "function"
        ) {

            return false;

        }

        element.removeEventListener(
            event,
            handler,
            options
        );

        return true;

    }


    /* =====================================================
       RAW QUERY
    ===================================================== */

    function query(selector) {

        return get(selector);

    }


    /* =====================================================
       SELECTOR REGISTRY
    ===================================================== */

    function selectors() {

        return {
            ...SELECTORS
        };

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    return Object.freeze({

        build,

        ensure,

        refresh,

        get,

        query,

        validate,

        getRequiredElements,

        getMissingRequiredElements,

        value,

        setValue,

        text,

        setText,

        show,

        hide,

        toggle,

        enable,

        disable,

        setAttribute,

        removeAttribute,

        addClass,

        removeClass,

        toggleClass,

        on,

        off,

        selectors

    });

})();


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionVideoDOM =
    GENZVisionVideoDOM;


/* =========================================================
   READY FLAG
========================================================= */

window.GENZVisionVideoDOMReady =
    true;


/* =========================================================
   DEBUG
========================================================= */

console.info(
    "[GEN-Z.AI Vision Video] DOM module ready."
);
