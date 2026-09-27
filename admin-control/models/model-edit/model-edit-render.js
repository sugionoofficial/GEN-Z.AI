"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT RENDER
 *
 * Tanggung jawab:
 * - Menampilkan data model ke halaman
 * - Mengisi hero model
 * - Mengisi field form
 * - Menampilkan status
 * - Menampilkan parameter
 * - Menampilkan pricing
 *
 * Tidak melakukan:
 * - API request
 * - Save
 * - Load model
 * - Event binding
 * ============================================================
 */

import {
    getDOM
} from "./model-edit-state.js";


/* ============================================================
   SAFE VALUE
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


/* ============================================================
   NUMBER FORMAT
============================================================ */

function formatNumber(
    value,
    fallback = "0"
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return fallback;
    }


    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return fallback;
    }


    return number.toLocaleString(
        "id-ID"
    );
}


/* ============================================================
   CURRENCY FORMAT
============================================================ */

function formatCurrency(
    value,
    currency = "IDR"
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return "-";
    }


    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "-";
    }


    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }
    ).format(number);
}


/* ============================================================
   NORMALIZE STATUS
============================================================ */

function isModelActive(
    model
) {

    const status =
        String(
            model?.status ||
            ""
        )
        .trim()
        .toLowerCase();


    return (
        status === "active" ||
        status === "aktif" ||
        status === "enabled" ||
        status === "true"
    );
}


/* ============================================================
   SET TEXT
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


/* ============================================================
   SET VALUE
============================================================ */

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


    const modelName =
        model.model_name ||
        model.name ||
        model.model_id ||
        "-";


    const modelId =
        model.model_id ||
        model.id ||
        "-";


    const providerName =
        model.provider_name ||
        model.provider?.provider_name ||
        model.provider?.name ||
        model.provider_id ||
        "-";


    const modelType =
        model.type ||
        model.model_type ||
        model.family ||
        "Video";


    const description =
        model.description ||
        "";


    /* --------------------------------------------------------
       HERO
    -------------------------------------------------------- */

    setText(
        dom.heroModelName,
        modelName
    );


    setText(
        dom.heroModelId,
        modelId
    );


    setText(
        dom.heroProvider,
        providerName
    );


    setText(
        dom.heroType,
        modelType
    );


    /* --------------------------------------------------------
       FORM BASIC
    -------------------------------------------------------- */

    setValue(
        dom.modelName,
        modelName
    );


    setValue(
        dom.modelId,
        modelId
    );


    setValue(
        dom.provider,
        providerName
    );


    setValue(
        dom.type,
        modelType
    );


    setValue(
        dom.description,
        description
    );


    /* --------------------------------------------------------
       STATUS
    -------------------------------------------------------- */

    const active =
        isModelActive(
            model
        );


    if (dom.statusToggle) {

        if (
            dom.statusToggle.type ===
            "checkbox"
        ) {

            dom.statusToggle.checked =
                active;

        } else {

            dom.statusToggle.value =
                active
                    ? "active"
                    : "inactive";
        }
    }


    setText(
        dom.statusText,
        active
            ? "Aktif"
            : "Nonaktif"
    );


    setText(
        dom.statusDescription,
        active
            ? "Model tersedia untuk digunakan."
            : "Model tidak tersedia untuk digunakan."
    );


    /* --------------------------------------------------------
       KIE PRICE
    -------------------------------------------------------- */

    const kiePrice =
        model.kie_price ??
        model.price_usd ??
        model.usd_price ??
        null;


    const currency =
        model.kie_currency ||
        model.currency ||
        "USD";


    setValue(
        dom.priceUsd,
        kiePrice
    );


    if (dom.priceUsd) {

        if (
            dom.priceUsd.tagName ===
            "INPUT"
        ) {

            dom.priceUsd.value =
                valueOrEmpty(
                    kiePrice
                );
        }
    }


    /* --------------------------------------------------------
       EXCHANGE RATE
    -------------------------------------------------------- */

    const exchangeRate =
        model.exchange_rate ??
        model.usd_to_idr ??
        model.exchangeRate ??
        null;


    setValue(
        dom.exchangeRate,
        exchangeRate
    );


    /* --------------------------------------------------------
       DISCOUNT
    -------------------------------------------------------- */

    const discount =
        model.discount_percent ??
        model.discount ??
        0;


    setValue(
        dom.discount,
        discount
    );


    /* --------------------------------------------------------
       CREDIT
    -------------------------------------------------------- */

    setValue(
        dom.credit480p,
        model.credit_480p
    );


    setValue(
        dom.credit720p,
        model.credit_720p
    );


    setValue(
        dom.credit1080p,
        model.credit_1080p
    );


    /* --------------------------------------------------------
       FINAL PRICE
    -------------------------------------------------------- */

    const finalPrice =
        model.credit_final ??
        model.final_price ??
        model.finalPrice ??
        null;


    if (dom.finalPrice) {

        if (
            dom.finalPrice.tagName ===
            "INPUT"
        ) {

            dom.finalPrice.value =
                valueOrEmpty(
                    finalPrice
                );

        } else {

            dom.finalPrice.textContent =
                finalPrice === null
                    ? "-"
                    : formatNumber(
                        finalPrice
                    );
        }
    }


    /* --------------------------------------------------------
       DURATION
    -------------------------------------------------------- */

    let duration = "";


    if (
        model.min_duration !==
            undefined &&
        model.max_duration !==
            undefined &&
        model.min_duration !==
            null &&
        model.max_duration !==
            null
    ) {

        duration =
            `${model.min_duration} - ${model.max_duration}`;

    } else if (
        model.duration !==
            undefined &&
        model.duration !== null
    ) {

        duration =
            model.duration;
    }


    setValue(
        dom.duration,
        duration
    );


    /* --------------------------------------------------------
       RATIO
    -------------------------------------------------------- */

    const ratio =
        model.supported_ratios ??
        model.ratios ??
        model.ratio ??
        "";


    setValue(
        dom.ratio,
        normalizeListValue(
            ratio
        )
    );


    /* --------------------------------------------------------
       RESOLUTION
    -------------------------------------------------------- */

    const resolution =
        model.supported_resolutions ??
        model.resolutions ??
        model.resolution ??
        "";


    setValue(
        dom.resolution,
        normalizeListValue(
            resolution
        )
    );


    /* --------------------------------------------------------
       MODEL HERO STATE
    -------------------------------------------------------- */

    if (dom.modelHero) {

        dom.modelHero.dataset.status =
            active
                ? "active"
                : "inactive";

        dom.modelHero.dataset.modelId =
            valueOrEmpty(
                modelId
            );
    }


    return model;
}


/* ============================================================
   NORMALIZE ARRAY / STRING
============================================================ */

function normalizeListValue(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value.join(
            ", "
        );
    }


    if (
        typeof value ===
        "object" &&
        value !== null
    ) {

        return Object.values(
            value
        ).join(", ");
    }


    return valueOrEmpty(
        value
    );
}


/* ============================================================
   RENDER LOADING
============================================================ */

function renderLoading(
    loading = true,
    message = "Memuat data model..."
) {

    const dom =
        getDOM();


    if (dom.loading) {

        dom.loading.hidden =
            !loading;
    }


    if (dom.loadingText) {

        dom.loadingText.textContent =
            message;
    }


    if (dom.modelHero) {

        dom.modelHero.classList.toggle(
            "is-loading",
            loading
        );
    }
}


/* ============================================================
   RENDER SAVE STATE
============================================================ */

function renderSaving(
    saving = true
) {

    const dom =
        getDOM();


    if (dom.saveButton) {

        dom.saveButton.disabled =
            saving;


        dom.saveButton.dataset.saving =
            saving
                ? "true"
                : "false";


        if (saving) {

            dom.saveButton.dataset.originalText =
                dom.saveButton.textContent;

            dom.saveButton.textContent =
                "Menyimpan...";

        } else {

            const original =
                dom.saveButton.dataset
                    .originalText;


            if (original) {

                dom.saveButton.textContent =
                    original;
            }
        }
    }


    if (dom.cancelButton) {

        dom.cancelButton.disabled =
            saving;
    }
}


/* ============================================================
   RENDER ALERT
============================================================ */

function renderAlert(
    message = "",
    type = "info"
) {

    const dom =
        getDOM();


    if (!dom.alert) {
        return;
    }


    dom.alert.textContent =
        valueOrEmpty(
            message
        );


    dom.alert.dataset.type =
        type;


    dom.alert.hidden =
        !message;
}


/* ============================================================
   CLEAR ALERT
============================================================ */

function clearAlert() {

    renderAlert(
        "",
        "info"
    );
}


/* ============================================================
   RENDER ERROR
============================================================ */

function renderError(
    message
) {

    renderAlert(
        message ||
            "Terjadi kesalahan.",
        "error"
    );
}


/* ============================================================
   RENDER SUCCESS
============================================================ */

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

        renderLoading,

        renderSaving,

        renderAlert,

        clearAlert,

        renderError,

        renderSuccess,

        formatNumber,

        formatCurrency,

        normalizeListValue,

        isModelActive
    });


window.GENZModelEditRender =
    GENZModelEditRender;


export {

    renderModel,

    renderLoading,

    renderSaving,

    renderAlert,

    clearAlert,

    renderError,

    renderSuccess,

    formatNumber,

    formatCurrency,

    normalizeListValue,

    isModelActive
};
