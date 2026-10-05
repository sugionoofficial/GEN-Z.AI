/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-dom.js

   Fungsi:
   - Mengambil seluruh element DOM Vision
   - Menjadi single DOM registry
   - Validasi element wajib
   - Helper DOM sederhana

   Tidak menangani:
   - API
   - Supabase
   - Upload
   - Credit
   - History
   - Analysis
   - Prompt generation
========================================================= */


/* =========================================================
   DOM SELECTOR
========================================================= */

const VISION_DOM_IDS = Object.freeze({

    /* =====================================================
       PAGE
    ===================================================== */

    page:
        "visionPage",


    /* =====================================================
       CREDIT
    ===================================================== */

    creditBadge:
        "visionCreditBadge",

    creditValue:
        "visionCreditValue",


    /* =====================================================
       UPLOAD
    ===================================================== */

    dropzone:
        "visionDropzone",

    fileInput:
        "visionFileInput",

    browseButton:
        "visionBrowseButton",

    uploadState:
        "visionUploadState",

    previewState:
        "visionPreviewState",

    previewImage:
        "visionPreviewImage",

    /*
     * Sesuai dengan ID aktual di vision/index.html
     */
    previewName:
        "visionFileName",

    previewSize:
        "visionFileSize",

    removeButton:
        "visionRemoveButton",


    /* =====================================================
       FORM
    ===================================================== */

    model:
        "visionModel",

    detail:
        "visionDetail",

    purpose:
        "visionPurpose",

    instruction:
        "visionInstruction",


    /* =====================================================
       ACTION
    ===================================================== */

    generateButton:
        "visionGenerateButton",

    generateButtonText:
        "visionGenerateButtonText",

    generateSpinner:
        "visionGenerateSpinner",


    /* =====================================================
       STATUS
    ===================================================== */

    status:
        "visionStatus",

    statusIndicator:
        "visionStatusIndicator",

    statusText:
        "visionStatusText",

    progress:
        "visionProgress",

    progressBar:
        "visionProgressBar",

    progressText:
        "visionProgressText",


    /* =====================================================
       RESULT
    ===================================================== */

    promptPlaceholder:
        "visionPromptPlaceholder",

    promptResult:
        "visionPromptResult",

    copyButton:
        "visionCopyButton",

    analysisDetails:
        "visionAnalysisDetails",

    analysisResult:
        "visionAnalysisResult",

    promptContainer:
        "visionPromptContainer",

    creditNotice:
        "visionCreditNotice"

});


/* =========================================================
   REQUIRED ELEMENTS
========================================================= */

const VISION_REQUIRED_DOM_KEYS = Object.freeze([

    "page",

    "creditBadge",

    "creditValue",

    "dropzone",

    "fileInput",

    "browseButton",

    "uploadState",

    "previewState",

    "previewImage",

    "previewName",

    "previewSize",

    "removeButton",

    "model",

    "detail",

    "purpose",

    "instruction",

    "generateButton",

    "generateButtonText",

    "generateSpinner",

    "status",

    "statusIndicator",

    "statusText",

    "progress",

    "progressBar",

    "progressText",

    "promptPlaceholder",

    "promptResult",

    "copyButton",

    "analysisDetails",

    "analysisResult",

    "promptContainer",

    "creditNotice"

]);


/* =========================================================
   DOM CACHE
========================================================= */

let DOM = null;


/* =========================================================
   GET ELEMENT
========================================================= */

function getElement(
    id
) {

    if (
        !id ||
        typeof id !== "string"
    ) {

        return null;

    }


    return document.getElementById(
        id
    );

}


/* =========================================================
   BUILD DOM CACHE
========================================================= */

function buildDOM() {

    const elements = {};


    for (
        const [
            key,
            id
        ]
        of Object.entries(
            VISION_DOM_IDS
        )
    ) {

        elements[key] =
            getElement(
                id
            );

    }


    DOM =
        Object.freeze(
            elements
        );


    return DOM;

}


/* =========================================================
   CHECK CACHE INTEGRITY
   ---------------------------------------------------------
   Jika cache sebelumnya dibuat terlalu awal, beberapa
   element dapat bernilai null.

   Cache harus dibangun ulang setelah element DOM tersedia.
========================================================= */

function hasMissingCachedElements() {

    if (!DOM) {

        return true;

    }


    return VISION_REQUIRED_DOM_KEYS.some(
        key =>
            !DOM[key]
    );

}


/* =========================================================
   GET DOM
   ---------------------------------------------------------
   FIX:
   Jangan mempertahankan cache lama jika sebelumnya dibuat
   sebelum seluruh HTML Vision tersedia.
========================================================= */

function getDOM() {

    if (
        !DOM ||
        hasMissingCachedElements()
    ) {

        buildDOM();

    }


    return DOM;

}


/* =========================================================
   CHECK REQUIRED DOM
========================================================= */

function getMissingRequiredElements() {

    const dom =
        getDOM();


    return VISION_REQUIRED_DOM_KEYS
        .filter(
            key =>
                !dom[key]
        );

}


/* =========================================================
   VALIDATE DOM
========================================================= */

function validateDOM(
    options = {}
) {

    const missing =
        getMissingRequiredElements();


    if (
        missing.length === 0
    ) {

        return {

            valid:
                true,

            missing:
                []

        };

    }


    const message =
        [
            "[GENZ Vision] Element DOM wajib tidak ditemukan:",

            ...missing.map(
                key =>
                    `- ${key} (#${VISION_DOM_IDS[key]})`
            )

        ].join(
            "\n"
        );


    if (
        options.log !== false
    ) {

        console.error(
            message
        );

    }


    return {

        valid:
            false,

        missing

    };

}


/* =========================================================
   REQUIRE DOM
========================================================= */

function requireDOM() {

    const result =
        validateDOM();


    if (
        !result.valid
    ) {

        throw new Error(
            "Vision DOM tidak lengkap."
        );

    }


    return getDOM();

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
    element,
    value
) {

    if (!element) {

        return false;

    }


    element.textContent =
        value === null ||
        value === undefined
            ? ""
            : String(value);


    return true;

}


/* =========================================================
   SET HTML
========================================================= */

function setHTML(
    element,
    value
) {

    if (!element) {

        return false;

    }


    element.innerHTML =
        value === null ||
        value === undefined
            ? ""
            : String(value);


    return true;

}


/* =========================================================
   SET VALUE
========================================================= */

function setValue(
    element,
    value
) {

    if (!element) {

        return false;

    }


    element.value =
        value === null ||
        value === undefined
            ? ""
            : String(value);


    return true;

}


/* =========================================================
   GET VALUE
========================================================= */

function getValue(
    element
) {

    if (!element) {

        return "";

    }


    return String(
        element.value || ""
    );

}


/* =========================================================
   TOGGLE CLASS
========================================================= */

function toggleClass(
    element,
    className,
    enabled
) {

    if (
        !element ||
        !className
    ) {

        return false;

    }


    element.classList.toggle(
        className,
        Boolean(
            enabled
        )
    );


    return true;

}


/* =========================================================
   ADD CLASS
========================================================= */

function addClass(
    element,
    className
) {

    if (
        !element ||
        !className
    ) {

        return false;

    }


    element.classList.add(
        className
    );


    return true;

}


/* =========================================================
   REMOVE CLASS
========================================================= */

function removeClass(
    element,
    className
) {

    if (
        !element ||
        !className
    ) {

        return false;

    }


    element.classList.remove(
        className
    );


    return true;

}


/* =========================================================
   SET ATTRIBUTE
========================================================= */

function setAttribute(
    element,
    name,
    value
) {

    if (
        !element ||
        !name
    ) {

        return false;

    }


    element.setAttribute(
        name,
        value
    );


    return true;

}


/* =========================================================
   REMOVE ATTRIBUTE
========================================================= */

function removeAttribute(
    element,
    name
) {

    if (
        !element ||
        !name
    ) {

        return false;

    }


    element.removeAttribute(
        name
    );


    return true;

}


/* =========================================================
   DISABLED
========================================================= */

function setDisabled(
    element,
    disabled
) {

    if (!element) {

        return false;

    }


    element.disabled =
        Boolean(
            disabled
        );


    toggleClass(
        element,
        "vision-control-disabled",
        disabled
    );


    return true;

}


/* =========================================================
   SHOW / HIDE
========================================================= */

function show(
    element
) {

    if (!element) {

        return false;

    }


    removeClass(
        element,
        "vision-hidden"
    );


    return true;

}


function hide(
    element
) {

    if (!element) {

        return false;

    }


    addClass(
        element,
        "vision-hidden"
    );


    return true;

}


/* =========================================================
   FOCUS
========================================================= */

function focusElement(
    element
) {

    if (
        !element ||
        typeof element.focus !==
            "function"
    ) {

        return false;

    }


    try {

        element.focus();

        return true;

    } catch {

        return false;

    }

}


/* =========================================================
   SCROLL INTO VIEW
========================================================= */

function scrollIntoView(
    element,
    options = {}
) {

    if (
        !element ||
        typeof element.scrollIntoView !==
            "function"
    ) {

        return false;

    }


    element.scrollIntoView({

        behavior:
            options.behavior ||
            "smooth",

        block:
            options.block ||
            "center"

    });


    return true;

}


/* =========================================================
   EVENT LISTENER HELPER
========================================================= */

function on(
    element,
    event,
    handler,
    options
) {

    if (
        !element ||
        !event ||
        typeof handler !==
            "function"
    ) {

        return () => {};

    }


    element.addEventListener(
        event,
        handler,
        options
    );


    return () => {

        element.removeEventListener(
            event,
            handler,
            options
        );

    };

}


/* =========================================================
   QUERY
========================================================= */

function query(
    selector,
    root = document
) {

    if (
        !selector ||
        !root ||
        typeof root.querySelector !==
            "function"
    ) {

        return null;

    }


    return root.querySelector(
        selector
    );

}


/* =========================================================
   QUERY ALL
========================================================= */

function queryAll(
    selector,
    root = document
) {

    if (
        !selector ||
        !root ||
        typeof root.querySelectorAll !==
            "function"
    ) {

        return [];

    }


    return Array.from(
        root.querySelectorAll(
            selector
        )
    );

}


/* =========================================================
   WAIT FOR DOM
========================================================= */

function waitForDOM(
    callback
) {

    if (
        typeof callback !==
            "function"
    ) {

        return;

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            callback,
            {
                once:
                    true
            }
        );

        return;

    }


    callback();

}


/* =========================================================
   DEBUG
========================================================= */

function getDOMDebugInfo() {

    const dom =
        getDOM();


    const result = {};


    for (
        const key
        of Object.keys(
            VISION_DOM_IDS
        )
    ) {

        result[key] =
            Boolean(
                dom[key]
            );

    }


    return result;

}


/* =========================================================
   RESET DOM CACHE
   ---------------------------------------------------------
   Berguna jika modul dipanggil ulang setelah DOM berubah.
========================================================= */

function resetDOMCache() {

    DOM = null;

    return true;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionDOM = Object.freeze({

    IDS:
        VISION_DOM_IDS,

    REQUIRED:
        VISION_REQUIRED_DOM_KEYS,

    buildDOM,

    getDOM,

    getElement,

    getMissingRequiredElements,

    validateDOM,

    requireDOM,

    setText,

    setHTML,

    setValue,

    getValue,

    toggleClass,

    addClass,

    removeClass,

    setAttribute,

    removeAttribute,

    setDisabled,

    show,

    hide,

    focusElement,

    scrollIntoView,

    on,

    query,

    queryAll,

    waitForDOM,

    getDOMDebugInfo,

    resetDOMCache

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionDOM =
    GENZVisionDOM;
