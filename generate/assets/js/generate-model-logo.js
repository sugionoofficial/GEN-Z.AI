/* =========================================================
   GEN-Z.AI
   GENERATE MODEL LOGO
========================================================= */

"use strict";


const MODEL_LOGO_BASE_PATH =
    "./assets/models/";


/* =========================================================
   PROVIDER / MODEL LOGO MAP
========================================================= */

const LOGO_MAP = Object.freeze({

    grok:
        "grok.svg",

    "grok-imagine":
        "grok.svg",

    "x-ai":
        "grok.svg",

    xai:
        "grok.svg",


    kling:
        "kling.svg",

    "kling-ai":
        "kling.svg",

    klingai:
        "kling.svg",


    seedance:
        "seedance.svg",

    bytedance:
        "seedance.svg",

    "bytedance-seed":
        "seedance.svg",

    seed:
        "seedance.svg"

});


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(
        value
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   NORMALIZE MODEL
========================================================= */

function normalizeModel(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return {

            modelId: "",

            modelName: "",

            providerId: "",

            providerName: ""

        };

    }


    return {

        modelId:
            safeString(
                model.model_id ||
                model.modelId ||
                model.id ||
                model.config?.id
            ),

        modelName:
            safeString(
                model.model_name ||
                model.modelName ||
                model.name ||
                model.config?.name
            ),

        providerId:
            safeString(
                model.provider_id ||
                model.providerId ||
                model.provider?.id
            ),

        providerName:
            safeString(
                model.provider_name ||
                model.providerName ||
                model.provider?.name
            )

    };

}


/* =========================================================
   RESOLVE LOGO
========================================================= */

export function getModelLogoFile(
    model
) {

    const normalized =
        normalizeModel(
            model
        );


    const candidates = [

        normalized.modelId,

        normalized.providerId,

        normalized.modelName,

        normalized.providerName

    ];


    for (
        const candidate
        of candidates
    ) {

        if (!candidate) {
            continue;
        }


        /*
         * Exact match lebih dulu.
         */

        if (
            LOGO_MAP[candidate]
        ) {

            return LOGO_MAP[
                candidate
            ];

        }


        /*
         * Partial match.
         */

        for (
            const [
                key,
                logo
            ]
            of Object.entries(
                LOGO_MAP
            )
        ) {

            if (
                candidate.includes(
                    key
                )
            ) {

                return logo;

            }

        }

    }


    return null;

}


/* =========================================================
   PREVIEW ELEMENT
========================================================= */

function getPreviewElement() {

    return document.getElementById(
        "selectedModelLogo"
    );

}


/* =========================================================
   CLEAR
========================================================= */

export function clearModelLogo() {

    const container =
        getPreviewElement();


    if (!container) {
        return;
    }


    container.innerHTML = "";

    container.hidden = true;

    delete container.dataset.modelId;

}


/* =========================================================
   UPDATE
========================================================= */

export function updateModelLogo(
    model
) {

    const container =
        getPreviewElement();


    if (!container) {
        return;
    }


    const logoFile =
        getModelLogoFile(
            model
        );


    if (!logoFile) {

        clearModelLogo();

        return;

    }


    const normalized =
        normalizeModel(
            model
        );


    const image =
        document.createElement(
            "img"
        );


    image.className =
        "generate-model-logo-image";


    image.src =
        MODEL_LOGO_BASE_PATH +
        logoFile;


    image.alt =
        normalized.modelName ||
        normalized.providerName ||
        "Model";


    image.loading =
        "eager";


    image.decoding =
        "async";


    image.addEventListener(
        "error",
        () => {

            clearModelLogo();

        },
        {
            once: true
        }
    );


    container.innerHTML = "";

    container.appendChild(
        image
    );


    container.hidden = false;


    if (
        normalized.modelId
    ) {

        container.dataset.modelId =
            normalized.modelId;

    }

}


/* =========================================================
   INIT
========================================================= */

export function initModelLogo(
    model = null
) {

    if (model) {

        updateModelLogo(
            model
        );

        return;

    }


    clearModelLogo();

}


/* =========================================================
   GLOBAL API
========================================================= */

window.GENZModelLogo = {

    updateModelLogo,

    clearModelLogo,

    getModelLogoFile,

    initModelLogo

};
