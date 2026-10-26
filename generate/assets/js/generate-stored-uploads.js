/* =========================================================
   GEN-Z.AI
   GENERATE STORED UPLOADS
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-stored-uploads.js

   Tanggung jawab:
   - Mendaftar file yang SUDAH diunggah user ke halaman
     Generate dan masih berlaku (maksimal 1 jam).
   - Menukar path storage menjadi signed URL sekali pakai.
   - Panel UI "Unggahan tersimpan" untuk dipakai ulang tanpa
     mengunggah ulang.

   Tidak bertanggung jawab:
   - Upload file baru
   - Validasi isi media (dilakukan saat upload)
   - Submit / credit

   Latar belakang (laporan pengguna):
   Foto yang diunggah di halaman Generate sudah tersimpan di
   Supabase Storage (bucket privat `user-uploads`, prefix
   `generate-input/`), dan aturan RLS mengizinkan user membaca
   folder miliknya sendiri. Tetapi halaman tidak pernah
   menampilkan daftar itu, jadi selama masa berlaku 1 jam pun
   file hanya bisa dipakai kalau diunggah ulang.

   Catatan kejujuran:
   - Retensi upload TETAP 1 jam (aturan cron di
     lib/storage-retention/cleanup.js). Panel ini hanya
     menampilkan yang masih ada, tidak memperpanjang umur file.
   - File yang sudah lewat 1 jam TIDAK ditampilkan, dan kalau
     terlanjur dipilih lalu hilang, UI mengatakan file sudah
     dihapus — bukan error samar.
========================================================= */

"use strict";

import {
    STORAGE_BUCKET,
    STORAGE_URL_TTL_SECONDS
} from "./generate-form-upload.js";


/* =========================================================
   KONSTANTA
========================================================= */

/** Sama dengan UPLOAD_TTL_MS pada cron retensi (1 jam). */
export const STORED_UPLOAD_TTL_MS =
    60 * 60 * 1000;

/** Prefix upload halaman Generate. */
export const STORED_UPLOAD_ROOT =
    "generate-input";

/** Batas jumlah unggahan yang ditampilkan sekaligus. */
export const STORED_UPLOAD_LIMIT =
    12;

/** Di bawah sisa waktu ini, user diberi peringatan. */
export const STORED_UPLOAD_SOON_MS =
    5 * 60 * 1000;

/** Batas jumlah folder (satu folder = satu upload). */
const STORED_UPLOAD_FOLDER_LIMIT =
    40;

/** Toleransi jam perangkat yang sedikit mendahului jam server. */
const CLOCK_SKEW_TOLERANCE_MS =
    5 * 60 * 1000;

const KIND_LABELS =
    Object.freeze({
        image: "Foto",
        video: "Video",
        audio: "Audio"
    });


/* =========================================================
   PURE HELPERS
========================================================= */

/**
 * Urai path storage `generate-input/<userId>/<timestamp>/<file>`.
 *
 * @returns {{userId: string, folder: string, createdAt: number, name: string}|null}
 */
export function parseStoredUploadPath(
    path
) {

    const parts =
        String(
            path ||
            ""
        )
            .split(
                "/"
            )
            .filter(
                Boolean
            );


    if (
        parts.length < 4 ||
        parts[0] !== STORED_UPLOAD_ROOT
    ) {

        return null;
    }


    const folder =
        parts[2];


    if (
        !/^\d{10,16}$/.test(
            folder
        )
    ) {

        return null;
    }


    return {
        userId:
            parts[1],

        folder,

        createdAt:
            Number(
                folder
            ),

        name:
            parts.slice(
                3
            )
                .join(
                    "/"
                )
    };
}


/**
 * Jenis media dari MIME type, dengan cadangan ekstensi file.
 *
 * @returns {"image"|"video"|"audio"|""}
 */
export function getStoredUploadKind(
    entry = {}
) {

    const mime =
        String(
            entry?.mimeType ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        mime.startsWith(
            "image/"
        )
    ) {

        return "image";
    }


    if (
        mime.startsWith(
            "video/"
        )
    ) {

        return "video";
    }


    if (
        mime.startsWith(
            "audio/"
        )
    ) {

        return "audio";
    }


    const name =
        String(
            entry?.name ||
            ""
        )
            .toLowerCase();


    if (
        /\.(jpe?g|png|webp|gif|avif)$/.test(
            name
        )
    ) {

        return "image";
    }


    if (
        /\.(mp4|webm|mov|m4v)$/.test(
            name
        )
    ) {

        return "video";
    }


    if (
        /\.(mp3|wav|m4a|aac|ogg|opus)$/.test(
            name
        )
    ) {

        return "audio";
    }


    return "";
}


/** Sisa umur file pada saat `now`. */
export function getStoredUploadRemainingMs(
    createdAt,
    options = {}
) {

    const now =
        Number.isFinite(
            options.now
        )
            ? options.now
            : Date.now();

    const maxAgeMs =
        Number.isFinite(
            options.maxAgeMs
        )
            ? options.maxAgeMs
            : STORED_UPLOAD_TTL_MS;

    const created =
        Number(
            createdAt
        );


    if (
        !Number.isFinite(
            created
        ) ||
        created <= 0
    ) {

        return 0;
    }


    return Math.max(
        0,
        created +
            maxAgeMs -
            now
    );
}


/** Apakah upload masih dalam masa berlaku 1 jam? */
export function isStoredUploadFresh(
    entry,
    options = {}
) {

    const created =
        Number(
            entry?.createdAt
        );

    const maxAgeMs =
        Number.isFinite(
            options.maxAgeMs
        )
            ? options.maxAgeMs
            : STORED_UPLOAD_TTL_MS;


    if (
        !Number.isFinite(
            created
        ) ||
        created <= 0
    ) {

        return false;
    }


    const age =
        getStoredUploadRemainingMs(
            created,
            options
        );


    if (
        age <= 0
    ) {

        return false;
    }


    const now =
        Number.isFinite(
            options.now
        )
            ? options.now
            : Date.now();


    /* Folder dari masa depan (jam perangkat mundur) tetap
       diterima selama selisihnya wajar. */
    return (
        created - now <=
        CLOCK_SKEW_TOLERANCE_MS
    );
}


/**
 * Label sisa waktu yang ramah dibaca.
 * Contoh: "sisa 42 menit", "kurang dari 1 menit".
 */
export function formatStoredUploadRemaining(
    expiresAt,
    options = {}
) {

    const now =
        Number.isFinite(
            options.now
        )
            ? options.now
            : Date.now();

    const remaining =
        Math.max(
            0,
            Number(
                expiresAt
            ) -
                now
        );


    if (
        remaining <= 0
    ) {

        return "kedaluwarsa";
    }


    if (
        remaining <
        60 * 1000
    ) {

        return "kurang dari 1 menit";
    }


    const minutes =
        Math.ceil(
            remaining /
                60000
        );


    return `sisa ${minutes} menit`;
}


export function getStoredUploadKindLabel(
    kind
) {

    return KIND_LABELS[kind] ||
        "Media";
}


/* =========================================================
   LISTING
========================================================= */

/**
 * Daftar unggahan yang masih berlaku, terbaru lebih dulu.
 *
 * Satu upload = satu folder `<timestamp>`, sehingga umur file
 * bisa diketahui tanpa membaca metadata tambahan.
 *
 * @returns {Promise<Array<{path: string, name: string, kind: string,
 *   mimeType: string, size: number, createdAt: number,
 *   expiresAt: number, url: string}>>}
 */
export async function listStoredUploads(
    options = {}
) {

    const supabase =
        options.supabase;

    const userId =
        String(
            options.userId ||
            ""
        )
            .trim();

    const now =
        Number.isFinite(
            options.now
        )
            ? options.now
            : Date.now();

    const maxAgeMs =
        Number.isFinite(
            options.maxAgeMs
        )
            ? options.maxAgeMs
            : STORED_UPLOAD_TTL_MS;

    const limit =
        Number.isFinite(
            options.limit
        ) &&
        options.limit > 0
            ? Math.floor(
                options.limit
            )
            : STORED_UPLOAD_LIMIT;

    const kinds =
        Array.isArray(
            options.kinds
        ) &&
        options.kinds.length > 0
            ? options.kinds
            : null;


    if (
        !supabase ||
        !userId
    ) {

        return [];
    }


    const bucket =
        supabase
            .storage
            .from(
                STORAGE_BUCKET
            );


    const root =
        `${STORED_UPLOAD_ROOT}/${userId}`;


    const folderResult =
        await bucket.list(
            root,
            {
                limit:
                    STORED_UPLOAD_FOLDER_LIMIT,

                sortBy: {
                    column:
                        "name",

                    order:
                        "desc"
                }
            }
        );


    if (
        folderResult?.error
    ) {

        throw folderResult.error;
    }


    const folders =
        Array.isArray(
            folderResult?.data
        )
            ? folderResult.data
            : [];


    const freshFolders =
        folders
            .map(
                folder => ({
                    folder,

                    createdAt:
                        Number(
                            folder?.name
                        )
                })
            )
            .filter(
                item =>
                    isStoredUploadFresh(
                        {
                            createdAt:
                                item.createdAt
                        },
                        {
                            now,
                            maxAgeMs
                        }
                    )
            )
            .sort(
                (
                    left,
                    right
                ) =>
                    right.createdAt -
                    left.createdAt
            );


    const entries = [];


    for (
        const item
        of freshFolders
    ) {

        if (
            entries.length >=
            limit
        ) {

            break;
        }


        const folderPath =
            `${root}/${item.folder.name}`;


        let fileResult;


        try {

            fileResult =
                await bucket.list(
                    folderPath,
                    {
                        limit:
                            20
                    }
                );

        } catch (
            listError
        ) {

            console.warn(
                "[GEN-Z.AI][Stored Uploads] Gagal membaca folder:",
                folderPath,
                listError?.message ||
                listError
            );

            continue;
        }


        if (
            fileResult?.error
        ) {

            console.warn(
                "[GEN-Z.AI][Stored Uploads] Gagal membaca folder:",
                folderPath,
                fileResult.error?.message ||
                fileResult.error
            );

            continue;
        }


        for (
            const file
            of fileResult?.data ||
            []
        ) {

            if (
                entries.length >=
                limit
            ) {

                break;
            }


            if (
                !file?.name
            ) {

                continue;
            }


            const mimeType =
                String(
                    file?.metadata?.mimetype ||
                    file?.metadata?.contentType ||
                    ""
                );


            const kind =
                getStoredUploadKind(
                    {
                        mimeType,

                        name:
                            file.name
                    }
                );


            if (
                !kind ||
                (
                    kinds &&
                    !kinds.includes(
                        kind
                    )
                )
            ) {

                continue;
            }


            entries.push({

                path:
                    `${folderPath}/${file.name}`,

                name:
                    file.name,

                kind,

                mimeType,

                size:
                    Number(
                        file?.metadata?.size
                    ) ||
                    0,

                createdAt:
                    item.createdAt,

                expiresAt:
                    item.createdAt +
                    maxAgeMs
            });
        }
    }


    /*
     * Signed URL dibuat paralel supaya panel tidak terasa lambat
     * di HP (jumlahnya sudah dibatasi STORED_UPLOAD_LIMIT).
     * Urutan hasil tetap sama karena Promise.all menjaga indeks.
     */
    const signed =
        await Promise.all(
            entries.map(
                async entry => {

                    try {

                        const signedResult =
                            await bucket.createSignedUrl(
                                entry.path,
                                STORAGE_URL_TTL_SECONDS
                            );


                        const url =
                            String(
                                signedResult
                                    ?.data
                                    ?.signedUrl ||
                                ""
                            )
                                .trim();


                        if (
                            url
                        ) {

                            return {
                                ...entry,
                                url
                            };
                        }

                    } catch (
                        signError
                    ) {

                        console.warn(
                            "[GEN-Z.AI][Stored Uploads] Signed URL gagal:",
                            entry.path,
                            signError?.message ||
                            signError
                        );
                    }


                    /*
                     * Berkas kemungkinan sudah dihapus cron. Jangan
                     * tampilkan tombol yang pasti gagal.
                     */
                    return null;
                }
            )
        );


    return signed.filter(
        Boolean
    );
}


/* =========================================================
   PANEL UI
========================================================= */

function createElement(
    tag,
    className = "",
    text = ""
) {

    const element =
        document.createElement(
            tag
        );


    if (
        className
    ) {

        element.className =
            className;
    }


    if (
        text
    ) {

        element.textContent =
            text;
    }


    return element;
}


function createThumb(
    entry
) {

    const thumb =
        createElement(
            "span",
            "generate-stored-upload-thumb"
        );


    if (
        entry.kind === "image"
    ) {

        const image =
            createElement(
                "img"
            );

        image.src =
            entry.url;

        image.alt =
            entry.name;

        image.loading =
            "lazy";

        thumb.appendChild(
            image
        );

        return thumb;
    }


    thumb.appendChild(
        createElement(
            "span",
            "generate-stored-upload-icon",
            entry.kind === "video"
                ? "▶"
                : "♪"
        )
    );


    return thumb;
}


/**
 * Panel daftar unggahan tersimpan.
 *
 * Panel sengaja TERTUTUP di awal: daftar baru dimuat saat user
 * menekan tombol, supaya halaman Generate tidak menembak request
 * storage untuk setiap field media.
 *
 * @param {{
 *   kinds?: string[],
 *   onPick?: (entry: object) => void|Promise<void>,
 *   getContext?: () => Promise<{supabase: object, userId: string}>,
 *   now?: () => number
 * }} options
 */
export function createStoredUploadsPanel(
    options = {}
) {

    const kinds =
        Array.isArray(
            options.kinds
        ) &&
        options.kinds.length > 0
            ? options.kinds
            : null;

    const onPick =
        typeof options.onPick === "function"
            ? options.onPick
            : null;

    const getContext =
        typeof options.getContext === "function"
            ? options.getContext
            : null;

    const nowProvider =
        typeof options.now === "function"
            ? options.now
            : () => Date.now();


    const panel =
        createElement(
            "div",
            "generate-stored-uploads"
        );


    const toggle =
        createElement(
            "button",
            "generate-stored-uploads-toggle"
        );

    toggle.type =
        "button";

    toggle.textContent =
        "Unggahan tersimpan (≤1 jam)";

    toggle.setAttribute(
        "aria-expanded",
        "false"
    );


    const head =
        createElement(
            "div",
            "generate-stored-uploads-head"
        );


    const refreshButton =
        createElement(
            "button",
            "generate-stored-uploads-refresh",
            "Muat ulang"
        );

    refreshButton.type =
        "button";

    refreshButton.hidden =
        true;


    const body =
        createElement(
            "div",
            "generate-stored-uploads-body"
        );

    body.hidden =
        true;

    body.setAttribute(
        "role",
        "list"
    );


    const status =
        createElement(
            "p",
            "generate-stored-uploads-status"
        );

    status.setAttribute(
        "role",
        "status"
    );

    status.setAttribute(
        "aria-live",
        "polite"
    );


    head.append(
        toggle,
        refreshButton
    );

    panel.append(
        head,
        body,
        status
    );


    let loaded =
        false;

    let loading =
        false;


    function setStatus(
        message
    ) {

        status.textContent =
            String(
                message ||
                ""
            );
    }


    function renderEmpty(
        message
    ) {

        body.innerHTML =
            "";

        setStatus(
            message
        );
    }


    function renderEntries(
        entries
    ) {

        body.innerHTML =
            "";


        if (
            !entries.length
        ) {

            setStatus(
                "Belum ada unggahan tersimpan yang masih berlaku. Unggahan hanya disimpan 1 jam."
            );

            return;
        }


        setStatus(
            "Pilih unggahan untuk dipakai tanpa mengunggah ulang."
        );


        const now =
            nowProvider();


        entries.forEach(
            entry => {

                const button =
                    createElement(
                        "button",
                        "generate-stored-upload"
                    );

                button.type =
                    "button";

                button.setAttribute(
                    "role",
                    "listitem"
                );

                button.dataset.storedPath =
                    entry.path;

                button.title =
                    entry.name;


                button.append(
                    createThumb(
                        entry
                    ),

                    createElement(
                        "span",
                        "generate-stored-upload-meta",
                        `${getStoredUploadKindLabel(entry.kind)} · ${formatStoredUploadRemaining(entry.expiresAt, { now })}`
                    )
                );


                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();
                        event.stopPropagation();


                        if (
                            !isStoredUploadFresh(
                                entry,
                                {
                                    now:
                                        nowProvider()
                                }
                            )
                        ) {

                            /*
                             * Muat ulang dulu (supaya tombol yang
                             * mati hilang), baru sampaikan pesan.
                             * Urutannya penting: refresh menulis
                             * statusnya sendiri.
                             */
                            await refresh();

                            setStatus(
                                "File ini sudah dihapus (masa simpan 1 jam). Silakan unggah ulang."
                            );

                            return;
                        }


                        if (
                            !onPick
                        ) {

                            return;
                        }


                        button.disabled =
                            true;

                        setStatus(
                            `Memakai ${entry.name}...`
                        );


                        try {

                            await onPick(
                                entry
                            );

                            const remainingStart =
                                nowProvider();

                            const remainingMs =
                                getStoredUploadRemainingMs(
                                    entry.createdAt,
                                    {
                                        now:
                                            remainingStart
                                    }
                                );


                            /*
                             * File yang hampir dihapus tetap boleh
                             * dipakai, tetapi user diberi tahu:
                             * generation bisa gagal kalau filenya
                             * hilang di tengah proses.
                             */
                            const soonNote =
                                remainingMs > 0 &&
                                remainingMs <
                                    STORED_UPLOAD_SOON_MS

                                    ? " File ini hampir dihapus — selesaikan generation sebelum masa simpannya habis, atau unggah ulang."

                                    : "";


                            setStatus(
                                `✓ Memakai unggahan tersimpan: ${entry.name} (${formatStoredUploadRemaining(entry.expiresAt, { now: remainingStart })}).${soonNote}`
                            );

                        } catch (
                            pickError
                        ) {

                            setStatus(
                                String(
                                    pickError?.message ||
                                    "Gagal memakai unggahan tersimpan."
                                )
                            );

                        } finally {

                            button.disabled =
                                false;
                        }
                    }
                );


                body.appendChild(
                    button
                );
            }
        );
    }


    async function refresh() {

        if (
            loading
        ) {

            return;
        }


        loading =
            true;

        refreshButton.disabled =
            true;

        setStatus(
            "Memuat unggahan tersimpan..."
        );


        try {

            if (
                !getContext
            ) {

                throw new Error(
                    "Konteks penyimpanan belum siap."
                );
            }


            const context =
                await getContext();


            const entries =
                await listStoredUploads({
                    supabase:
                        context?.supabase,

                    userId:
                        context?.userId,

                    kinds,

                    now:
                        nowProvider()
                });


            loaded =
                true;

            renderEntries(
                entries
            );

        } catch (
            loadError
        ) {

            console.warn(
                "[GEN-Z.AI][Stored Uploads] Gagal memuat daftar:",
                loadError?.message ||
                loadError
            );

            renderEmpty(
                "Gagal memuat unggahan tersimpan. Coba tekan Muat ulang."
            );

        } finally {

            loading =
                false;

            refreshButton.disabled =
                false;
        }
    }


    async function expand() {

        body.hidden =
            false;

        refreshButton.hidden =
            false;

        toggle.setAttribute(
            "aria-expanded",
            "true"
        );


        if (
            !loaded
        ) {

            await refresh();
        }
    }


    function collapse() {

        body.hidden =
            true;

        refreshButton.hidden =
            true;

        toggle.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    toggle.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            if (
                body.hidden
            ) {

                expand();

            } else {

                collapse();
            }
        }
    );


    refreshButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            refresh();
        }
    );


    return {

        element:
            panel,

        refresh,

        expand,

        collapse,

        reset() {

            loaded =
                false;

            body.innerHTML =
                "";

            setStatus(
                ""
            );

            collapse();
        }
    };
}


export default Object.freeze({
    STORED_UPLOAD_TTL_MS,
    STORED_UPLOAD_ROOT,
    STORED_UPLOAD_LIMIT,
    STORED_UPLOAD_SOON_MS,
    parseStoredUploadPath,
    getStoredUploadKind,
    getStoredUploadKindLabel,
    getStoredUploadRemainingMs,
    isStoredUploadFresh,
    formatStoredUploadRemaining,
    listStoredUploads,
    createStoredUploadsPanel
});
