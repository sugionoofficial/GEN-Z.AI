/* =========================================================
   GEN-Z.AI
   QWENCLOUD CREDIT — DURATION BILLING
   ---------------------------------------------------------
   File:
     lib/generate/qwencloud-credit.js

   Kenapa ada file ini:
   QwenCloud (Alibaba Cloud Model Studio / DashScope) menagih
   model video PER DETIK, dan kuota gratis juga dihitung per
   detik (50 detik per model). Credit GEN-Z.AI disimpan per
   resolusi (flat), sehingga tanpa faktor durasi video 15
   detik akan memakai credit yang sama dengan video 5 detik
   padahal biaya provider 3x lebih besar.

   Aturan blok:
   - 1 blok = 5 detik (durasi minimum Wan 2.x)
   - 5s  → 1x
   - 10s → 2x
   - 15s → 3x
   - model tanpa parameter durasi (Wan Animate) → 1x
   - faktor dibatasi 10x sebagai pengaman salah input

   File ini murni fungsi (tanpa I/O) agar mudah diuji.
========================================================= */

export const QWENCLOUD_PROVIDER_ID =
    "qwencloud";


export const QWENCLOUD_BILLING_BLOCK_SECONDS =
    5;


export const QWENCLOUD_MAX_DURATION_FACTOR =
    10;


/* =========================================================
   DETEKSI MODEL QWENCLOUD
========================================================= */

export function isQwenCloudModel(
    modelConfig,
    modelId
) {

    const providerId =
        String(
            modelConfig?.providerId ||
            modelConfig?.provider_id ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        providerId ===
        QWENCLOUD_PROVIDER_ID
    ) {

        return true;

    }


    /*
     * Fallback: id model QwenCloud selalu diawali "qwen-".
     * Berguna saat adapter config belum tersedia.
     */

    return String(
        modelId || ""
    )
        .trim()
        .toLowerCase()
        .startsWith(
            "qwen-"
        );

}


/* =========================================================
   DURASI
========================================================= */

export function resolveDurationSeconds(
    parameters
) {

    const raw =
        parameters?.duration;


    if (
        raw === null ||
        raw === undefined ||
        raw === ""
    ) {

        return null;

    }


    const duration =
        Number(
            String(
                raw
            ).trim()
        );


    if (
        !Number.isFinite(
            duration
        ) ||
        duration <= 0
    ) {

        return null;

    }


    return duration;

}


export function resolveDurationFactor(
    parameters
) {

    const duration =
        resolveDurationSeconds(
            parameters
        );


    if (
        duration === null
    ) {

        return 1;

    }


    const factor =
        Math.ceil(
            duration /
            QWENCLOUD_BILLING_BLOCK_SECONDS
        );


    return Math.min(
        QWENCLOUD_MAX_DURATION_FACTOR,
        Math.max(
            1,
            factor
        )
    );

}


/* =========================================================
   ROUNDING CREDIT
========================================================= */

export function roundCredit(
    value
) {

    return (
        Math.round(
            (
                Number(
                    value
                ) || 0
            ) * 100
        ) / 100
    );

}


/* =========================================================
   TOTAL BILLABLE CREDIT
========================================================= */

export function resolveBillableCredit(
    credit,
    parameters,
    modelConfig = null,
    modelId = ""
) {

    const durationSeconds =
        resolveDurationSeconds(
            parameters
        );


    const durationFactor =
        isQwenCloudModel(
            modelConfig,
            modelId
        )
            ? resolveDurationFactor(
                parameters
            )
            : 1;


    return {

        durationSeconds,

        durationFactor,

        creditUnit:
            roundCredit(
                credit
            ),

        billableCredit:
            roundCredit(
                (
                    Number(
                        credit
                    ) || 0
                ) *
                durationFactor
            )

    };

}


export default Object.freeze({

    QWENCLOUD_PROVIDER_ID,
    QWENCLOUD_BILLING_BLOCK_SECONDS,
    QWENCLOUD_MAX_DURATION_FACTOR,

    isQwenCloudModel,
    resolveDurationSeconds,
    resolveDurationFactor,
    resolveBillableCredit,
    roundCredit

});
