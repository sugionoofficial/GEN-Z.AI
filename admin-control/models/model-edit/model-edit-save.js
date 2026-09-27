"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT SAVE
 *
 * Tanggung jawab:
 * - Mengambil nilai form
 * - Validasi data
 * - Menyiapkan payload PATCH
 * - Menyimpan model melalui Admin Models API
 * - Memperbarui state setelah berhasil
 *
 * Tidak melakukan:
 * - Initial load
 * - Registry loading
 * - Event binding
 * - Render struktur halaman
 * ============================================================
 */

import {
    getDOM,
    getState,
    getCurrentDatabaseModel,
    setCurrentModel,
    setSaving,
    isSaving
} from "./model-edit-state.js";

import {
    requestAdminModels,
    extractSavedModel
} from "./model-edit-api.js";

import {
    renderSaving,
    renderSuccess,
    renderError,
    clearAlert
} from "./model-edit-render.js";


/* ============================================================
   NUMBER
============================================================ */

function parseNumber(
    value,
    fallback = null
) {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {

        return fallback;
    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;
}


/* ============================================================
   STRING
============================================================ */

function cleanString(
    value
) {

    return String(
        value ?? ""
    ).trim();
}


/* ============================================================
   GET STATUS
============================================================ */

function getStatus(
    dom
) {

    if (!dom.statusToggle) {

        return "active";
    }


    if (
        dom.statusToggle.type ===
        "checkbox"
    ) {

        return dom.statusToggle.checked
            ? "active"
            : "inactive";
    }


    const value =
        cleanString(
            dom.statusToggle.value
        ).toLowerCase();


    if (
        value === "active" ||
        value === "aktif" ||
        value === "enabled" ||
        value === "true"
    ) {

        return "active";
    }


    return "inactive";
}


/* ============================================================
   COLLECT FORM
============================================================ */

function collectFormData() {

    const dom =
        getDOM();


    const databaseModel =
        getCurrentDatabaseModel();


    const modelId =
        cleanString(
            dom.modelId?.value ||
            databaseModel?.model_id ||
            databaseModel?.id
        );


    const providerId =
        cleanString(
            databaseModel?.provider_id
        );


    const data = {

        id:
            databaseModel?.id ||
            null,

        model_id:
            modelId,

        model_name:
            cleanString(
                dom.modelName?.value
            ),

        provider_id:
            providerId,

        description:
            cleanString(
                dom.description?.value
            ),

        discount_percent:
            parseNumber(
                dom.discount?.value,
                0
            ),

        credit_480p:
            parseNumber(
                dom.credit480p?.value,
                0
            ),

        credit_720p:
            parseNumber(
                dom.credit720p?.value,
                0
            ),

        credit_1080p:
            parseNumber(
                dom.credit1080p?.value,
                0
            ),

        status:
            getStatus(
                dom
            )
    };


    /*
     * Duration, ratio, dan resolution
     * dipertahankan dari database apabila
     * field UI tidak tersedia atau readonly.
     */

    if (
        databaseModel &&
        Object.prototype.hasOwnProperty.call(
            databaseModel,
            "min_duration"
        )
    ) {

        data.min_duration =
            databaseModel.min_duration;
    }


    if (
        databaseModel &&
        Object.prototype.hasOwnProperty.call(
            databaseModel,
            "max_duration"
        )
    ) {

        data.max_duration =
            databaseModel.max_duration;
    }


    if (
        databaseModel &&
        Object.prototype.hasOwnProperty.call(
            databaseModel,
            "supported_ratios"
        )
    ) {

        data.supported_ratios =
            databaseModel.supported_ratios;
    }


    if (
        databaseModel &&
        Object.prototype.hasOwnProperty.call(
            databaseModel,
            "supported_resolutions"
        )
    ) {

        data.supported_resolutions =
            databaseModel.supported_resolutions;
    }


    return data;
}


/* ============================================================
   VALIDATE FORM
============================================================ */

function validateFormData(
    data
) {

    const errors = [];


    if (!data) {

        errors.push(
            "Data model tidak tersedia."
        );

        return errors;
    }


    if (!data.id) {

        errors.push(
            "Database ID model tidak tersedia."
        );
    }


    if (!data.model_id) {

        errors.push(
            "Model ID wajib diisi."
        );
    }


    if (!data.model_name) {

        errors.push(
            "Model Name wajib diisi."
        );
    }


    if (
        data.discount_percent !== null &&
        (
            data.discount_percent < 0 ||
            data.discount_percent > 100
        )
    ) {

        errors.push(
            "Discount harus berada antara 0 sampai 100 persen."
        );
    }


    const creditFields = [

        [
            "480p",
            data.credit_480p
        ],

        [
            "720p",
            data.credit_720p
        ],

        [
            "1080p",
            data.credit_1080p
        ]
    ];


    creditFields.forEach(
        ([label, value]) => {

            if (
                value === null ||
                value < 0
            ) {

                errors.push(
                    `Credit ${label} tidak valid.`
                );
            }
        }
    );


    return errors;
}


/* ============================================================
   BUILD PATCH PAYLOAD
============================================================ */

function buildPatchPayload(
    data
) {

    /*
     * Hanya field yang memang boleh
     * diedit dari halaman Edit Model.
     */

    return {

        model_name:
            data.model_name,

        description:
            data.description,

        discount_percent:
            data.discount_percent,

        credit_480p:
            data.credit_480p,

        credit_720p:
            data.credit_720p,

        credit_1080p:
            data.credit_1080p,

        status:
            data.status
    };
}


/* ============================================================
   SAVE MODEL
============================================================ */

async function saveModel(
    options = {}
) {

    if (isSaving()) {

        return null;
    }


    const dom =
        getDOM();


    clearAlert();


    const formData =
        collectFormData();


    const errors =
        validateFormData(
            formData
        );


    if (errors.length) {

        const message =
            errors.join(" ");


        renderError(
            message
        );


        throw new Error(
            message
        );
    }


    const payload =
        buildPatchPayload(
            formData
        );


    setSaving(
        true
    );


    renderSaving(
        true
    );


    try {

        /*
         * PATCH berdasarkan database UUID.
         *
         * model_id tidak digunakan sebagai
         * primary selector karena database
         * record ID adalah source of truth.
         */

        const result =
            await requestAdminModels(
                "PATCH",
                {
                    id:
                        formData.id,

                    ...payload
                }
            );


        let savedModel =
            extractSavedModel(
                result
            );


        /*
         * Jika API tidak mengembalikan model,
         * ambil kembali satu record saja.
         */

        if (!savedModel) {

            const verifyResult =
                await requestAdminModels(
                    "GET",
                    null,
                    {
                        id:
                            formData.id
                    }
                );


            savedModel =
                extractSavedModel(
                    verifyResult
                );
        }


        /*
         * Fallback ke data form jika API
         * tidak mengembalikan representasi model.
         */

        if (!savedModel) {

            savedModel = {

                ...(getCurrentDatabaseModel() ||
                    {}),

                ...formData,

                ...payload
            };
        }


        setCurrentModel(
            savedModel
        );


        if (
            typeof options.onSuccess ===
            "function"
        ) {

            await options.onSuccess(
                savedModel,
                result
            );

        } else {

            renderSuccess(
                "Model berhasil disimpan."
            );
        }


        return {

            model:
                savedModel,

            response:
                result
        };

    } catch (error) {

        renderError(
            error?.message ||
            "Gagal menyimpan model."
        );


        if (
            typeof options.onError ===
            "function"
        ) {

            await options.onError(
                error
            );
        }


        throw error;

    } finally {

        setSaving(
            false
        );


        renderSaving(
            false
        );
    }
}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditSave =
    Object.freeze({

        collectFormData,

        validateFormData,

        buildPatchPayload,

        saveModel
    });


window.GENZModelEditSave =
    GENZModelEditSave;


export {

    collectFormData,

    validateFormData,

    buildPatchPayload,

    saveModel
};
