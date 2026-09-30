/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-app.js

   Fungsi:
   - Upload image / video
   - Preview media
   - Read image metadata
   - Read basic video/container metadata
   - Detect AI-related metadata indicators
   - Show AI DETECT overlay
   - Clean image metadata locally
   - Clean video metadata locally through FFmpeg WASM
   - Download cleaned copy
   - Original file remains untouched
========================================================= */

import {
    APP,
    state
} from "./metadata-state.js";

import {
    elements,
    cacheElements
} from "./metadata-dom.js";

import {
    bindMetadataEvents
} from "./metadata-events.js";

import {
    normalizeMetadata,
    appendObjectMetadata
} from "./metadata-normalizer.js";

import {
    detectAIIndicators
} from "./metadata-detector.js";

import {
    renderDetectionResult,
    renderMetadata,
    setStatus
} from "./metadata-status.js";











/* =========================================================
   INIT
========================================================= */

function init() {

    cacheElements();

    bindMetadataEvents({

        handleFileInput,
        openFilePicker,
        checkMetadata,
        cleanMetadata,
        downloadCleanedFile,
        handleDragOver,
        handleDragLeave,
        handleDrop

    });

    resetApplication();

    console.info(
        "[GEN-Z.AI] AI Metadata Cleaner initialized."
    );
}


function bindEvents() {

    elements.fileInput?.addEventListener(
        "change",
        handleFileInput
    );


    elements.changeButton?.addEventListener(
        "click",
        openFilePicker
    );


    elements.checkButton?.addEventListener(
        "click",
        checkMetadata
    );


    elements.cleanButton?.addEventListener(
        "click",
        cleanMetadata
    );


    elements.downloadButton?.addEventListener(
        "click",
        downloadCleanedFile
    );


    elements.dropzone?.addEventListener(
        "dragover",
        handleDragOver
    );


    elements.dropzone?.addEventListener(
        "dragleave",
        handleDragLeave
    );


    elements.dropzone?.addEventListener(
        "drop",
        handleDrop
    );
}


/* =========================================================
   FILE PICKER
========================================================= */

function openFilePicker() {

    elements.fileInput?.click();
}


function handleFileInput(event) {

    const files =
        Array.from(
            event.target?.files || []
        );

    if (!files.length) {

        return;
    }

    processSelectedFile(
        files[0]
    );
}


function handleDragOver(event) {

    event.preventDefault();

    elements.dropzone?.classList.add(
        "is-dragging"
    );
}


function handleDragLeave(event) {

    event.preventDefault();

    elements.dropzone?.classList.remove(
        "is-dragging"
    );
}


function handleDrop(event) {

    event.preventDefault();

    elements.dropzone?.classList.remove(
        "is-dragging"
    );

    const files =
        Array.from(
            event.dataTransfer?.files || []
        );

    if (!files.length) {

        return;
    }

    processSelectedFile(
        files[0]
    );
}


/* =========================================================
   FILE PROCESSING
========================================================= */

function processSelectedFile(file) {

    if (!file) {

        return;
    }


    if (
        !isSupportedMedia(file)
    ) {

        setStatus(
            "UNKNOWN",
            "FORMAT TIDAK DIDUKUNG",
            "Pilih file foto atau video yang dapat diproses oleh browser."
        );

        return;
    }


    resetForNewFile();


    state.file = file;

    state.fileType =
        detectMediaType(file);


    state.originalURL =
        URL.createObjectURL(file);


    updateFileInfo();

    renderOriginalPreview();

    elements.checkButton.disabled = false;

    elements.cleanButton.disabled = true;

    elements.downloadButton.disabled = true;

    setPreviewStatus(
        "MEDIA SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
    );

    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );
}


/* =========================================================
   TYPE DETECTION
========================================================= */

function isSupportedMedia(file) {

    if (!file) {

        return false;
    }


    if (
        file.type &&
        (
            file.type.startsWith("image/") ||
            file.type.startsWith("video/")
        )
    ) {

        return true;
    }


    const extension =
        getExtension(
            file.name
        );


    return [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tif",
        "tiff",
        "avif",
        "mp4",
        "mov",
        "m4v",
        "webm",
        "mkv",
        "avi",
        "mpeg",
        "mpg",
        "3gp",
        "ogv"
    ].includes(
        extension
    );
}


function detectMediaType(file) {

    if (
        file.type?.startsWith(
            "image/"
        )
    ) {

        return "image";
    }


    if (
        file.type?.startsWith(
            "video/"
        )
    ) {

        return "video";
    }


    const extension =
        getExtension(
            file.name
        );


    if (
        [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
            "bmp",
            "tif",
            "tiff",
            "avif"
        ].includes(
            extension
        )
    ) {

        return "image";
    }


    return "video";
}


/* =========================================================
   FILE INFO
========================================================= */

function updateFileInfo() {

    elements.fileInfo?.classList.remove(
        "hidden"
    );


    elements.fileType.textContent =
        state.fileType === "image"
            ? "IMAGE"
            : "VIDEO";


    elements.fileName.textContent =
        state.file.name;


    elements.fileSize.textContent =
        formatBytes(
            state.file.size
        );
}


/* =========================================================
   ORIGINAL PREVIEW
========================================================= */

function renderOriginalPreview() {

    hideElement(
        elements.previewEmpty
    );

    hideElement(
        elements.imagePreview
    );

    hideElement(
        elements.videoPreview
    );

    hideElement(
        elements.aiOverlay
    );


    if (
        state.fileType === "image"
    ) {

        elements.imagePreview.src =
            state.originalURL;

        showElement(
            elements.imagePreview
        );

        return;
    }


    elements.videoPreview.src =
        state.originalURL;

    showElement(
        elements.videoPreview
    );
}


/* =========================================================
   CHECK METADATA
========================================================= */

async function checkMetadata() {

    if (
        !state.file
    ) {

        return;
    }


    if (
        state.checked
    ) {

        return;
    }


    elements.checkButton.disabled = true;


    setStatus(
        "UNKNOWN",
        "MEMBACA METADATA...",
        "Metadata sedang diperiksa secara lokal di browser."
    );


    setPreviewStatus(
        "MEMBACA METADATA..."
    );


    try {

        const metadata =
            state.fileType === "image"
                ? await readImageMetadata(
                    state.file
                )
                : await readVideoMetadata(
                    state.file
                );


        state.metadata =
            normalizeMetadata(
                metadata
            );


        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        state.checked = true;


        renderMetadata();

        renderDetectionResult();


        elements.cleanButton.disabled =
            false;


        setPreviewStatus(
            state.aiIndicators.length
                ? "INDIKATOR AI DITEMUKAN PADA METADATA."
                : "PEMERIKSAAN METADATA SELESAI."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Metadata check failed:",
            error
        );


        state.metadata = [];

        state.aiIndicators = [];

        renderMetadata();


        setStatus(
            "UNKNOWN",
            "METADATA TIDAK DAPAT DIBACA SEPENUHNYA",
            getReadableError(
                error
            )
        );


        setPreviewStatus(
            "PEMERIKSAAN SELESAI DENGAN KETERBATASAN."
        );

    } finally {

        elements.checkButton.disabled =
            false;
    }
}


/* =========================================================
   IMAGE METADATA
========================================================= */

async function readImageMetadata(file) {

    const result = [];


    result.push({
        field: "File Name",
        value: file.name,
        source: "File"
    });


    result.push({
        field: "File Type",
        value: file.type || "Unknown",
        source: "File"
    });


    result.push({
        field: "File Size",
        value: formatBytes(file.size),
        source: "File"
    });


    result.push({
        field: "Last Modified",
        value: new Date(
            file.lastModified
        ).toISOString(),
        source: "File"
    });


    const dimensions =
        await getImageDimensions(
            file
        );


    if (dimensions) {

        result.push({
            field: "Width",
            value: `${dimensions.width} px`,
            source: "Image"
        });


        result.push({
            field: "Height",
            value: `${dimensions.height} px`,
            source: "Image"
        });


        result.push({
            field: "Aspect Ratio",
            value: calculateAspectRatio(
                dimensions.width,
                dimensions.height
            ),
            source: "Image"
        });
    }


    try {

        const exifr =
            await loadExifReader();


        if (exifr) {

            const parsed =
                await exifr.parse(
                    file,
                    {
                        tiff: true,
                        ifd0: true,
                        exif: true,
                        gps: true,
                        xmp: true,
                        icc: true,
                        iptc: true,
                        jfif: true,
                        ihdr: true
                    }
                );


            appendObjectMetadata(
                result,
                parsed,
                "EXIF"
            );
        }

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] EXIF reader unavailable:",
            error
        );


        result.push({
            field: "EXIF Reader",
            value: "Tidak tersedia pada browser/session ini.",
            source: "Reader"
        });
    }


    return result;
}


/* =========================================================
   EXIF LOADER
========================================================= */

let exifReaderPromise = null;


function loadExifReader() {

    if (
        exifReaderPromise
    ) {

        return exifReaderPromise;
    }


    exifReaderPromise =
        import(
            "https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs"
        )
        .then(
            module =>
                module.default || module
        )
        .catch(
            error => {

                exifReaderPromise =
                    null;

                throw error;
            }
        );


    return exifReaderPromise;
}


/* =========================================================
   VIDEO METADATA
   ---------------------------------------------------------
   Urutan pembacaan:

   1. Informasi file
   2. Informasi media dari browser
   3. Container extension
   4. FFprobe sebagai sumber metadata utama
   5. MP4 container scan HANYA jika FFprobe gagal

   Semua proses dilakukan lokal di browser.
   File asli tidak diubah.
========================================================= */

async function readVideoMetadata(
    file
) {

    const result = [];


    /* -----------------------------------------------------
       BASIC FILE INFORMATION
    ----------------------------------------------------- */

    result.push({

        field:
            "File Name",

        value:
            file.name,

        source:
            "File"
    });


    result.push({

        field:
            "File Type",

        value:
            file.type ||
            "Unknown",

        source:
            "File"
    });


    result.push({

        field:
            "File Size",

        value:
            formatBytes(
                file.size
            ),

        source:
            "File"
    });


    result.push({

        field:
            "Last Modified",

        value:
            new Date(
                file.lastModified
            ).toISOString(),

        source:
            "File"
    });


    /* -----------------------------------------------------
       BROWSER MEDIA INFORMATION
    ----------------------------------------------------- */

    const mediaInfo =
        await getVideoElementMetadata(
            file
        );


    if (
        mediaInfo
    ) {

        appendObjectMetadata(
            result,
            mediaInfo,
            "Media"
        );
    }


    /* -----------------------------------------------------
       CONTAINER
    ----------------------------------------------------- */

    const extension =
        getExtension(
            file.name
        );


    result.push({

        field:
            "Container Extension",

        value:
            extension
                ? extension.toUpperCase()
                : "UNKNOWN",

        source:
            "Container"
    });


    /* -----------------------------------------------------
       FFPROBE
       -----------------------------------------------------
       FFprobe menjadi sumber metadata utama untuk video.

       Kita simpan status keberhasilan agar fallback
       MP4 tidak dijalankan jika FFprobe sudah berhasil.
    ----------------------------------------------------- */

    let ffprobeSucceeded =
        false;


    try {

        const ffprobeMetadata =
            await readVideoMetadataWithFFprobe(
                file
            );


        if (
            ffprobeMetadata &&
            typeof ffprobeMetadata === "object"
        ) {

            appendFFprobeMetadata(
                result,
                ffprobeMetadata
            );


            ffprobeSucceeded =
                true;
        }

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] FFprobe metadata unavailable:",
            error
        );
    }


    /* -----------------------------------------------------
       FFPROBE STATUS
       -----------------------------------------------------
       Hanya tambahkan informasi kegagalan jika FFprobe
       benar-benar tidak berhasil.
    ----------------------------------------------------- */

    if (
        !ffprobeSucceeded
    ) {

        result.push({

            field:
                "FFprobe",

            value:
                "Metadata FFprobe tidak tersedia pada sesi ini.",

            source:
                "FFprobe"
        });
    }


    /* -----------------------------------------------------
       FALLBACK MP4 CONTAINER SCAN
       -----------------------------------------------------
       Fallback hanya digunakan jika:

       - FFprobe gagal
       - file kemungkinan MP4/MOV

       Jadi metadata MP4 tidak lagi dibaca dua kali
       ketika FFprobe sudah berhasil.
    ----------------------------------------------------- */

    if (
        !ffprobeSucceeded &&
        isLikelyMp4(
            file
        )
    ) {

        try {

            const mp4Metadata =
                await readMp4ContainerMetadata(
                    file
                );


            if (
                mp4Metadata &&
                typeof mp4Metadata === "object"
            ) {

                appendObjectMetadata(
                    result,
                    mp4Metadata,
                    "MP4 Container"
                );
            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] MP4 container scan failed:",
                error
            );
        }
    }


    return result;
}


/* =========================================================
   FFPROBE VIDEO METADATA
========================================================= */

async function readVideoMetadataWithFFprobe(
    file
) {

    const ffmpeg =
        await ensureFFmpeg();


    const inputName =
        createFFmpegFilename(
            file.name
        );


    const probeName =
        `probe_${Date.now()}.json`;


    const inputData =
        new Uint8Array(
            await file.arrayBuffer()
        );


    try {

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        /*
         * FFprobe dijalankan melalui ffmpeg.wasm.
         *
         * Output JSON HARUS ditulis ke virtual
         * filesystem menggunakan -o agar dapat
         * dibaca kembali dengan ffmpeg.readFile().
         */

        const result =
            await ffmpeg.ffprobe(
                [
                    "-v",
                    "quiet",

                    "-print_format",
                    "json",

                    "-show_format",

                    "-show_streams",

                    "-show_chapters",

                    inputName,

                    "-o",
                    probeName
                ]
            );


        if (
            result !== 0
        ) {

            throw new Error(
                "FFprobe gagal membaca metadata video."
            );
        }


        /*
         * Baca JSON hasil FFprobe dari virtual
         * filesystem.
         *
         * ffmpeg.wasm mendukung encoding utf8,
         * sehingga tidak perlu melakukan decode
         * Uint8Array secara manual.
         */

        const probeData =
            await ffmpeg.readFile(
                probeName,
                "utf8"
            );


        const jsonText =
            typeof probeData === "string"
                ? probeData
                : new TextDecoder().decode(
                    probeData
                );


        if (
            !jsonText ||
            !jsonText.trim()
        ) {

            throw new Error(
                "FFprobe tidak menghasilkan JSON metadata."
            );
        }


        return JSON.parse(
            jsonText
        );

    } finally {

        await safeDeleteFFmpegFile(
            ffmpeg,
            inputName
        );


        await safeDeleteFFmpegFile(
            ffmpeg,
            probeName
        );
    }
}


/* =========================================================
   FFPROBE METADATA APPEND
========================================================= */

function appendFFprobeMetadata(
    target,
    data
) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return;
    }


    /* -----------------------------------------------------
       FORMAT
    ----------------------------------------------------- */

    if (
        data.format &&
        typeof data.format === "object"
    ) {

        appendObjectMetadata(
            target,
            data.format,
            "FFprobe Format"
        );
    }


    /* -----------------------------------------------------
       STREAMS
    ----------------------------------------------------- */

    if (
        Array.isArray(
            data.streams
        )
    ) {

        data.streams.forEach(
            (
                stream,
                index
            ) => {

                const streamType =
                    stream.codec_type ||
                    "unknown";


                const prefix =
                    `Stream ${index} (${streamType})`;


                appendObjectMetadata(
                    target,
                    stream,
                    prefix
                );
            }
        );
    }


    /* -----------------------------------------------------
       CHAPTERS
    ----------------------------------------------------- */

    if (
        Array.isArray(
            data.chapters
        )
    ) {

        data.chapters.forEach(
            (
                chapter,
                index
            ) => {

                appendObjectMetadata(
                    target,
                    chapter,
                    `Chapter ${index}`
                );
            }
        );
    }
}


/* =========================================================
   VIDEO ELEMENT METADATA
========================================================= */

function getVideoElementMetadata(file) {

    return new Promise(
        resolve => {

            const video =
                document.createElement(
                    "video"
                );


            const url =
                URL.createObjectURL(
                    file
                );


            let finished = false;


            const cleanup = () => {

                URL.revokeObjectURL(
                    url
                );

                video.removeAttribute(
                    "src"
                );

                video.load();
            };


            const finish = value => {

                if (finished) {

                    return;
                }


                finished = true;

                cleanup();

                resolve(
                    value
                );
            };


            video.preload =
                "metadata";


            video.muted =
                true;


            video.playsInline =
                true;


            video.addEventListener(
                "loadedmetadata",
                () => {

                    finish({

                        Duration:
                            Number.isFinite(
                                video.duration
                            )
                                ? `${video.duration.toFixed(3)} s`
                                : "Unknown",

                        Width:
                            video.videoWidth
                                ? `${video.videoWidth} px`
                                : "Unknown",

                        Height:
                            video.videoHeight
                                ? `${video.videoHeight} px`
                                : "Unknown",

                        ReadyState:
                            String(
                                video.readyState
                            )

                    });
                },
                {
                    once: true
                }
            );


            video.addEventListener(
                "error",
                () => {

                    finish(null);
                },
                {
                    once: true
                }
            );


            setTimeout(
                () => {

                    finish(null);

                },
                10000
            );


            video.src =
                url;
        }
    );
}


/* =========================================================
   MP4 CONTAINER METADATA
========================================================= */

async function readMp4ContainerMetadata(file) {

    const result = {};

    const maxRead =
        Math.min(
            file.size,
            16 * 1024 * 1024
        );


    const buffer =
        await file
            .slice(
                0,
                maxRead
            )
            .arrayBuffer();


    const view =
        new DataView(
            buffer
        );


    const strings =
        extractAsciiStrings(
            view
        );


    const software =
        findMetadataString(
            strings,
            [
                "software",
                "encoder",
                "handler",
                "writing application",
                "encoded"
            ]
        );


    if (software) {

        result.Software =
            software;
    }


    const creation =
        findMetadataString(
            strings,
            [
                "creation",
                "created"
            ]
        );


    if (creation) {

        result.CreationHint =
            creation;
    }


    const copyright =
        findMetadataString(
            strings,
            [
                "copyright"
            ]
        );


    if (copyright) {

        result.Copyright =
            copyright;
    }


    const location =
        findMetadataString(
            strings,
            [
                "location",
                "latitude",
                "longitude",
                "gps"
            ]
        );


    if (location) {

        result.LocationHint =
            location;
    }


    const encoder =
        findMetadataString(
            strings,
            [
                "lavf",
                "ffmpeg",
                "libav",
                "x264",
                "x265",
                "avc",
                "hevc",
                "vp8",
                "vp9",
                "av01"
            ]
        );


    if (encoder) {

        result.EncoderHint =
            encoder;
    }


    return result;
}


/* =========================================================
   MP4 DETECTION
========================================================= */

function isLikelyMp4(file) {

    const extension =
        getExtension(
            file.name
        );


    return (
        file.type === "video/mp4" ||
        file.type === "video/quicktime" ||
        [
            "mp4",
            "m4v",
            "mov"
        ].includes(
            extension
        )
    );
}


/* =========================================================
   ASCII EXTRACTION
========================================================= */

function extractAsciiStrings(
    dataView
) {

    const output = [];

    let current = "";


    for (
        let index = 0;
        index < dataView.byteLength;
        index++
    ) {

        const value =
            dataView.getUint8(
                index
            );


        const valid =
            (
                value >= 32 &&
                value <= 126
            );


        if (valid) {

            current +=
                String.fromCharCode(
                    value
                );

        } else {

            if (
                current.length >= 4
            ) {

                output.push(
                    current
                );
            }


            current = "";
        }
    }


    if (
        current.length >= 4
    ) {

        output.push(
            current
        );
    }


    return output;
}


/* =========================================================
   STRING SEARCH
========================================================= */

function findMetadataString(
    strings,
    keywords
) {

    for (
        const string of strings
    ) {

        const lower =
            string.toLowerCase();


        for (
            const keyword of keywords
        ) {

            if (
                lower.includes(
                    keyword
                )
            ) {

                return string;
            }
        }
    }


    return "";
}


/* =========================================================
   IMAGE DIMENSIONS
========================================================= */

function getImageDimensions(file) {

    return new Promise(
        resolve => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                const result = {

                    width:
                        image.naturalWidth,

                    height:
                        image.naturalHeight
                };


                URL.revokeObjectURL(
                    url
                );


                resolve(
                    result
                );
            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    url
                );

                resolve(null);
            };


            image.src =
                url;
        }
    );
}

/* =========================================================
   CLEAN
   ---------------------------------------------------------
   Membuat file hasil baru secara lokal.

   File asli tidak pernah dimodifikasi.
========================================================= */

async function cleanMetadata() {

    if (
        !state.file ||
        state.cleaning
    ) {

        return;
    }


    /*
     * Simpan referensi file yang sedang diproses.
     *
     * Ini penting apabila user mengganti file
     * ketika proses cleaning masih berjalan.
     */

    const sourceFile =
        state.file;


    state.cleaning =
        true;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    /*
     * Hapus hasil cleaning sebelumnya sebelum
     * memulai proses baru.
     */

    state.cleanedBlob =
        null;


    if (
        state.cleanedURL
    ) {

        URL.revokeObjectURL(
            state.cleanedURL
        );

        state.cleanedURL =
            null;
    }


    hideElement(
        elements.cleanResult
    );


    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.src =
            "";
    }


    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.pause();

        elements.cleanVideoPreview.removeAttribute(
            "src"
        );

        elements.cleanVideoPreview.load();
    }


    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    try {

        let result;


        if (
            state.fileType === "image"
        ) {

            result =
                await cleanImage(
                    sourceFile
                );

        } else {

            result =
                await cleanVideo(
                    sourceFile
                );
        }


        /*
         * User mungkin sudah memilih file baru
         * ketika proses asynchronous masih berjalan.
         *
         * Jangan pernah menempelkan hasil file lama
         * ke file baru.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        if (
            !result ||
            !result.blob
        ) {

            throw new Error(
                "File hasil cleaning tidak tersedia."
            );
        }


        state.cleanedBlob =
            result.blob;


        /*
         * Pastikan object URL lama benar-benar
         * sudah dilepas sebelum membuat yang baru.
         */

        if (
            state.cleanedURL
        ) {

            URL.revokeObjectURL(
                state.cleanedURL
            );

            state.cleanedURL =
                null;
        }


        state.cleanedURL =
            URL.createObjectURL(
                state.cleanedBlob
            );


        renderCleanedPreview(
            state.cleanedURL
        );


        showElement(
            elements.cleanResult
        );


        elements.downloadButton.disabled =
            false;


        setPreviewStatus(
            "METADATA CLEANING SELESAI. HASIL ADALAH FILE BARU."
        );

    } catch (error) {

        /*
         * Jika user sudah mengganti file,
         * jangan menimpa status file baru
         * dengan error dari proses lama.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        console.error(
            "[GEN-Z.AI] Metadata cleaning failed:",
            error
        );


        state.cleanedBlob =
            null;


        if (
            state.cleanedURL
        ) {

            URL.revokeObjectURL(
                state.cleanedURL
            );

            state.cleanedURL =
                null;
        }


        hideElement(
            elements.cleanResult
        );


        elements.downloadButton.disabled =
            true;


        setPreviewStatus(
            `CLEANING GAGAL: ${getReadableError(error)}`
        );

    } finally {

        /*
         * Hanya ubah state tombol jika proses ini
         * masih merupakan file yang aktif.
         */

        if (
            state.file === sourceFile
        ) {

            state.cleaning =
                false;


            elements.cleanButton.disabled =
                false;
        }
    }
}


/* =========================================================
   CLEAN IMAGE
========================================================= */

async function cleanImage(file) {

    const image =
        await loadImage(
            file
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.naturalWidth;


    canvas.height =
        image.naturalHeight;


    const context =
        canvas.getContext(
            "2d",
            {
                alpha: true
            }
        );


    if (
        !context
    ) {

        throw new Error(
            "Canvas browser tidak tersedia."
        );
    }


    context.drawImage(
        image,
        0,
        0
    );


    const outputType =
        getImageOutputType(
            file
        );


    const blob =
        await canvasToBlob(
            canvas,
            outputType,
            outputType === "image/jpeg"
                ? 0.94
                : undefined
        );


    return {

        blob,

        type:
            outputType
    };
}


/* =========================================================
   IMAGE LOADER
========================================================= */

function loadImage(file) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                URL.revokeObjectURL(
                    url
                );

                resolve(
                    image
                );
            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    url
                );

                reject(
                    new Error(
                        "Gambar tidak dapat dibaca."
                    )
                );
            };


            image.src =
                url;
        }
    );
}


/* =========================================================
   IMAGE OUTPUT TYPE
========================================================= */

function getImageOutputType(
    file
) {

    if (
        file.type === "image/png"
    ) {

        return "image/png";
    }


    if (
        file.type === "image/webp"
    ) {

        return "image/webp";
    }


    return "image/jpeg";
}


/* =========================================================
   CANVAS TO BLOB
========================================================= */

function canvasToBlob(
    canvas,
    type,
    quality
) {

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        reject(
                            new Error(
                                "Browser gagal membuat file hasil."
                            )
                        );

                        return;
                    }


                    resolve(
                        blob
                    );
                },
                type,
                quality
            );
        }
    );
}


/* =========================================================
   CLEAN VIDEO
   ---------------------------------------------------------
   Uses FFmpeg WASM locally.

   Strategy:
   - preserve all media streams
   - remove global/container metadata
   - remove chapters
   - copy streams without video/audio re-encoding
   - use faststart only for MP4/MOV containers
========================================================= */

async function cleanVideo(file) {

    const ffmpeg =
        await ensureFFmpeg();


    const inputName =
        createFFmpegFilename(
            file.name
        );


    const outputName =
        `cleaned_${inputName}`;


    const inputData =
        new Uint8Array(
            await file.arrayBuffer()
        );


    try {

        await ffmpeg.writeFile(
            inputName,
            inputData
        );


        /*
         * Base remux arguments.
         *
         * -map 0
         *     Preserve every input stream.
         *
         * -map_metadata -1
         *     Remove container/global metadata.
         *
         * -map_chapters -1
         *     Remove chapter metadata.
         *
         * -c copy
         *     Do not re-encode video/audio.
         */

        const ffmpegArguments = [

            "-i",
            inputName,

            "-map",
            "0",

            "-map_metadata",
            "-1",

            "-map_chapters",
            "-1",

            "-c",
            "copy"
        ];


        /*
         * +faststart is intended for ISO-BMFF
         * containers such as MP4/MOV.
         *
         * Do not apply it blindly to WebM, MKV,
         * AVI, OGV, etc.
         */

        if (
            isMovLikeVideo(
                file
            )
        ) {

            ffmpegArguments.push(
                "-movflags",
                "+faststart"
            );
        }


        ffmpegArguments.push(
            outputName
        );


        const result =
            await ffmpeg.exec(
                ffmpegArguments
            );


        if (
            result !== 0
        ) {

            throw new Error(
                "FFmpeg gagal melakukan remux video."
            );
        }


        const outputData =
            await ffmpeg.readFile(
                outputName
            );


        if (
            !outputData ||
            !outputData.length
        ) {

            throw new Error(
                "FFmpeg tidak menghasilkan file video."
            );
        }


        const outputType =
            getCleanVideoMimeType(
                file
            );


        return {

            blob:
                new Blob(
                    [
                        outputData
                    ],
                    {
                        type:
                            outputType
                    }
                ),

            type:
                outputType
        };

    } finally {

        await safeDeleteFFmpegFile(
            ffmpeg,
            inputName
        );


        await safeDeleteFFmpegFile(
            ffmpeg,
            outputName
        );
    }
}


/* =========================================================
   FFMPEG LOADER
========================================================= */

async function ensureFFmpeg() {

    if (
        state.ffmpegLoaded &&
        state.ffmpeg
    ) {

        return state.ffmpeg;
    }


    if (
        state.ffmpegLoading
    ) {

        return waitForFFmpeg();
    }


    state.ffmpegLoading =
        true;


    try {

        await loadFFmpegScripts();


        if (
            typeof window.FFmpeg ===
            "undefined"
        ) {

            throw new Error(
                "FFmpeg browser library tidak tersedia."
            );
        }


        const FFmpegClass =
            window.FFmpeg.FFmpeg;


        if (
            typeof FFmpegClass !==
            "function"
        ) {

            throw new Error(
                "FFmpeg constructor tidak tersedia."
            );
        }


        const ffmpeg =
            new FFmpegClass();


        ffmpeg.on(
            "log",
            ({
                message
            }) => {

                console.debug(
                    "[FFmpeg]",
                    message
                );
            }
        );


        const coreURL =
            `${APP.FFMPEG_BASE_URL}/ffmpeg-core.js`;


        const wasmURL =
            `${APP.FFMPEG_BASE_URL}/ffmpeg-core.wasm`;


        await ffmpeg.load({

            coreURL:
                await toBlobURL(
                    coreURL,
                    "text/javascript"
                ),

            wasmURL:
                await toBlobURL(
                    wasmURL,
                    "application/wasm"
                )
        });


        state.ffmpeg =
            ffmpeg;


        state.ffmpegLoaded =
            true;


        return ffmpeg;

    } finally {

        state.ffmpegLoading =
            false;
    }
}


/* =========================================================
   FFMPEG SCRIPT LOADER
========================================================= */

function loadFFmpegScripts() {

    if (
        state.ffmpegScriptsLoaded
    ) {

        return Promise.resolve();
    }


    return new Promise(
        (resolve, reject) => {

            const existing =
                document.querySelector(
                    'script[data-genz-ffmpeg="true"]'
                );


            if (existing) {

                if (
                    typeof window.FFmpeg !==
                    "undefined"
                ) {

                    state.ffmpegScriptsLoaded =
                        true;

                    resolve();

                    return;
                }
            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                APP.FFMPEG_PACKAGE_URL;


            script.async =
                false;


            script.dataset.genzFfmpeg =
                "true";


            script.onload = () => {

                if (
                    typeof window.FFmpeg ===
                    "undefined"
                ) {

                    reject(
                        new Error(
                            "FFmpeg script berhasil dimuat tetapi global FFmpeg tidak ditemukan."
                        )
                    );

                    return;
                }


                state.ffmpegScriptsLoaded =
                    true;

                resolve();
            };


            script.onerror = () => {

                reject(
                    new Error(
                        "FFmpeg browser library gagal dimuat."
                    )
                );
            };


            document.head.appendChild(
                script
            );
        }
    );
}


/* =========================================================
   BLOB URL HELPER
========================================================= */

async function toBlobURL(
    url,
    mimeType
) {

    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Gagal mengambil FFmpeg resource: ${response.status}`
        );
    }


    const blob =
        await response.blob();


    return URL.createObjectURL(
        new Blob(
            [
                blob
            ],
            {
                type:
                    mimeType
            }
        )
    );
}


/* =========================================================
   FFMPEG WAIT
========================================================= */

function waitForFFmpeg() {

    return new Promise(
        (resolve, reject) => {

            const start =
                Date.now();


            const timer =
                setInterval(
                    () => {

                        if (
                            state.ffmpegLoaded &&
                            state.ffmpeg
                        ) {

                            clearInterval(
                                timer
                            );

                            resolve(
                                state.ffmpeg
                            );

                            return;
                        }


                        if (
                            Date.now() -
                            start >
                            120000
                        ) {

                            clearInterval(
                                timer
                            );

                            reject(
                                new Error(
                                    "FFmpeg membutuhkan waktu terlalu lama untuk dimuat."
                                )
                            );
                        }

                    },
                    100
                );
        }
    );
}


/* =========================================================
   FFMPEG FILE NAME
========================================================= */

function createFFmpegFilename(
    originalName
) {

    const extension =
        getExtension(
            originalName
        );


    const safeExtension =
        extension ||
        "mp4";


    return `input.${safeExtension}`;
}


/* =========================================================
   VIDEO MIME
========================================================= */

function getCleanVideoMimeType(
    file
) {

    const extension =
        getExtension(
            file.name
        ).toLowerCase();


    if (
        extension === "webm" ||
        file.type === "video/webm"
    ) {

        return "video/webm";
    }


    if (
        extension === "mov" ||
        file.type === "video/quicktime"
    ) {

        return "video/quicktime";
    }


    if (
        extension === "mkv" ||
        file.type === "video/x-matroska"
    ) {

        return "video/x-matroska";
    }


    if (
        extension === "avi" ||
        file.type === "video/x-msvideo"
    ) {

        return "video/x-msvideo";
    }


    if (
        extension === "ogv" ||
        file.type === "video/ogg"
    ) {

        return "video/ogg";
    }


    if (
        extension === "mpeg" ||
        extension === "mpg"
    ) {

        return "video/mpeg";
    }


    return "video/mp4";
}


/* =========================================================
   MOV / MP4 CONTAINER CHECK
========================================================= */

function isMovLikeVideo(
    file
) {

    const extension =
        getExtension(
            file.name
        ).toLowerCase();


    return (
        extension === "mp4" ||
        extension === "m4v" ||
        extension === "mov" ||
        file.type === "video/mp4" ||
        file.type === "video/quicktime"
    );
}


/* =========================================================
   FFMPEG DELETE
========================================================= */

async function safeDeleteFFmpegFile(
    ffmpeg,
    filename
) {

    try {

        await ffmpeg.deleteFile(
            filename
        );

    } catch {
        /* Ignore cleanup errors. */
    }
}


/* =========================================================
   CLEANED PREVIEW
========================================================= */

function renderCleanedPreview(
    url
) {

    hideElement(
        elements.cleanImagePreview
    );


    hideElement(
        elements.cleanVideoPreview
    );


    if (
        state.fileType === "image"
    ) {

        elements.cleanImagePreview.src =
            url;

        showElement(
            elements.cleanImagePreview
        );

        return;
    }


    elements.cleanVideoPreview.src =
        url;

    showElement(
        elements.cleanVideoPreview
    );
}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadCleanedFile() {

    if (
        !state.cleanedBlob ||
        !state.cleanedURL
    ) {

        return;
    }


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        state.cleanedURL;


    anchor.download =
        createCleanedFilename(
            state.file.name
        );


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();
}


/* =========================================================
   CLEANED FILENAME
========================================================= */

function createCleanedFilename(
    originalName
) {

    const dot =
        originalName.lastIndexOf(
            "."
        );


    if (
        dot <= 0
    ) {

        return `${originalName}_cleaned`;
    }


    const base =
        originalName.slice(
            0,
            dot
        );


    const extension =
        originalName.slice(
            dot + 1
        );


    return `${base}_cleaned.${extension}`;
}


/* =========================================================
   RESET FOR NEW FILE
   ---------------------------------------------------------
   Membersihkan seluruh state hasil file sebelumnya.

   - revoke original object URL
   - revoke cleaned object URL
   - hapus hasil cleaning
   - hapus metadata
   - hapus AI DETECT
   - nonaktifkan DOWNLOAD
   - reset status pemeriksaan
========================================================= */

function resetForNewFile() {

    state.checked =
        false;


    state.metadata =
        [];


    state.aiIndicators =
        [];


    state.cleanedBlob =
        null;


    /*
     * File sebelumnya tidak boleh meninggalkan
     * object URL di memory.
     */

    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );

        state.originalURL =
            null;
    }


    /*
     * Hasil cleaning sebelumnya juga harus
     * dilepas sebelum file baru diproses.
     */

    if (
        state.cleanedURL
    ) {

        URL.revokeObjectURL(
            state.cleanedURL
        );

        state.cleanedURL =
            null;
    }


    /*
     * Hentikan referensi preview hasil lama.
     */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.src =
            "";
    }


    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.pause();

        elements.cleanVideoPreview.removeAttribute(
            "src"
        );

        elements.cleanVideoPreview.load();
    }


    /*
     * Sembunyikan hasil cleaning lama.
     */

    hideElement(
        elements.cleanResult
    );


    /*
     * DOWNLOAD hanya boleh aktif jika
     * cleanedBlob + cleanedURL benar-benar ada.
     */

    elements.downloadButton.disabled =
        true;


    /*
     * Bersihkan tabel metadata.
     */

    renderMetadata();


    /*
     * Hilangkan AI DETECT dari file sebelumnya.
     */

    hideElement(
        elements.aiOverlay
    );


    /*
     * Reset indikator status.
     */

    elements.statusIndicator.classList.remove(
        "is-detected",
        "is-clear",
        "is-unknown"
    );
}


function resetApplication() {

    resetForNewFile();


    state.file =
        null;


    state.fileType =
        null;


    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );

        state.originalURL =
            null;
    }


    elements.fileInput.value =
        "";


    elements.fileInfo?.classList.add(
        "hidden"
    );


    hideElement(
        elements.imagePreview
    );


    hideElement(
        elements.videoPreview
    );


    showElement(
        elements.previewEmpty
    );


    elements.checkButton.disabled =
        true;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );


    setPreviewStatus(
        "BELUM ADA MEDIA"
    );
}


/* =========================================================
   PREVIEW STATUS
========================================================= */

function setPreviewStatus(
    text
) {

    if (
        elements.previewStatus
    ) {

        elements.previewStatus.textContent =
            text;
    }
}


/* =========================================================
   DOM HELPERS
========================================================= */

function showElement(
    element
) {

    element?.classList.remove(
        "hidden"
    );
}


function hideElement(
    element
) {

    element?.classList.add(
        "hidden"
    );
}


/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {

        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    const safeIndex =
        Math.min(
            index,
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            safeIndex
        );


    return `${value.toFixed(
        safeIndex === 0
            ? 0
            : 2
    )} ${units[safeIndex]}`;
}


function getExtension(
    filename
) {

    const clean =
        String(
            filename || ""
        )
        .split("?")[0]
        .split("#")[0];


    const dot =
        clean.lastIndexOf(
            "."
        );


    if (
        dot < 0
    ) {

        return "";
    }


    return clean
        .slice(
            dot + 1
        )
        .toLowerCase();
}


function calculateAspectRatio(
    width,
    height
) {

    if (
        !width ||
        !height
    ) {

        return "Unknown";
    }


    const divisor =
        greatestCommonDivisor(
            width,
            height
        );


    return `${width / divisor}:${height / divisor}`;
}


function greatestCommonDivisor(
    a,
    b
) {

    a =
        Math.abs(
            Math.round(a)
        );


    b =
        Math.abs(
            Math.round(b)
        );


    while (
        b !== 0
    ) {

        const temp =
            b;

        b =
            a % b;

        a =
            temp;
    }


    return a || 1;
}


/* =========================================================
   ERROR
========================================================= */

function getReadableError(
    error
) {

    if (
        !error
    ) {

        return "Terjadi kesalahan yang tidak diketahui.";
    }


    if (
        error instanceof Error
    ) {

        return error.message;
    }


    return String(
        error
    );
}


/* =========================================================
   PUBLIC APP
========================================================= */

window.GENZMetadataCleaner = Object.freeze({

    getState() {

        return {

            file:
                state.file,

            fileType:
                state.fileType,

            metadata:
                [...state.metadata],

            aiIndicators:
                [...state.aiIndicators],

            checked:
                state.checked,

            cleaned:
                Boolean(
                    state.cleanedBlob
                )
        };
    },

    reset() {

        resetApplication();
    }

});


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();
}
