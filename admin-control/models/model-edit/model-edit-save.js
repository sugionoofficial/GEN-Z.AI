"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT SAVE
 *
 * Tanggung jawab:
 * - Mengambil nilai field editable
 * - Validasi
 * - Membentuk payload PATCH
 * - Menyimpan model
 * - Verifikasi hasil penyimpanan
 *
 * Tidak melakukan:
 * - Initial loading
 * - Registry loading
 * - Render halaman
 * - Event binding
 * ============================================================
 */

import {
    getDOM,
    getCurrentModel,
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
   HELPERS
============================================================ */

function cleanString(value) {

    return String(
        value ?? ""
    ).trim();
}


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
   STATUS
============================================================ */

function getStatus() {

    const dom =
        getDOM();


    if (!dom.statusToggle) {

        return "active";
    }


    /*
     * HTML asli menggunakan checkbox.
     */

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


    return (
        value === "active" ||
        value === "aktif" ||
        value === "enabled" ||
        value === "true"
    )
        ? "active"
        : "inactive";
}


/* ============================================================
   COLLECT FORM
============================================================ */

function collectFormData() {

    const dom =
        getDOM();


    const databaseModel =
        getCurrentDatabaseModel();


    const currentModel =
        getCurrentModel();


    /*
     * model_id berasal dari model database/current model,
     * karena #modelId pada HTML adalah readonly display,
     * bukan input.
     */

    const modelId =
        cleanString(
            databaseModel?.model_id ||
            currentModel?.model_id ||
            databaseModel?.id ||
            currentModel?.id
        );


    const data = {

        /*
         * Database primary key.
         */

        id:
            databaseModel?.id ||
            currentModel?.id ||
            null,


        /*
         * Identifier model.
         */

        model_id:
            modelId,


        /*
         * Editable fields.
         */

        model_name:
            cleanString(
                dom.modelName?.value
            ),


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
            getStatus()
    };


    return data;
}


/* ============================================================
   VALIDATE
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
            "Model ID tidak tersedia."
        );
    }


    if (!data.model_name) {

        errors.push(
            "Model Name wajib diisi."
        );
    }


    /*
     * Discount
     */

    if (
        data.discount_percent === null ||
        data.discount_percent === undefined ||
        !Number.isFinite(
            Number(
                data.discount_percent
            )
        )
    ) {

        errors.push(
            "Discount tidak valid."
        );

    } else if (
        Number(
            data.discount_percent
        ) < 0 ||
        Number(
            data.discount_percent
        ) > 100
    ) {

        errors.push(
            "Discount harus berada antara 0 sampai 100 persen."
        );
    }


    /*
     * Credit.
     *
     * Nilai 0 VALID.
     */

    const credits = [

        {
            label: "480p",
            value:
                data.credit_480p
        },

        {
            label: "720p",
            value:
                data.credit_720p
        },

        {
            label: "1080p",
            value:
                data.credit_1080p
        }

    ];


    credits.forEach(
        item => {

            if (
                item.value === null ||
                item.value === undefined ||
                !Number.isFinite(
                    Number(
                        item.value
                    )
                ) ||
                Number(
                    item.value
                ) < 0
            ) {

                errors.push(
                    `Credit ${item.label} tidak valid.`
                );
            }
        }
    );


    return errors;
}


/* ============================================================
   PATCH PAYLOAD
============================================================ */

function buildPatchPayload(
    data
) {

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
   SAVE
============================================================ */

async function saveModel(
    options = {}
) {

    if (
        isSaving()
    ) {

        return null;
    }


    clearAlert();


    const formData =
        collectFormData();


    const errors =
        validateFormData(
            formData
        );


    if (
        errors.length
    ) {

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
         * PATCH menggunakan database ID.
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
         * API seharusnya mengembalikan model.
         *
         * Jika tidak, verifikasi hanya satu record,
         * bukan GET seluruh model.
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
         * Fallback terakhir.
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
