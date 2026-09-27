"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT RENDER
 *
 * Tanggung jawab:
 * - Render identitas model
 * - Render status
 * - Render parameter teknis
 * - Render credit
 * - Render pricing preview
 * - Render loading / alert
 *
 * Tidak melakukan API request.
 * ============================================================
 */

import {
    getDOM
} from "./model-edit-state.js";


/* ============================================================
   VALUE HELPERS
============================================================ */

function valueOrEmpty(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }

    return String(value);
}


function numberValue(
    value,
    fallback = 0
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;
}


function nullableNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;
    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;
}


/* ============================================================
   ARRAY NORMALIZATION
============================================================ */

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value;
    }


    if (
        typeof value === "string"
    ) {

        try {

            const parsed =
                JSON.parse(value);


            if (
                Array.isArray(parsed)
            ) {

                return parsed;
            }

        } catch (_) {
            /* fallback */
        }


        return value
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);
    }


    return [];
}


/* ============================================================
   PARAMETER HELPERS
============================================================ */

function getParameterDefinition(
    model,
    parameterName
) {

    const parameters =
        model?.parameters;


    if (
        !Array.isArray(parameters)
    ) {

        return null;
    }


    return (
        parameters.find(
            parameter =>
                parameter &&
                parameter.name ===
                    parameterName
        ) ||
        null
    );
}


function getParameterValues(
    model,
    parameterName
) {

    const definition =
        getParameterDefinition(
            model,
            parameterName
        );


    if (!definition) {

        return [];
    }


    if (
        Array.isArray(
            definition.enum
        )
    ) {

        return definition.enum;
    }


    if (
        Array.isArray(
            definition.options
        )
    ) {

        return definition.options;
    }


    return [];
}


function getParameterDefault(
    model,
    parameterName
) {

    const definition =
        getParameterDefinition(
            model,
            parameterName
        );


    return definition
        ? (
            definition.default ??
            null
        )
        : null;
}


/* ============================================================
   TEXT / VALUE
============================================================ */

function setText(
    element,
    value
) {

    if (!element) {

        return;
    }


    element.textContent =
        valueOrEmpty(value);
}


function setValue(
    element,
    value
) {

    if (!element) {

        return;
    }


    element.value =
        valueOrEmpty(value);
}


/* ============================================================
   MODEL STATUS
============================================================ */

function isModelActive(
    model
) {

    return (
        String(
            model?.status ||
            ""
        )
        .trim()
        .toLowerCase() ===
        "active"
    );
}


/* ============================================================
   STATUS
============================================================ */

function renderStatus(
    model
) {

    const dom =
        getDOM();


    const active =
        isModelActive(
            model
        );


    if (
        dom.statusToggle
    ) {

        dom.statusToggle.checked =
            active;
    }


    setText(
        dom.statusText,
        active
            ? "Aktif"
            : "Nonaktif"
    );
}


/* ============================================================
   PARAMETERS
============================================================ */

function renderParameters(
    model
) {

    const dom =
        getDOM();


    /*
     * Duration
     */

    const durationParameter =
        getParameterDefinition(
            model,
            "duration"
        );


    const minDuration =
        model?.min_duration ??
        durationParameter?.min ??
        null;


    const maxDuration =
        model?.max_duration ??
        durationParameter?.max ??
        null;


    if (
        minDuration !== null &&
        maxDuration !== null
    ) {

        setText(
            dom.durationValue,
            `${minDuration} - ${maxDuration} detik`
        );

    } else if (
        minDuration !== null
    ) {

        setText(
            dom.durationValue,
            `${minDuration} detik`
        );

    } else if (
        maxDuration !== null
    ) {

        setText(
            dom.durationValue,
            `${maxDuration} detik`
        );

    } else {

        const defaultDuration =
            getParameterDefault(
                model,
                "duration"
            );


        setText(
            dom.durationValue,
            defaultDuration !== null
                ? `${defaultDuration} detik`
                : "Mengikuti parameters.js"
        );
    }


    /*
     * Aspect ratio
     */

    let ratios =
        normalizeArray(
            model?.supported_ratios
        );


    if (!ratios.length) {

        ratios =
            getParameterValues(
                model,
                "aspect_ratio"
            );
    }


    if (!ratios.length) {

        const defaultRatio =
            getParameterDefault(
                model,
                "aspect_ratio"
            );


        if (
            defaultRatio !== null
        ) {

            ratios = [
                defaultRatio
            ];
        }
    }


    setText(
        dom.ratioValue,
        ratios.length
            ? ratios.join(" • ")
            : "Mengikuti parameters.js"
    );


    /*
     * Resolution
     */

    let resolutions =
        normalizeArray(
            model?.supported_resolutions
        );


    if (!resolutions.length) {

        resolutions =
            getParameterValues(
                model,
                "resolution"
            );
    }


    if (!resolutions.length) {

        const defaultResolution =
            getParameterDefault(
                model,
                "resolution"
            );


        if (
            defaultResolution !== null
        ) {

            resolutions = [
                defaultResolution
            ];
        }
    }


    setText(
        dom.resolutionValue,
        resolutions.length
            ? resolutions.join(" • ")
            : "Mengikuti parameters.js"
    );
}


/* ============================================================
   CREDIT FORMAT
============================================================ */

function formatCredit(
    value
) {

    const number =
        nullableNumber(value);


    if (
        number === null
    ) {

        return "Belum diatur";
    }


    return `${number.toLocaleString(
        "id-ID",
        {
            maximumFractionDigits: 2
        }
    )} Credit`;
}


/* ============================================================
   DISCOUNT FORMAT
============================================================ */

function formatDiscount(
    value
) {

    const percent =
        Math.min(
            100,
            Math.max(
                0,
                numberValue(value)
            )
        );


    if (
        percent <= 0
    ) {

        return "Tidak ada";
    }


    return `${percent.toLocaleString(
        "id-ID",
        {
            maximumFractionDigits: 2
        }
    )}%`;
}


/* ============================================================
   FINAL CREDIT
============================================================ */

function calculateFinalCredit(
    credit,
    discountPercent
) {

    const numericCredit =
        nullableNumber(
            credit
        );


    if (
        numericCredit === null
    ) {

        return null;
    }


    const percent =
        Math.min(
            100,
            Math.max(
                0,
                numberValue(
                    discountPercent
                )
            )
        );


    return (
        numericCredit *
        (
            1 -
            percent / 100
        )
    );
}


/* ============================================================
   RESOLUTION PRICING
============================================================ */

function updateResolutionPricing(
    model = null
) {

    const dom =
        getDOM();


    const discountPercent =
        Math.min(
            100,
            Math.max(
                0,
                numberValue(
                    dom.discount?.value ??
                    model?.discount_percent ??
                    0
                )
            )
        );


    const values = [

        {
            credit:
                dom.credit480p?.value,

            creditEl:
                dom.pricingCredit480p,

            discountEl:
                dom.pricingDiscount480p,

            finalEl:
                dom.pricingFinal480p
        },

        {
            credit:
                dom.credit720p?.value,

            creditEl:
                dom.pricingCredit720p,

            discountEl:
                dom.pricingDiscount720p,

            finalEl:
                dom.pricingFinal720p
        },

        {
            credit:
                dom.credit1080p?.value,

            creditEl:
                dom.pricingCredit1080p,

            discountEl:
                dom.pricingDiscount1080p,

            finalEl:
                dom.pricingFinal1080p
        }

    ];


    values.forEach(
        item => {

            const finalCredit =
                calculateFinalCredit(
                    item.credit,
                    discountPercent
                );


            setText(
                item.creditEl,
                formatCredit(
                    item.credit
                )
            );


            setText(
                item.discountEl,
                formatDiscount(
                    discountPercent
                )
            );


            setText(
                item.finalEl,
                formatCredit(
                    finalCredit
                )
            );
        }
    );


    return {
        discountPercent
    };
}


/* ============================================================
   PRICE PREVIEW
============================================================ */

function updatePricePreview(
    model = null
) {

    const dom =
        getDOM();


    const usd =
        Math.max(
            0,
            numberValue(
                dom.priceUsd?.value ??
                model?.price_usd ??
                0
            )
        );


    const rate =
        Math.max(
            0,
            numberValue(
                dom.exchangeRate?.value ??
                0
            )
        );


    const discountPercent =
        Math.min(
            100,
            Math.max(
                0,
                numberValue(
                    dom.discount?.value ??
                    model?.discount_percent ??
                    0
                )
            )
        );


    const idr =
        usd *
        rate;


    const finalIdr =
        idr *
        (
            1 -
            discountPercent / 100
        );


    updateResolutionPricing(
        model
    );


    return {

        usd,

        rate,

        idr,

        discountPercent,

        finalIdr
    };
}


/* ============================================================
   RENDER MODEL
============================================================ */

function renderModel(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        throw new Error(
            "Data model tidak valid."
        );
    }


    const dom =
        getDOM();


    const modelId =
        String(
            model?.model_id ||
            model?.id ||
            ""
        ).trim();


    const name =
        model?.model_name ||
        model?.name ||
        modelId ||
        "Model";


    const provider =
        model?.provider_name ||
        model?.providerName ||
        model?.provider_id ||
        model?.providerId ||
        "-";


    const type =
        model?.type ||
        model?.model_type ||
        "-";


    /*
     * Hero
     */

    setText(
        dom.heroModelName,
        name
    );


    setText(
        dom.heroModelId,
        modelId
    );


    /*
     * Basic
     */

    setValue(
        dom.modelName,
        name
    );


    setText(
        dom.modelId,
        modelId
    );


    setText(
        dom.provider,
        provider
    );


    setText(
        dom.type,
        type
    );


    setValue(
        dom.description,
        model?.description ?? ""
    );


    /*
     * Status
     */

    renderStatus(
        model
    );


    /*
     * Parameters
     */

    renderParameters(
        model
    );


    /*
     * Registry USD price
     */

    const registryPrice =
        model?.price_usd ??
        model?.priceUSD ??
        null;


    if (
        dom.priceUsd
    ) {

        dom.priceUsd.value =
            registryPrice !== null
                ? valueOrEmpty(
                    registryPrice
                )
                : "";
    }


    /*
     * Exchange rate.
     *
     * Jangan mengarang kurs.
     * Biarkan modul kurs existing atau
     * nilai halaman yang sudah tersedia.
     */

    /*
     * Discount
     */

    setValue(
        dom.discount,
        model?.discount_percent ??
        0
    );


    /*
     * Credits
     */

    setValue(
        dom.credit480p,
        model?.credit_480p ??
        ""
    );


    setValue(
        dom.credit720p,
        model?.credit_720p ??
        ""
    );


    setValue(
        dom.credit1080p,
        model?.credit_1080p ??
        ""
    );


    /*
     * Pricing preview
     */

    updatePricePreview(
        model
    );


    /*
     * Hero state
     */

    if (
        dom.modelHero
    ) {

        dom.modelHero.dataset.status =
            isModelActive(
                model
            )
                ? "active"
                : "inactive";

        dom.modelHero.dataset.modelId =
            modelId;
    }


    return model;
}


/* ============================================================
   LOADING
============================================================ */

function renderLoading(
    loading = true,
    message = "Memuat konfigurasi model..."
) {

    const dom =
        getDOM();


    if (
        dom.loading
    ) {

        if (loading) {

            dom.loading.classList.remove(
                "hidden"
            );

        } else {

            dom.loading.classList.add(
                "hidden"
            );
        }
    }


    if (
        dom.loadingText
    ) {

        /*
         * loadingBox adalah satu container,
         * jadi jangan mengganti seluruh textContent
         * karena itu akan menghapus spinner.
         *
         * HTML asli tidak memiliki #loadingText.
         */
    }


    if (
        dom.editContent
    ) {

        if (loading) {

            dom.editContent.classList.add(
                "hidden"
            );

        } else {

            dom.editContent.classList.remove(
                "hidden"
            );
        }
    }
}


/* ============================================================
   SAVING
============================================================ */

function renderSaving(
    saving = true
) {

    const dom =
        getDOM();


    if (
        !dom.saveButton
    ) {

        return;
    }


    dom.saveButton.disabled =
        Boolean(saving);


    if (saving) {

        if (
            !dom.saveButton.dataset
                .originalText
        ) {

            dom.saveButton.dataset
                .originalText =
                    dom.saveButton.textContent;
        }


        dom.saveButton.textContent =
            "Menyimpan...";

    } else {

        dom.saveButton.textContent =
            dom.saveButton.dataset
                .originalText ||
            "Simpan Perubahan";
    }
}


/* ============================================================
   ALERT
============================================================ */

function renderAlert(
    message = "",
    type = "error"
) {

    const dom =
        getDOM();


    if (
        !dom.alert
    ) {

        return;
    }


    dom.alert.textContent =
        valueOrEmpty(
            message
        );


    dom.alert.className =
        message
            ? `alert show ${type}`
            : "alert";
}


function clearAlert() {

    renderAlert(
        "",
        "error"
    );
}


function renderError(
    message
) {

    renderAlert(
        message ||
            "Terjadi kesalahan.",
        "error"
    );
}


function renderSuccess(
    message
) {

    renderAlert(
        message ||
            "Perubahan berhasil disimpan.",
        "success"
    );
}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditRender =
    Object.freeze({

        renderModel,

        renderParameters,

        renderStatus,

        renderLoading,

        renderSaving,

        renderAlert,

        clearAlert,

        renderError,

        renderSuccess,

        updateResolutionPricing,

        updatePricePreview,

        calculateFinalCredit,

        formatCredit,

        formatDiscount,

        normalizeArray,

        getParameterDefinition,

        getParameterValues,

        getParameterDefault,

        isModelActive
    });


window.GENZModelEditRender =
    GENZModelEditRender;


export {

    renderModel,

    renderParameters,

    renderStatus,

    renderLoading,

    renderSaving,

    renderAlert,

    clearAlert,

    renderError,

    renderSuccess,

    updateResolutionPricing,

    updatePricePreview,

    calculateFinalCredit,

    formatCredit,

    formatDiscount,

    normalizeArray,

    getParameterDefinition,

    getParameterValues,

    getParameterDefault,

    isModelActive
};
