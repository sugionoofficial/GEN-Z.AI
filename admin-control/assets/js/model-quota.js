/* =========================================================
   GEN-Z.AI
   MODEL QUOTA (QWENCLOUD FREE TIER)
   ---------------------------------------------------------
   File:
   lib/generate/model-quota.js

   Fungsi:
   - Menormalkan data kuota dari view qwencloud_model_quota
   - Menghitung persentase & level peringatan
   - Format label Indonesia (detik, tanggal)

   Pemakaian (used/remaining) murni berasal dari view
   qwencloud_model_quota yang menghitung generation_history:
   task "processing" memotong kuota, task gagal mengembalikannya.
   Tidak ada lagi pemakaian manual.

   Tidak menangani:
   - Query Supabase
   - Render UI
   - Auto nonaktif / refund (dilakukan trigger Postgres)
========================================================= */

"use strict";


/* =========================================================
   DEFAULTS
========================================================= */

export const QWENCLOUD_PROVIDER_CODE =
    "qwencloud";

export const QWENCLOUD_DEFAULT_QUOTA_SECONDS = {

    wan: 50,

    happyhorse: 10

};


export const QUOTA_LEVELS = [

    "unknown",

    "safe",

    "warning",

    "critical",

    "empty"

];


const MONTHS = [

    "Jan",

    "Feb",

    "Mar",

    "Apr",

    "Mei",

    "Jun",

    "Jul",

    "Agu",

    "Sep",

    "Okt",

    "Nov",

    "Des"

];


/* =========================================================
   HELPERS
========================================================= */

function isBlank(
    value
) {

    return (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    );

}


function toNumber(
    value,
    fallback = 0
) {

    const number =
        Number(
            String(
                value ?? ""
            ).trim()
        );

    return Number.isFinite(number)
        ? number
        : fallback;

}


export function clampPercent(
    value
) {

    const number =
        toNumber(value);

    if (number < 0) {
        return 0;
    }

    if (number > 100) {
        return 100;
    }

    return Math.round(number);

}


/* =========================================================
   DEFAULT TOTAL
========================================================= */

export function resolveDefaultQuotaSeconds(
    modelId = ""
) {

    const id =
        String(modelId || "")
            .trim()
            .toLowerCase();

    if (!id) {
        return QWENCLOUD_DEFAULT_QUOTA_SECONDS.wan;
    }

    if (id.includes("happyhorse")) {
        return QWENCLOUD_DEFAULT_QUOTA_SECONDS.happyhorse;
    }

    return QWENCLOUD_DEFAULT_QUOTA_SECONDS.wan;

}


/* =========================================================
   LEVEL
========================================================= */

export function resolveQuotaLevel(
    percent,
    remainingSeconds,
    totalSeconds
) {

    if (
        !Number.isFinite(
            Number(totalSeconds)
        ) ||
        Number(totalSeconds) <= 0
    ) {

        return "unknown";

    }

    if (Number(remainingSeconds) <= 0) {
        return "empty";
    }

    const value =
        clampPercent(percent);

    if (value <= 20) {
        return "critical";
    }

    if (value <= 50) {
        return "warning";
    }

    return "safe";

}


/* =========================================================
   STATE
========================================================= */

export function resolveQuotaState(
    quota = null
) {

    const source =
        quota &&
        typeof quota === "object"
            ? quota
            : {};


    const totalSeconds =
        Math.max(
            toNumber(
                source.total_seconds,
                0
            ),
            0
        );


    const rawUsed =
        isBlank(source.used_seconds)
            ? null
            : toNumber(source.used_seconds, 0);


    const rawRemaining =
        isBlank(source.remaining_seconds)
            ? null
            : toNumber(source.remaining_seconds, 0);


    /*
     * View mengirim used + remaining. Kalau salah satunya
     * tidak ada (mis. baris baru), hitung dari yang lain.
     */

    const usedSeconds =
        Math.max(
            rawUsed ??
            (
                rawRemaining !== null
                    ? Math.max(totalSeconds - rawRemaining, 0)
                    : 0
            ),
            0
        );


    const tracked =
        totalSeconds > 0;


    const remainingSeconds =
        tracked
            ? Math.max(
                rawRemaining !== null
                    ? rawRemaining
                    : totalSeconds - usedSeconds,
                0
            )
            : 0;


    const percent =
        tracked
            ? clampPercent(
                isBlank(source.remaining_percent)
                    ? (
                        remainingSeconds *
                        100 /
                        totalSeconds
                    )
                    : source.remaining_percent
            )
            : 0;


    const expiresAt =
        source.expires_at
            ? String(source.expires_at)
            : null;


    const expired =
        Boolean(
            expiresAt &&
            !Number.isNaN(
                Date.parse(expiresAt)
            ) &&
            Date.parse(expiresAt) <
            Date.now()
        );


    return {

        tracked,

        totalSeconds,

        usedSeconds,

        remainingSeconds,

        percent,

        expiresAt,

        expired,

        autoDisabledAt:
            source.auto_disabled_at || null,

        autoDisabled:
            Boolean(source.auto_disabled_at),

        level:
            resolveQuotaLevel(
                percent,
                remainingSeconds,
                totalSeconds
            ),

        exhausted:
            tracked &&
            (
                remainingSeconds <= 0 ||
                expired
            )

    };

}


/* =========================================================
   FORMAT
========================================================= */

export function formatQuotaSeconds(
    value
) {

    const seconds =
        Math.max(
            Math.round(
                toNumber(value)
            ),
            0
        );

    return `${seconds} detik`;

}


export function formatQuotaDate(
    value
) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(
            String(value)
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }

    return `${date.getUTCDate()} ${
        MONTHS[date.getUTCMonth()]
    } ${date.getUTCFullYear()}`;

}


export function formatQuotaLabel(
    state
) {

    const quota =
        state &&
        typeof state === "object"
            ? state
            : resolveQuotaState(null);


    if (!quota.tracked) {
        return "Kuota tidak dilacak (total 0 detik)";
    }


    if (quota.expired) {
        return `Kuota kedaluwarsa · ${formatQuotaDate(
            quota.expiresAt
        )}`;
    }


    const remaining =
        `Sisa ${quota.percent}% · ${
            formatQuotaSeconds(quota.remainingSeconds)
        } dari ${formatQuotaSeconds(quota.totalSeconds)}`;


    if (quota.expiresAt) {
        return `${remaining} · kedaluwarsa ${formatQuotaDate(
            quota.expiresAt
        )}`;
    }


    return remaining;

}


export function formatQuotaStatusLabel(
    state
) {

    const quota =
        state &&
        typeof state === "object"
            ? state
            : resolveQuotaState(null);


    if (quota.autoDisabled) {
        return "Dinonaktifkan otomatis karena kuota habis";
    }

    if (quota.exhausted) {
        return "Kuota habis";
    }

    switch (quota.level) {

        case "critical":
            return "Kuota hampir habis";

        case "warning":
            return "Kuota menipis";

        case "safe":
            return "Kuota aman";

        default:
            return "Kuota belum diatur";

    }

}
