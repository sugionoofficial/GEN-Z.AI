/* =========================================================
   GEN-Z.AI
   VISION DOM
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-dom.js

   Fungsi:
   - Central DOM registry untuk Vision Engine
   - Menyediakan akses element yang konsisten
   - Menjaga kompatibilitas DOM lama
   - Mendukung Reference Image
   - Mendukung Replacement Character Image
   - Mendukung Outfit Source
   - Mendukung Analysis Copy Button
   - Tidak mengubah logic upload / preview / API
========================================================= */


/* =========================================================
   DOM IDS
========================================================= */

const VISION_DOM_IDS = {

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
       REFERENCE IMAGE
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

    previewName:
        "visionFileName",

    previewSize:
        "visionFileSize",

    removeButton:
        "visionRemoveButton",


    /* =====================================================
       REPLACEMENT CHARACTER IMAGE
    ===================================================== */

    characterDropzone:
        "visionCharacterDropzone",

    characterFileInput:
        "visionCharacterFileInput",

    characterBrowseButton:
        "visionCharacterBrowseButton",

    characterUploadState:
        "visionCharacterUploadState",

    characterPreviewState:
        "visionCharacterPreviewState",

    characterPreviewImage:
        "visionCharacterPreviewImage",

    characterPreviewName:
        "visionCharacterFileName",

    characterPreviewSize:
        "visionCharacterFileSize",

    characterRemoveButton:
        "visionCharacterRemoveButton",


    /* =====================================================
       OUTFIT SOURCE
    ===================================================== */

    outfitSource:
        "visionOutfitSource",


    /* =====================================================
       SETTINGS
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


    /* =====================================================
       PROGRESS
    ===================================================== */

    progress:
        "visionProgress",

    progressBar:
        "visionProgressBar",

    progressText:
        "visionProgressText",


    /* =====================================================
       PROMPT
    ===================================================== */

    promptPlaceholder:
        "visionPromptPlaceholder",

    promptResult:
        "visionPromptResult",

    copyButton:
        "visionCopyButton",

    promptContainer:
        "visionPromptContainer",


    /* =====================================================
       ANALYSIS
    ===================================================== */

    analysisDetails:
        "visionAnalysisDetails",

    analysisResult:
        "visionAnalysisResult",

    analysisCopyButton:
        "visionAnalysisCopyButton",


    /* =====================================================
       NOTICE
    ===================================================== */

    creditNotice:
        "visionCreditNotice"
};


/* =========================================================
   REQUIRED DOM
   ---------------------------------------------------------
   Hanya element yang memang sudah ada pada HTML saat ini.

   Replacement Character dan Outfit Source TIDAK
   dimasukkan di sini agar halaman lama tetap kompatibel.
========================================================= */

const VISION_REQUIRED_DOM_KEYS = [

    /* Page */
    "page",


    /* Credit */
    "creditBadge",
    "creditValue",


    /* Reference Image */
    "dropzone",
    "fileInput",
    "browseButton",
    "uploadState",
    "previewState",
    "previewImage",
    "previewName",
    "previewSize",
    "removeButton",


    /* Settings */
    "model",
    "detail",
    "purpose",
    "instruction",


    /* Action */
    "generateButton",
    "generateButtonText",
    "generateSpinner",


    /* Status */
    "status",
    "statusIndicator",
    "statusText",


    /* Progress */
    "progress",
    "progressBar",
    "progressText",


    /* Prompt */
    "promptPlaceholder",
    "promptResult",
    "copyButton",
    "promptContainer",


    /* Analysis */
    "analysisDetails",
    "analysisResult",


    /* Notice */
    "creditNotice"
];


/* =========================================================
   DOM CACHE
========================================================= */

let DOM = null;


/* =========================================================
   ELEMENT LOOKUP
========================================================= */

function getElement(id) {

    if (!id) {
        return null;
    }

    return document.getElementById(id);
}


/* =========================================================
   BUILD DOM
========================================================= */

function buildDOM() {

    const registry = {};

    Object.entries(VISION_DOM_IDS).forEach(
        ([key, id]) => {

            registry[key] = getElement(id);

        }
    );

    DOM = registry;

    return DOM;
}


/* =========================================================
   CACHE INTEGRITY CHECK
   ---------------------------------------------------------
   DOM sebelumnya bisa terbentuk terlalu awal ketika script
   berjalan sebelum seluruh HTML selesai tersedia.

   Jika element required masih null, registry akan dibangun
   ulang ketika diminta.
========================================================= */

function hasMissingCachedElements() {

    if (!DOM) {
        return true;
    }

    return VISION_REQUIRED_DOM_KEYS.some(
        key => !DOM[key]
    );
}


/* =========================================================
   GET DOM
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
   GET MISSING REQUIRED ELEMENTS
========================================================= */

function getMissingRequiredElements() {

    const dom = getDOM();

    return VISION_REQUIRED_DOM_KEYS
        .filter(
            key => !dom[key]
        );
}


/* =========================================================
   VALIDATE DOM
========================================================= */

function validateDOM() {

    const missing =
        getMissingRequiredElements();

    return {

        valid:
            missing.length === 0,

        missing

    };
}


/* =========================================================
   REQUIRE DOM
========================================================= */

function requireDOM() {

    const result =
        validateDOM();

    if (!result.valid) {

        console.error(
            "[GEN-Z.AI Vision] Required DOM elements missing:",
            result.missing
        );

        throw new Error(
            "Vision DOM tidak lengkap: " +
            result.missing.join(", ")
        );

    }

    return getDOM();
}


/* =========================================================
   TEXT
========================================================= */

function setText(
    element,
    value
) {

    if (!element) {
        return false;
    }

    element.textContent =
        value == null
            ? ""
            : String(value);

    return true;
}


/* =========================================================
   HTML
========================================================= */

function setHTML(
    element,
    value
) {

    if (!element) {
        return false;
    }

    element.innerHTML =
        value == null
            ? ""
            : String(value);

    return true;
}


/* =========================================================
   VALUE
========================================================= */

function setValue(
    element,
    value
) {

    if (!element) {
        return false;
    }

    element.value =
        value == null
            ? ""
            : value;

    return true;
}


/* =========================================================
   GET VALUE
========================================================= */

function getValue(
    element,
    fallback = ""
) {

    if (!element) {
        return fallback;
    }

    return element.value;
}


/* =========================================================
   CLASS ADD
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
   CLASS REMOVE
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
   CLASS TOGGLE
========================================================= */

function toggleClass(
    element,
    className,
    force
) {

    if (
        !element ||
        !className
    ) {
        return false;
    }

    element.classList.toggle(
        className,
        force
    );

    return true;
}


/* =========================================================
   HAS CLASS
========================================================= */

function hasClass(
    element,
    className
) {

    if (
        !element ||
        !className
    ) {
        return false;
    }

    return element.classList.contains(
        className
    );

}


/* =========================================================
   ATTRIBUTE
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
   HAS ATTRIBUTE
========================================================= */

function hasAttribute(
    element,
    name
) {

    if (
        !element ||
        !name
    ) {
        return false;
    }

    return element.hasAttribute(
        name
    );
}


/* =========================================================
   DISABLED
========================================================= */

function setDisabled(
    element,
    disabled = true
) {

    if (!element) {
        return false;
    }

    element.disabled =
        Boolean(disabled);

    return true;
}


/* =========================================================
   HIDDEN
========================================================= */

function setHidden(
    element,
    hidden = true
) {

    if (!element) {
        return false;
    }

    element.hidden =
        Boolean(hidden);

    return true;
}


/* =========================================================
   SHOW
========================================================= */

function show(
    element
) {

    if (!element) {
        return false;
    }

    element.hidden = false;

    element.classList.remove(
        "vision-hidden"
    );

    return true;
}


/* =========================================================
   HIDE
========================================================= */

function hide(
    element
) {

    if (!element) {
        return false;
    }

    element.hidden = true;

    element.classList.add(
        "vision-hidden"
    );

    return true;
}


/* =========================================================
   FOCUS
========================================================= */

function focus(
    element
) {

    if (
        !element ||
        typeof element.focus !== "function"
    ) {
        return false;
    }

    element.focus();

    return true;
}


/* =========================================================
   EVENT LISTENER
========================================================= */

function addEventListener(
    element,
    event,
    handler,
    options
) {

    if (
        !element ||
        !event ||
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
        typeof root.querySelector !== "function"
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
        typeof root.querySelectorAll !== "function"
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
   SCROLL INTO VIEW
========================================================= */

function scrollIntoView(
    element,
    options = {
        behavior: "smooth",
        block: "center"
    }
) {

    if (
        !element ||
        typeof element.scrollIntoView !== "function"
    ) {
        return false;
    }

    element.scrollIntoView(
        options
    );

    return true;
}


/* =========================================================
   WAIT FOR DOM
========================================================= */

function waitForDOM(
    timeout = 10000
) {

    return new Promise(
        resolve => {

            const current =
                getDOM();

            if (
                !hasMissingRequiredElements()
            ) {

                resolve(current);

                return;

            }


            const start =
                Date.now();


            const timer =
                setInterval(
                    () => {

                        const dom =
                            buildDOM();

                        const missing =
                            VISION_REQUIRED_DOM_KEYS
                                .some(
                                    key => !dom[key]
                                );


                        if (!missing) {

                            clearInterval(
                                timer
                            );

                            resolve(dom);

                            return;

                        }


                        if (
                            Date.now() -
                            start >=
                            timeout
                        ) {

                            clearInterval(
                                timer
                            );

                            resolve(
                                getDOM()
                            );

                        }

                    },
                    50
                );

        }
    );
}


/* =========================================================
   HELPER
========================================================= */

function hasMissingRequiredElements() {

    return getMissingRequiredElements()
        .length > 0;
}


/* =========================================================
   DEBUG
========================================================= */

function debugDOM() {

    const dom =
        getDOM();

    const validation =
        validateDOM();

    console.group(
        "[GEN-Z.AI Vision] DOM Debug"
    );

    console.log(
        "Registry:",
        VISION_DOM_IDS
    );

    console.log(
        "DOM:",
        dom
    );

    console.log(
        "Valid:",
        validation.valid
    );

    console.log(
        "Missing:",
        validation.missing
    );

    console.groupEnd();

    return {

        registry:
            VISION_DOM_IDS,

        dom,

        valid:
            validation.valid,

        missing:
            validation.missing

    };
}


/* =========================================================
   RESET CACHE
========================================================= */

function resetDOMCache() {

    DOM = null;

    return buildDOM();

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionDOM = {

    /* Registry */
    ids:
        VISION_DOM_IDS,

    required:
        VISION_REQUIRED_DOM_KEYS,


    /* Core */
    getDOM,
    buildDOM,
    validateDOM,
    requireDOM,
    getMissingRequiredElements,
    resetDOMCache,
    debugDOM,


    /* Element */
    getElement,


    /* Text */
    setText,
    setHTML,


    /* Value */
    setValue,
    getValue,


    /* Classes */
    addClass,
    removeClass,
    toggleClass,
    hasClass,


    /* Attributes */
    setAttribute,
    removeAttribute,
    hasAttribute,


    /* State */
    setDisabled,
    setHidden,
    show,
    hide,


    /* Interaction */
    focus,
    addEventListener,
    scrollIntoView,


    /* Query */
    query,
    queryAll,


    /* Lifecycle */
    waitForDOM

};


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionDOM =
    GENZVisionDOM;


/* =========================================================
   INITIAL CACHE
========================================================= */

buildDOM();
