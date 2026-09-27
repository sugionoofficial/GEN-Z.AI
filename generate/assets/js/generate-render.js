/* =========================================================
   GEN-Z.AI
   GENERATE RENDER MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-render.js

   Tanggung jawab:
   - Menentukan renderer berdasarkan model
   - Render form model biasa
   - Render form khusus Seedance
   - Tidak menangani submit
   - Tidak menangani request API
   - Tidak menangani polling
========================================================= */

"use strict";


/* =========================================================
   CONSTANT
========================================================= */

const SEEDANCE_MODEL_ID =
    "bytedance/seedance-2-5";


/* =========================================================
   GET MODEL ID
========================================================= */

function getModelId(
    model
) {

    if (
        !model
    ) {

        return "";

    }

    return String(
        model.model_id ||
        model.modelId ||
        model.id ||
        ""
    ).trim();

}


/* =========================================================
   CHECK SEEDANCE
========================================================= */

function isSeedanceModel(
    model
) {

    return (
        getModelId(model) ===
        SEEDANCE_MODEL_ID
    );

}


/* =========================================================
   GET MODULES
========================================================= */

function getModules() {

    const app =
        window.GENZGenerateApp;

    if (
        !app ||
        typeof app.getModules !==
        "function"
    ) {

        throw new Error(
            "GENZGenerateApp belum tersedia."
        );

    }

    return app.getModules();

}


/* =========================================================
   RENDER MODEL FORM
========================================================= */

async function renderModelForm(
    model
) {

    const modules =
        getModules();

    const formModule =
        modules.form;

    const seedanceModule =
        modules.seedance;


    /* =====================================================
       SEEDANCE
    ===================================================== */

    if (
        isSeedanceModel(
            model
        )
    ) {

        if (
            !seedanceModule ||
            typeof seedanceModule
                .renderSeedanceForm !==
                "function"
        ) {

            throw new Error(
                "generate-seedance.js tidak tersedia."
            );

        }

        await seedanceModule
            .renderSeedanceForm(
                model
            );

        return {
            type:
                "seedance",

            modelId:
                SEEDANCE_MODEL_ID
        };

    }


    /* =====================================================
       MODEL BIASA
    ===================================================== */

    if (
        !formModule
    ) {

        throw new Error(
            "generate-form.js tidak tersedia."
        );

    }


    if (
        typeof formModule
            .renderGenerateForm ===
        "function"
    ) {

        await formModule
            .renderGenerateForm();

    }

    else if (
        typeof formModule.render ===
        "function"
    ) {

        await formModule.render();

    }

    else if (
        typeof formModule.init ===
        "function"
    ) {

        await formModule.init();

    }

    else {

        throw new Error(
            "generate-form.js tidak memiliki renderer yang valid."
        );

    }


    return {
        type:
            "default",

        modelId:
            getModelId(model)
    };

}


/* =========================================================
   RESET MODEL FORM
========================================================= */

async function resetModelForm(
    model
) {

    const modules =
        getModules();

    const formModule =
        modules.form;

    const seedanceModule =
        modules.seedance;


    /* =====================================================
       SEEDANCE RESET
    ===================================================== */

    if (
        isSeedanceModel(
            model
        )
    ) {

        if (
            seedanceModule &&
            typeof seedanceModule
                .resetSeedanceForm ===
            "function"
        ) {

            await seedanceModule
                .resetSeedanceForm();

            return;

        }

        return;

    }


    /* =====================================================
       DEFAULT RESET
    ===================================================== */

    if (
        formModule &&
        typeof formModule.reset ===
        "function"
    ) {

        await formModule.reset();

        return;

    }


    if (
        formModule &&
        typeof formModule
            .resetDynamicFields ===
        "function"
    ) {

        await formModule
            .resetDynamicFields(
                model
            );

    }

}


/* =========================================================
   GET PARAMETERS
========================================================= */

async function getModelParameters(
    model
) {

    const modules =
        getModules();


    /* =====================================================
       SEEDANCE
    ===================================================== */

    if (
        isSeedanceModel(
            model
        )
    ) {

        const seedanceModule =
            modules.seedance;

        if (
            !seedanceModule ||
            typeof seedanceModule
                .getSeedanceParameters !==
                "function"
        ) {

            throw new Error(
                "generate-seedance.js tidak memiliki getSeedanceParameters()."
            );

        }

        return await seedanceModule
            .getSeedanceParameters();

    }


    /* =====================================================
       DEFAULT
    ===================================================== */

    const formModule =
        modules.form;

    if (
        !formModule ||
        typeof formModule
            .getFormParameters !==
        "function"
    ) {

        throw new Error(
            "generate-form.js tidak memiliki getFormParameters()."
        );

    }

    return await formModule
        .getFormParameters(
            model
        );

}


/* =========================================================
   VALIDATE PARAMETERS
========================================================= */

function validateModelParameters(
    model,
    parameters
) {

    const modules =
        getModules();


    /* =====================================================
       SEEDANCE
    ===================================================== */

    if (
        isSeedanceModel(
            model
        )
    ) {

        const seedanceModule =
            modules.seedance;

        if (
            seedanceModule &&
            typeof seedanceModule
                .validateSeedanceParameters ===
            "function"
        ) {

            try {

                seedanceModule
                    .validateSeedanceParameters(
                        parameters
                    );

                return [];

            }

            catch (
                error
            ) {

                return [
                    error?.message ||
                    "Parameter Seedance tidak valid."
                ];

            }

        }

        return [];

    }


    /* =====================================================
       DEFAULT
    ===================================================== */

    const requestModule =
        modules.request;

    if (
        requestModule &&
        typeof requestModule
            .validateGenerateRequest ===
        "function"
    ) {

        return requestModule
            .validateGenerateRequest(
                parameters
            );

    }


    const validationModule =
        modules.validation;

    if (
        validationModule &&
        typeof validationModule
            .validateClientParameters ===
        "function"
    ) {

        return validationModule
            .validateClientParameters(
                parameters
            );

    }


    return [];

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZGenerateRender =
    Object.freeze({

        SEEDANCE_MODEL_ID,

        getModelId,

        isSeedanceModel,

        renderModelForm,

        resetModelForm,

        getModelParameters,

        validateModelParameters

    });


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.GENZGenerateRender =
    GENZGenerateRender;


/* =========================================================
   ES MODULE EXPORT
========================================================= */

export {

    SEEDANCE_MODEL_ID,

    getModelId,

    isSeedanceModel,

    renderModelForm,

    resetModelForm,

    getModelParameters,

    validateModelParameters

};
