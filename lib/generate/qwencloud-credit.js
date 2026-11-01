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


export const OPUS_PROVIDER_ID =
    "opus";


export const QWENCLOUD_BILLING_BLOCK_SECONDS =
    5;


export const QWENCLOUD_MAX_DURATION_FACTOR =
    10;


/* =========================================================
   DETEKSI MODEL QWENCLOUD & OPUS
========================================================= */

export function isOpusModel(
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
        OPUS_PROVIDER_ID
    ) {

        return true;

    }


    return String(
        modelId || ""
    )
        .trim()
        .toLowerCase()
        .startsWith(
            "opus-"
        );

}


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

/* =========================================================
   DURASI UNTUK PEMAKAIAN KUOTA
   ---------------------------------------------------------
   Kuota QwenCloud dipotong per detik dari kolom duration
   generation_history. Model tanpa parameter durasi
   (Wan Animate, HappyHorse Video Edit) tetap harus mencatat
   angka supaya kuota terpotong saat generate.

   Aturan:
   - durasi eksplisit dari pengguna dipakai apa adanya
   - kalau model punya min durasi, pakai min durasi
   - selain itu satu blok billing (5 detik), sama dengan
     faktor credit model tanpa durasi
   - provider lain tidak memakai kuota QwenCloud (null)

   api/generate-status.js menimpanya dengan usage.duration
   dari QwenCloud setelah task selesai.
   ========================================================= */

export function toPositiveIntegerSeconds(
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
        Number(
            String(
                value
            ).trim()
        );


    if (
        !Number.isFinite(
            number
        ) ||
        number <= 0
    ) {

        return null;

    }


    return Math.trunc(
        number
    );

}


export function resolveQuotaUsageSeconds(
    duration,
    minDuration,
    providerCode = QWENCLOUD_PROVIDER_ID
) {

    const code =
        String(
            providerCode || ""
        )
            .trim()
            .toLowerCase();


    if (
        code !==
        QWENCLOUD_PROVIDER_ID
    ) {

        return null;

    }


    const explicit =
        toPositiveIntegerSeconds(
            duration
        );


    if (explicit !== null) {

        return explicit;

    }


    const minimum =
        toPositiveIntegerSeconds(
            minDuration
        );


    if (minimum !== null) {

        return minimum;

    }


    return QWENCLOUD_BILLING_BLOCK_SECONDS;

}


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


function isStaged30sVideoModel(
    modelConfig = null,
    modelId = ""
) {
    const candidateId = String(
        modelConfig?.id ||
        modelConfig?.model_id ||
        modelId ||
        ""
    )
        .trim()
        .toLowerCase();

    if (
        modelConfig?.videoDirector === true ||
        candidateId === "opus-video-director"
    ) {
        return false;
    }

    if (modelConfig && modelConfig.staged30s === true) {
        return true;
    }

    return (
        candidateId === "opus-seedance-2.5-r2v-30s" ||
        candidateId === "opus-seedance-2.5-t2v-30s" ||
        candidateId === "opus-seedance-2.5-i2v-30s" ||
        candidateId === "opus-hailuo-3-i2v-30s"
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


    /*
     * Khusus model bertahap Seedance 2.5 Reference to Video (30s):
     * - Durasi 30 detik (3 klip × 10 detik) = 100% tarif dasar model (mis. 6.000 / 7.500)
     * - Durasi 20 detik (2 klip × 10 detik) = proporsional 2/3 dari tarif 30 detik (mis. 4.000 / 5.000)
     */
    if (
        isStaged30sVideoModel(
            modelConfig,
            modelId
        ) &&
        durationSeconds === 20
    ) {
        const numericCredit = Number(credit) || 0;
        const twoThirdsCredit = Math.round((numericCredit * 2) / 3);

        return {
            durationSeconds,
            durationFactor: roundCredit(2 / 3),
            creditUnit: roundCredit(credit),
            billableCredit: roundCredit(twoThirdsCredit)
        };
    }


    /*
     * PENTING:
     * Hanya model QwenCloud yang dikalikan per blok durasi 5 detik.
     * Model Opus Labs lainnya (serta provider lain seperti Motiongen, Kie, dll.)
     * memotong kredit TEPAT sesuai nilai yang diatur admin pada halaman
     * Edit Model (`credit_480p` / `credit_720p` / `credit_1080p` dikurangi diskon),
     * tanpa dikalikan durasi (`durationFactor = 1`).
     */
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
    OPUS_PROVIDER_ID,
    QWENCLOUD_BILLING_BLOCK_SECONDS,
    QWENCLOUD_MAX_DURATION_FACTOR,

    isQwenCloudModel,
    isOpusModel,
    resolveDurationSeconds,
    resolveDurationFactor,
    resolveBillableCredit,
    roundCredit

});
