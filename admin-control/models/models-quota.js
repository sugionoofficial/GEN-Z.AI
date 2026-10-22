/* =========================================================
   GEN-Z.AI
   MODELS — QWENCLOUD QUOTA SECTION
   ---------------------------------------------------------
   File:
   admin-control/models/models-quota.js

   Tanggung jawab:
   - Menampilkan blok kuota QwenCloud pada modal Tambah Model
     hanya ketika provider yang dipilih adalah QwenCloud.

   Tidak bertanggung jawab:
   - Query Supabase
   - Menyimpan data (dilakukan model-form-create + API)
========================================================= */

"use strict";

import {
    QWENCLOUD_PROVIDER_CODE,
    resolveDefaultQuotaSeconds
} from "../assets/js/model-quota.js";


/* =========================================================
   DOM
========================================================= */

function getFields() {

    return document.getElementById("quotaFields");

}


function getProviderSelect() {

    return (
        document.getElementById("providerId") ||
        document.getElementById("provider_id")
    );

}


function getModelIdField() {

    return (
        document.getElementById("modelCodeSearch") ||
        document.getElementById("modelId") ||
        document.getElementById("model_id")
    );

}


/* =========================================================
   PROVIDER DETECTION
========================================================= */

function selectedProviderOption() {

    const select =
        getProviderSelect();

    if (!select) {
        return null;
    }

    return (
        select.selectedOptions?.[0] ||
        null
    );

}


function isQwenCloudSelected() {

    const option =
        selectedProviderOption();

    if (!option) {
        return false;
    }

    const code =
        String(
            option.dataset?.providerId ||
            option.dataset?.providerCode ||
            ""
        )
            .trim()
            .toLowerCase();

    if (code === QWENCLOUD_PROVIDER_CODE) {
        return true;
    }

    return String(
        option.textContent || ""
    )
        .trim()
        .toLowerCase()
        .includes(QWENCLOUD_PROVIDER_CODE);

}


/* =========================================================
   SYNC
========================================================= */

function sync() {

    const fields =
        getFields();

    if (!fields) {
        return;
    }

    const visible =
        isQwenCloudSelected();

    fields.hidden =
        !visible;

    if (!visible) {
        return;
    }

    const totalInput =
        document.getElementById("quotaTotalSeconds");

    if (
        totalInput &&
        !String(totalInput.value || "").trim()
    ) {

        totalInput.value =
            resolveDefaultQuotaSeconds(
                getModelIdField()?.value
            );

    }

}


/* =========================================================
   INIT
========================================================= */

function init() {

    sync();

    getProviderSelect()?.addEventListener(
        "change",
        sync
    );

    getModelIdField()?.addEventListener(
        "input",
        () => {

            const totalInput =
                document.getElementById("quotaTotalSeconds");

            if (
                totalInput &&
                !String(totalInput.value || "").trim()
            ) {

                sync();

            }

        }
    );


    /*
     * Modal dibuka ulang lewat tombol "Tambah Model":
     * class/style modal berubah, jadi sinkronkan lagi.
     */

    const modal =
        document.getElementById("modelModal");

    if (modal) {

        const observer =
            new MutationObserver(
                () => sync()
            );

        observer.observe(
            modal,
            {
                attributes: true,
                attributeFilter: [
                    "class",
                    "style",
                    "aria-hidden"
                ]
            }
        );

    }

}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();

}


window.GENZModelQuota = {
    sync
};
