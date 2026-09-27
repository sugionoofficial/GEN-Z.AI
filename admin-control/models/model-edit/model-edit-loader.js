"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT LOADER
 *
 * Tanggung jawab:
 * - Membaca model_id dari URL
 * - Mengambil model dari Admin Models API
 * - Menyimpan model database ke state
 * - Enrichment dari registry GEN-Z.AI
 * - Menggabungkan data Admin Model + Registry
 *
 * Tidak melakukan:
 * - Save / PATCH
 * - Render detail secara langsung
 * - Event binding
 * ============================================================
 */

import {
    getState,
    setCurrentModel,
    setCurrentModelId,
    setCurrentDatabaseModel
} from "./model-edit-state.js";

import {
    getAdminModel
} from "./model-edit-api.js";

import {
    renderModel,
    renderLoading,
    renderError
} from "./model-edit-render.js";

import {
    loadModels,
    loadProviders,
    getModelByModelId
} from "../models-data.js";


/* ============================================================
   GET MODEL ID FROM URL
============================================================ */

function getRequestedModelId() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const modelId =
        params.get(
            "model_id"
        ) ||
        params.get(
            "id"
        );


    return String(
        modelId || ""
    ).trim();
}


/* ============================================================
   NORMALIZE ID
============================================================ */

function normalizeId(
    value
) {

    return String(
        value || ""
    ).trim();
}


/* ============================================================
   MERGE MODEL DATA
============================================================ */

function mergeModelData(
    registryModel,
    adminModel,
    requestedId
) {

    const databaseModel =
        adminModel &&
        typeof adminModel ===
            "object"
            ? adminModel
            : null;


    const registry =
        registryModel &&
        typeof registryModel ===
            "object"
            ? registryModel
            : null;


    /*
     * Admin Model adalah source of truth
     * untuk data yang tersimpan di database.
     *
     * Registry hanya enrichment.
     */

    const merged = {

        ...(registry || {}),

        ...(databaseModel || {})
    };


    if (
        databaseModel?.id !==
        undefined
    ) {

        merged.id =
            databaseModel.id;
    }


    if (
        databaseModel?.model_id
    ) {

        merged.model_id =
            databaseModel.model_id;

    } else if (
        registry?.model_id
    ) {

        merged.model_id =
            registry.model_id;

    } else {

        merged.model_id =
            requestedId;
    }


    /*
     * Provider dari Admin Model
     * harus dipertahankan.
     */

    if (
        databaseModel?.provider_id
    ) {

        merged.provider_id =
            databaseModel.provider_id;
    }


    if (
        databaseModel?.provider_name
    ) {

        merged.provider_name =
            databaseModel.provider_name;
    }


    /*
     * Pricing / credit dari database
     * tidak boleh ditimpa registry.
     */

    const databasePricingFields = [

        "discount_percent",

        "credit_480p",

        "credit_720p",

        "credit_1080p",

        "min_duration",

        "max_duration",

        "supported_ratios",

        "supported_resolutions",

        "status"
    ];


    databasePricingFields.forEach(
        field => {

            if (
                databaseModel &&
                Object.prototype.hasOwnProperty.call(
                    databaseModel,
                    field
                )
            ) {

                merged[field] =
                    databaseModel[field];
            }
        }
    );


    return merged;
}


/* ============================================================
   LOAD REGISTRY MODEL
============================================================ */

async function loadRegistryModel(
    requestedId
) {

    const normalizedId =
        normalizeId(
            requestedId
        );


    if (!normalizedId) {

        return null;
    }


    try {

        await loadProviders({

            includeInactive:
                true
        });


        await loadModels({

            force:
                false,

            includeInactive:
                true
        });


        const model =
            await getModelByModelId(
                normalizedId
            );


        return model || null;

    } catch (error) {

        /*
         * Registry enrichment bersifat
         * tambahan. Jika gagal, Admin Model
         * tetap dapat digunakan.
         */

        console.warn(
            "GEN-Z.AI model-edit registry enrichment warning:",
            error
        );


        return null;
    }
}


/* ============================================================
   LOAD MODEL
============================================================ */

async function loadModel(
    options = {}
) {

    const state =
        getState();


    const requestedId =
        normalizeId(
            options.modelId ||
            getRequestedModelId()
        );


    if (!requestedId) {

        const error =
            new Error(
                "Model ID tidak ditemukan pada URL."
            );

        error.code =
            "MODEL_ID_MISSING";


        renderLoading(
            false
        );

        renderError(
            error.message
        );


        throw error;
    }


    setCurrentModelId(
        requestedId
    );


    renderLoading(
        true,
        "Memuat data model..."
    );


    try {

        /*
         * ----------------------------------------------------
         * STEP 1
         * Ambil langsung satu model dari database.
         * ----------------------------------------------------
         */

        const adminModel =
            await getAdminModel(
                requestedId
            );


        if (!adminModel) {

            throw new Error(
                `Model "${requestedId}" tidak ditemukan.`
            );
        }


        setCurrentDatabaseModel(
            adminModel
        );


        /*
         * ----------------------------------------------------
         * STEP 2
         * Render Admin Model terlebih dahulu.
         *
         * Jadi halaman tidak harus menunggu
         * registry/KIE selesai.
         * ----------------------------------------------------
         */

        const initialModel =
            mergeModelData(
                null,
                adminModel,
                requestedId
            );


        setCurrentModel(
            initialModel
        );


        renderModel(
            initialModel
        );


        renderLoading(
            false
        );


        /*
         * ----------------------------------------------------
         * STEP 3
         * Registry enrichment.
         *
         * Jika gagal, halaman tetap menggunakan
         * Admin Model.
         * ----------------------------------------------------
         */

        const registryModel =
            await loadRegistryModel(
                requestedId
            );


        if (registryModel) {

            const enrichedModel =
                mergeModelData(
                    registryModel,
                    adminModel,
                    requestedId
                );


            setCurrentModel(
                enrichedModel
            );


            renderModel(
                enrichedModel
            );
        }


        return {
            model:
                getState()
                    .currentModel,

            databaseModel:
                getState()
                    .currentDatabaseModel,

            registryModel:
                registryModel || null
        };

    } catch (error) {

        renderLoading(
            false
        );


        renderError(
            error?.message ||
            "Gagal memuat data model."
        );


        throw error;
    }
}


/* ============================================================
   RELOAD CURRENT MODEL
============================================================ */

async function reloadModel() {

    const currentId =
        normalizeId(
            getState()
                .currentModelId
        );


    return loadModel({
        modelId:
            currentId
    });
}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditLoader =
    Object.freeze({

        getRequestedModelId,

        normalizeId,

        mergeModelData,

        loadRegistryModel,

        loadModel,

        reloadModel
    });


window.GENZModelEditLoader =
    GENZModelEditLoader;


export {

    getRequestedModelId,

    normalizeId,

    mergeModelData,

    loadRegistryModel,

    loadModel,

    reloadModel
};
