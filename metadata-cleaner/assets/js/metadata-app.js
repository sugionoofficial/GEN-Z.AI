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
   - Detect C2PA / Content Credentials
   - Show AI DETECT overlay
   - Clean image metadata locally
   - Clean video metadata locally through FFmpeg WASM
   - Refresh metadata after cleaning
   - Verify cleaned output locally
   - Show cleaned preview
   - Download cleaned copy
   - Original file remains untouched

   IMPORTANT:
   - Cleaning tidak digunakan untuk mengubah pixel
     demi menghindari AI detector.
   - File hasil dibaca ulang setelah cleaning.
   - Metadata UI selalu mengikuti file yang terakhir
     benar-benar dibaca.
   - C2PA / Content Credentials diperiksa langsung
     saat CHECK dan setelah cleaning.

   REFACTOR:
   - CHECK logic berada di metadata-check.js
   - Provenance inspection berada di metadata-check.js
   - Readable error helper berada di metadata-check.js
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


/* =========================================================
   CHECK MODULE
   ---------------------------------------------------------
   CHECK METADATA sekarang ditangani oleh:
   metadata-check.js

   Export:
   - checkMetadata
   - inspectFileProvenance
   - getReadableError

   inspectFileProvenance tetap di-import karena CLEAN
   juga melakukan pemeriksaan provenance setelah cleaning.
========================================================= */

import {
    checkMetadata,
    inspectFileProvenance,
    getReadableError
} from "./metadata-check.js";

/* =========================================================
   PREVIEW MODULE
   ---------------------------------------------------------
   Semua fungsi preview sekarang ditangani oleh:
   metadata-preview.js
========================================================= */

import {
    renderOriginalPreview,
    renderCleanedPreview,
    clearOriginalPreview,
    clearCleanedPreview,
    setPreviewStatus
} from "./metadata-preview.js";


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


import {
    readImageMetadata
} from "./metadata-image.js";


import {
    readVideoMetadata
} from "./metadata-video.js";


import {
    cleanImage
} from "./metadata-cleaner-image.js";


import {
    cleanVideo
} from "./metadata-cleaner-video.js";


/* =========================================================
   CONSTANTS
========================================================= */

const CLEANING_DURATION =
    10000;


const CLEANING_TICK =
    100;


const CLEANING_STAGES = [

    {
        progress: 8,
        title: "INITIALIZING",
        message:
            "Menyiapkan proses pembersihan..."
    },

    {
        progress: 22,
        title: "ANALYZING",
        message:
            "Menganalisis struktur media..."
    },

    {
        progress: 42,
        title: "CLEANING",
        message:
            "Membersihkan metadata..."
    },

    {
        progress: 64,
        title: "REBUILDING",
        message:
            "Membangun file hasil baru..."
    },

    {
        progress: 82,
        title: "VERIFYING",
        message:
            "Memeriksa ulang file hasil..."
    },

    {
        progress: 94,
        title: "FINALIZING",
        message:
            "Menyiapkan file untuk download..."
    },

    {
        progress: 100,
        title: "READY",
        message:
            "File cleaned siap digunakan."
    }

];


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


    injectPremiumCleaningStyles();


    resetApplication();


    console.info(
        "[GEN-Z.AI] AI Metadata Cleaner initialized."
    );
}


/* =========================================================
   COMPATIBILITY EVENT BINDING
========================================================= */

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

    if (
        !elements.fileInput
    ) {

        console.warn(
            "[GEN-Z.AI] File input tidak ditemukan."
        );


        return;
    }


    try {

        elements.fileInput.click();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] File picker gagal dibuka:",
            error
        );
    }
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


/* =========================================================
   DRAG
========================================================= */

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


    state.file =
        file;


    state.fileType =
        detectMediaType(
            file
        );


    /*
     * Pastikan object URL lama sudah benar-benar dilepas
     * sebelum membuat object URL baru.
     */

    revokeObjectURL(
        state.originalURL
    );


    state.originalURL =
        null;


    try {

        state.originalURL =
            URL.createObjectURL(
                file
            );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Object URL creation failed:",
            error
        );


        state.originalURL =
            null;
    }


    updateFileInfo();


    renderOriginalPreview();


    elements.checkButton.disabled =
        false;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


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


    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            state.fileType === "image"
                ? "IMAGE"
                : "VIDEO";
    }


    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            state.file?.name ||
            "";
    }


    if (
        elements.fileSize
    ) {

        elements.fileSize.textContent =
            formatBytes(
                state.file?.size || 0
            );
    }
}


/* =========================================================
   ORIGINAL PREVIEW
========================================================= */

function renderOriginalPreview() {

    const image =
        elements.imagePreview;


    const video =
        elements.videoPreview;


    const empty =
        elements.previewEmpty;


    hidePreviewElement(
        image
    );


    hidePreviewElement(
        video
    );


    hideElement(
        empty
    );


    hideElement(
        elements.aiOverlay
    );


    if (
        elements.previewStage
    ) {

        elements.previewStage.style.display =
            "flex";

        elements.previewStage.style.visibility =
            "visible";

        elements.previewStage.style.opacity =
            "1";
    }


    if (
        !state.file
    ) {

        showElement(
            empty
        );


        setPreviewStatus(
            "BELUM ADA MEDIA"
        );


        return;
    }


    if (
        !state.originalURL
    ) {

        console.error(
            "[GEN-Z.AI] Preview URL tidak tersedia.",
            {
                fileName:
                    state.file.name,

                fileType:
                    state.file.type,

                mediaType:
                    state.fileType
            }
        );


        setPreviewStatus(
            "PREVIEW TIDAK DAPAT DIBUAT."
        );


        return;
    }


    if (
        state.fileType === "image"
    ) {

        renderOriginalImagePreview(
            image,
            state.file,
            state.originalURL
        );


        return;
    }


    if (
        state.fileType === "video"
    ) {

        renderOriginalVideoPreview(
            video,
            state.file,
            state.originalURL
        );


        return;
    }


    console.warn(
        "[GEN-Z.AI] Media type tidak dikenali:",
        state.fileType
    );
}


/* =========================================================
   ORIGINAL IMAGE PREVIEW
========================================================= */

function renderOriginalImagePreview(
    image,
    file,
    url
) {

    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] Image preview element tidak tersedia."
        );


        setPreviewStatus(
            "IMAGE PREVIEW ELEMENT TIDAK TERSEDIA."
        );


        return;
    }


    image.onload =
        null;


    image.onerror =
        null;


    try {

        image.removeAttribute(
            "src"
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Reset image src gagal:",
            error
        );
    }


    forcePreviewVisible(
        image
    );


    image.alt =
        file?.name ||
        "Media preview";


    image.decoding =
        "async";


    image.loading =
        "eager";


    image.onload =
        () => {

            forcePreviewVisible(
                image
            );


            hideElement(
                elements.previewEmpty
            );


            setPreviewStatus(
                "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
            );


            console.info(
                "[GEN-Z.AI] Image preview loaded:",
                {
                    fileName:
                        file?.name || "",

                    width:
                        image.naturalWidth,

                    height:
                        image.naturalHeight,

                    url
                }
            );
        };


    image.onerror =
        (event) => {

            console.error(
                "[GEN-Z.AI] Image preview gagal dimuat:",
                {
                    event,

                    fileName:
                        file?.name || "",

                    fileType:
                        file?.type || "",

                    fileSize:
                        file?.size || 0,

                    url
                }
            );


            renderImageWithFileReader(
                image,
                file
            );
        };


    try {

        image.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Assign image object URL gagal:",
            error
        );


        renderImageWithFileReader(
            image,
            file
        );


        return;
    }


    forcePreviewVisible(
        image
    );


    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        forcePreviewVisible(
            image
        );


        hideElement(
            elements.previewEmpty
        );


        setPreviewStatus(
            "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
        );
    }
}


/* =========================================================
   IMAGE FILEREADER FALLBACK
========================================================= */

function renderImageWithFileReader(
    image,
    file
) {

    if (
        !image ||
        !file
    ) {

        return;
    }


    if (
        typeof FileReader ===
        "undefined"
    ) {

        setPreviewStatus(
            "BROWSER TIDAK MENDUKUNG IMAGE PREVIEW."
        );


        return;
    }


    console.warn(
        "[GEN-Z.AI] Menggunakan FileReader fallback untuk image preview."
    );


    const reader =
        new FileReader();


    reader.onload =
        () => {

            const result =
                reader.result;


            if (
                typeof result !==
                "string"
            ) {

                setPreviewStatus(
                    "IMAGE PREVIEW GAGAL."
                );


                return;
            }


            image.onload =
                () => {

                    forcePreviewVisible(
                        image
                    );


                    hideElement(
                        elements.previewEmpty
                    );


                    setPreviewStatus(
                        "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
                    );
                };


            image.onerror =
                () => {

                    console.error(
                        "[GEN-Z.AI] FileReader image preview juga gagal."
                    );


                    setPreviewStatus(
                        "IMAGE TIDAK DAPAT DITAMPILKAN OLEH BROWSER."
                    );
                };


            image.src =
                result;


            forcePreviewVisible(
                image
            );
        };


    reader.onerror =
        (error) => {

            console.error(
                "[GEN-Z.AI] FileReader image preview gagal:",
                error
            );


            setPreviewStatus(
                "IMAGE PREVIEW GAGAL DIBACA."
            );
        };


    try {

        reader.readAsDataURL(
            file
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] FileReader readAsDataURL gagal:",
            error
        );


        setPreviewStatus(
            "IMAGE PREVIEW GAGAL DIBACA."
        );
    }
}


/* =========================================================
   ORIGINAL VIDEO PREVIEW
========================================================= */

function renderOriginalVideoPreview(
    video,
    file,
    url
) {

    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] Video preview element tidak tersedia."
        );


        setPreviewStatus(
            "VIDEO PREVIEW ELEMENT TIDAK TERSEDIA."
        );


        return;
    }


    try {

        video.pause();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Video pause gagal:",
            error
        );
    }


    video.onloadedmetadata =
        null;


    video.onloadeddata =
        null;


    video.canplay =
        null;


    video.error =
        null;


    video.removeAttribute(
        "src"
    );


    clearVideoSources(
        video
    );


    try {

        video.load();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Video reset load gagal:",
            error
        );
    }


    video.controls =
        true;


    video.playsInline =
        true;


    video.setAttribute(
        "playsinline",
        ""
    );


    video.preload =
        "metadata";


    video.muted =
        false;


    video.autoplay =
        false;


    video.loop =
        false;


    video.disablePictureInPicture =
        false;


    forcePreviewVisible(
        video
    );


    const source =
        document.createElement(
            "source"
        );


    source.src =
        url;


    if (
        file?.type
    ) {

        source.type =
            file.type;
    }


    video.appendChild(
        source
    );


    video.src =
        url;


    video.onloadstart =
        () => {

            forcePreviewVisible(
                video
            );
        };


    video.onloadedmetadata =
        () => {

            if (
                state.file === file
            ) {

                forcePreviewVisible(
                    video
                );


                hideElement(
                    elements.previewEmpty
                );


                setPreviewStatus(
                    "VIDEO SIAP DIPUTAR."
                );


                console.info(
                    "[GEN-Z.AI] Video metadata loaded:",
                    {
                        fileName:
                            file?.name || "",

                        duration:
                            video.duration,

                        width:
                            video.videoWidth,

                        height:
                            video.videoHeight,

                        readyState:
                            video.readyState,

                        currentSrc:
                            video.currentSrc
                    }
                );
            }
        };


    video.onloadeddata =
        () => {

            if (
                state.file === file
            ) {

                forcePreviewVisible(
                    video
                );


                hideElement(
                    elements.previewEmpty
                );


                setPreviewStatus(
                    "VIDEO SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
                );
            }
        };


    video.oncanplay =
        () => {

            if (
                state.file === file
            ) {

                forcePreviewVisible(
                    video
                );
            }
        };


    video.onerror =
        () => {

            const mediaError =
                video.error;


            console.error(
                "[GEN-Z.AI] Video preview gagal dimuat:",
                {
                    code:
                        mediaError?.code ||
                        null,

                    message:
                        mediaError?.message ||
                        null,

                    fileName:
                        file?.name ||
                        null,

                    fileType:
                        file?.type ||
                        null,

                    fileSize:
                        file?.size ||
                        0,

                    url,

                    currentSrc:
                        video.currentSrc ||
                        "",

                    networkState:
                        video.networkState,

                    readyState:
                        video.readyState
                }
            );


            setPreviewStatus(
                "VIDEO TIDAK DAPAT DIPUTAR OLEH BROWSER. FORMAT ATAU CODEC MUNGKIN TIDAK DIDUKUNG."
            );
        };


    forcePreviewVisible(
        video
    );


    try {

        video.load();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Video load() gagal:",
            error
        );


        setPreviewStatus(
            "VIDEO PREVIEW GAGAL DIMUAT."
        );


        return;
    }


    forcePreviewVisible(
        video
    );
}


/* =========================================================
   CLEAN
========================================================= */

async function cleanMetadata() {

    if (
        !state.file ||
        state.cleaning
    ) {

        return;
    }


    const sourceFile =
        state.file;


    state.cleaning =
        true;


    elements.cleanButton.disabled =
        true;


    elements.checkButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    state.cleanedBlob =
        null;


    if (
        state.cleanedURL
    ) {

        revokeObjectURL(
            state.cleanedURL
        );


        state.cleanedURL =
            null;
    }


    hideElement(
        elements.cleanResult
    );


    clearCleanedPreview();


    const loader =
        createPremiumCleaningLoader();


    let cleaningResult =
        null;


    let cleaningError =
        null;


    const cleaningPromise =
        (async () => {

            try {

                updatePremiumCleaningLoader(
                    loader,
                    8,
                    "INITIALIZING",
                    "Menyiapkan proses pembersihan..."
                );


                await yieldToBrowser();


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


                cleaningResult =
                    result;

            } catch (error) {

                cleaningError =
                    error;
            }

        })();


    const minimumLoading =
        runPremiumCleaningTimer(
            loader,
            CLEANING_DURATION
        );


    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    try {

        await Promise.all([

            cleaningPromise,

            minimumLoading

        ]);


        if (
            state.file !== sourceFile
        ) {

            return;
        }


        if (
            cleaningError
        ) {

            throw cleaningError;
        }


        if (
            !cleaningResult ||
            !cleaningResult.blob
        ) {

            throw new Error(
                "File hasil cleaning tidak tersedia."
            );
        }


        updatePremiumCleaningLoader(
            loader,
            82,
            "VERIFYING",
            "Memeriksa file hasil cleaning..."
        );


        state.cleanedBlob =
            cleaningResult.blob;


        const cleanedType =
            cleaningResult.type ||
            cleaningResult.blob.type ||
            sourceFile.type;


        const cleanedName =
            createCleanedFilename(
                sourceFile.name
            );


        const cleanedFile =
            new File(
                [
                    cleaningResult.blob
                ],
                cleanedName,
                {
                    type:
                        cleanedType,

                    lastModified:
                        Date.now()
                }
            );


        state.cleanedFile =
            cleanedFile;


        if (
            state.cleanedURL
        ) {

            revokeObjectURL(
                state.cleanedURL
            );


            state.cleanedURL =
                null;
        }


        state.cleanedURL =
            URL.createObjectURL(
                cleanedFile
            );


        renderCleanedPreview(
            state.cleanedURL,
            cleanedFile
        );


        showElement(
            elements.cleanResult
        );


        updateCleanedFileInfo(
            cleanedFile
        );


        updatePremiumCleaningLoader(
            loader,
            86,
            "READING OUTPUT",
            "Membaca metadata file hasil..."
        );


        const cleanedMetadata =
            cleanedFile.type?.startsWith(
                "image/"
            )

                ? await readImageMetadata(
                    cleanedFile
                )

                : await readVideoMetadata(
                    cleanedFile
                );


        state.metadata =
            normalizeMetadata(
                cleanedMetadata
            );


        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        /*
         * Provenance recheck tetap memakai wrapper
         * dari metadata-check.js.
         */

        await refreshCleanedProvenance(
            cleanedFile
        );


        state.checked =
            true;


        updatePremiumCleaningLoader(
            loader,
            94,
            "FINALIZING",
            "Memperbarui detail metadata..."
        );


        renderMetadata();


        renderDetectionResult();


        elements.downloadButton.disabled =
            false;


        updatePremiumCleaningLoader(
            loader,
            100,
            "READY",
            "File cleaned siap digunakan."
        );


        setPreviewStatus(
            "METADATA CLEANING SELESAI. DETAIL SUDAH DIPERBARUI DARI FILE HASIL."
        );


        setStatus(
            state.aiIndicators.length
                ? "DETECTED"
                : "CLEAR",

            "FILE CLEANED SIAP",

            "Metadata telah dibaca ulang dari file hasil cleaning."
        );


        await wait(
            450
        );


    } catch (error) {

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


        state.cleanedFile =
            null;


        state.provenance =
            null;


        if (
            state.cleanedURL
        ) {

            revokeObjectURL(
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


        setStatus(
            "UNKNOWN",
            "CLEANING GAGAL",
            getReadableError(error)
        );


    } finally {

        removePremiumCleaningLoader(
            loader
        );


        if (
            state.file === sourceFile
        ) {

            state.cleaning =
                false;


            elements.cleanButton.disabled =
                false;


            elements.checkButton.disabled =
                false;
        }
    }
}


/* =========================================================
   REFRESH CLEANED PROVENANCE
========================================================= */

async function refreshCleanedProvenance(
    cleanedFile
) {

    if (
        !cleanedFile
    ) {

        state.provenance =
            null;


        return;
    }


    try {

        const result =
            await inspectFileProvenance(
                cleanedFile
            );


        state.provenance =
            result || null;


    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Cleaned provenance check failed:",
            error
        );


        state.provenance =
            null;
    }
}


/* =========================================================
   UPDATE CLEANED FILE INFO
========================================================= */

function updateCleanedFileInfo(
    file
) {

    if (
        !file
    ) {

        return;
    }


    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            file.type?.startsWith("image/")
                ? "IMAGE"
                : "VIDEO";
    }


    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            file.name;
    }


    if (
        elements.fileSize
    ) {

        elements.fileSize.textContent =
            formatBytes(
                file.size
            );
    }


    elements.fileInfo?.classList.remove(
        "hidden"
    );
}


/* =========================================================
   PREMIUM CLEANING LOADER
========================================================= */

function createPremiumCleaningLoader() {

    const existing =
        document.getElementById(
            "genzMetadataCleaningLoader"
        );


    if (
        existing
    ) {

        existing.remove();
    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "genzMetadataCleaningLoader";


    overlay.className =
        "genz-metadata-cleaning-loader";


    overlay.innerHTML = `

        <div class="genz-clean-loader-panel">

            <div class="genz-clean-loader-orbit">

                <div class="genz-clean-loader-core">
                    <span>AI</span>
                </div>

            </div>


            <div class="genz-clean-loader-brand">
                GEN-Z.AI
            </div>


            <div class="genz-clean-loader-title">
                CLEANING METADATA
            </div>


            <div
                class="genz-clean-loader-stage"
                data-clean-loader-stage
            >
                INITIALIZING
            </div>


            <div
                class="genz-clean-loader-message"
                data-clean-loader-message
            >
                Menyiapkan proses pembersihan...
            </div>


            <div class="genz-clean-loader-progress">

                <div
                    class="genz-clean-loader-progress-bar"
                    data-clean-loader-progress
                ></div>

            </div>


            <div class="genz-clean-loader-footer">

                <span>
                    SECURE LOCAL PROCESS
                </span>

                <strong
                    data-clean-loader-percent
                >
                    0%
                </strong>

            </div>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    requestAnimationFrame(
        () => {

            overlay.classList.add(
                "is-visible"
            );
        }
    );


    return overlay;
}


/* =========================================================
   PREMIUM LOADER TIMER
========================================================= */

async function runPremiumCleaningTimer(
    loader,
    duration
) {

    const start =
        performance.now();


    let timerId =
        null;


    try {

        updatePremiumCleaningLoader(
            loader,
            8,
            "INITIALIZING",
            "Menyiapkan proses pembersihan..."
        );


        timerId =
            setInterval(
                () => {

                    const elapsed =
                        performance.now() -
                        start;


                    const ratio =
                        Math.min(
                            elapsed /
                            duration,
                            1
                        );


                    const progress =
                        Math.min(
                            96,
                            Math.round(
                                ratio *
                                96
                            )
                        );


                    const stage =
                        getCleaningStage(
                            progress
                        );


                    updatePremiumCleaningLoader(
                        loader,
                        progress,
                        stage.title,
                        stage.message
                    );

                },
                CLEANING_TICK
            );


        await wait(
            duration
        );


    } finally {

        if (
            timerId !== null
        ) {

            clearInterval(
                timerId
            );
        }
    }
}


/* =========================================================
   LOADER STAGE
========================================================= */

function getCleaningStage(
    progress
) {

    if (
        progress >= 94
    ) {

        return CLEANING_STAGES[5];
    }


    if (
        progress >= 82
    ) {

        return CLEANING_STAGES[4];
    }


    if (
        progress >= 64
    ) {

        return CLEANING_STAGES[3];
    }


    if (
        progress >= 42
    ) {

        return CLEANING_STAGES[2];
    }


    if (
        progress >= 22
    ) {

        return CLEANING_STAGES[1];
    }


    return CLEANING_STAGES[0];
}


/* =========================================================
   LOADER UPDATE
========================================================= */

function updatePremiumCleaningLoader(
    loader,
    progress,
    stage,
    message
) {

    if (
        !loader
    ) {

        return;
    }


    const safeProgress =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    progress
                ) || 0
            )
        );


    const progressBar =
        loader.querySelector(
            "[data-clean-loader-progress]"
        );


    const percent =
        loader.querySelector(
            "[data-clean-loader-percent]"
        );


    const stageElement =
        loader.querySelector(
            "[data-clean-loader-stage]"
        );


    const messageElement =
        loader.querySelector(
            "[data-clean-loader-message]"
        );


    if (
        progressBar
    ) {

        progressBar.style.width =
            `${safeProgress}%`;
    }


    if (
        percent
    ) {

        percent.textContent =
            `${Math.round(safeProgress)}%`;
    }


    if (
        stageElement
    ) {

        stageElement.textContent =
            String(
                stage ||
                ""
            );
    }


    if (
        messageElement
    ) {

        messageElement.textContent =
            String(
                message ||
                ""
            );
    }
}


/* =========================================================
   REMOVE PREMIUM LOADER
========================================================= */

function removePremiumCleaningLoader(
    loader
) {

    if (
        !loader
    ) {

        return;
    }


    loader.classList.remove(
        "is-visible"
    );


    setTimeout(
        () => {

            loader.remove();

        },
        250
    );
}


/* =========================================================
   PREMIUM LOADER CSS
========================================================= */

function injectPremiumCleaningStyles() {

    if (
        document.getElementById(
            "genzMetadataCleaningStyles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "genzMetadataCleaningStyles";


    style.textContent = `

        .genz-metadata-cleaning-loader {

            position: fixed;

            inset: 0;

            z-index: 2147483000;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 24px;

            background:
                radial-gradient(
                    circle at center,
                    rgba(255, 25, 65, 0.13),
                    rgba(0, 0, 0, 0.88) 42%,
                    rgba(0, 0, 0, 0.97)
                );

            backdrop-filter:
                blur(18px);

            -webkit-backdrop-filter:
                blur(18px);

            opacity: 0;

            visibility: hidden;

            pointer-events: none;

            transition:
                opacity 220ms ease,
                visibility 220ms ease;
        }


        .genz-metadata-cleaning-loader.is-visible {

            opacity: 1;

            visibility: visible;

            pointer-events: auto;
        }


        .genz-clean-loader-panel {

            position: relative;

            width:
                min(460px, 94vw);

            padding:
                34px 32px 30px;

            border:
                1px solid
                rgba(255, 45, 80, 0.55);

            border-radius:
                24px;

            background:
                linear-gradient(
                    145deg,
                    rgba(22, 22, 28, 0.97),
                    rgba(5, 5, 9, 0.98)
                );

            box-shadow:
                0 0 0 1px
                rgba(255, 45, 80, 0.08),

                0 0 32px
                rgba(255, 20, 55, 0.20),

                0 0 90px
                rgba(255, 20, 55, 0.10);

            overflow:
                hidden;

            text-align:
                center;
        }


        .genz-clean-loader-panel::before {

            content:
                "";

            position:
                absolute;

            top:
                0;

            left:
                8%;

            right:
                8%;

            height:
                1px;

            background:
                linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 60, 90, 0.95),
                    transparent
                );

            box-shadow:
                0 0 18px
                rgba(255, 40, 75, 0.65);
        }


        .genz-clean-loader-orbit {

            position:
                relative;

            width:
                86px;

            height:
                86px;

            margin:
                0 auto 20px;

            border:
                1px solid
                rgba(255, 50, 80, 0.32);

            border-radius:
                50%;

            animation:
                genzCleanOrbit 3s
                linear infinite;
        }


        .genz-clean-loader-orbit::before,
        .genz-clean-loader-orbit::after {

            content:
                "";

            position:
                absolute;

            inset:
                8px;

            border:
                1px solid
                rgba(255, 80, 100, 0.20);

            border-radius:
                50%;
        }


        .genz-clean-loader-orbit::after {

            inset:
                -8px;

            border:
                1px dashed
                rgba(255, 40, 70, 0.25);
        }


        .genz-clean-loader-core {

            position:
                absolute;

            inset:
                18px;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            border:
                1px solid
                rgba(255, 70, 95, 0.72);

            border-radius:
                50%;

            background:
                radial-gradient(
                    circle,
                    rgba(255, 40, 75, 0.24),
                    rgba(0, 0, 0, 0.72)
                );

            box-shadow:
                inset 0 0 18px
                rgba(255, 40, 70, 0.16),

                0 0 22px
                rgba(255, 30, 65, 0.22);

            animation:
                genzCleanPulse 1.6s
                ease-in-out infinite;
        }


        .genz-clean-loader-core span {

            color:
                rgba(255, 255, 255, 0.94);

            font:
                800 12px
                Arial,
                sans-serif;

            letter-spacing:
                2px;
        }


        .genz-clean-loader-brand {

            color:
                rgba(255, 65, 90, 0.96);

            font:
                800 11px
                Arial,
                sans-serif;

            letter-spacing:
                4px;

            margin-bottom:
                8px;

            text-shadow:
                0 0 12px
                rgba(255, 40, 70, 0.45);
        }


        .genz-clean-loader-title {

            color:
                rgba(255, 255, 255, 0.96);

            font:
                800 20px
                Arial,
                sans-serif;

            letter-spacing:
                2px;
        }


        .genz-clean-loader-stage {

            margin-top:
                14px;

            color:
                rgba(255, 70, 95, 0.98);

            font:
                800 11px
                Arial,
                sans-serif;

            letter-spacing:
                2.5px;
        }


        .genz-clean-loader-message {

            min-height:
                20px;

            margin-top:
                7px;

            color:
                rgba(255, 255, 255, 0.55);

            font:
                500 12px
                Arial,
                sans-serif;
        }


        .genz-clean-loader-progress {

            position:
                relative;

            width:
                100%;

            height:
                7px;

            margin-top:
                24px;

            overflow:
                hidden;

            border:
                1px solid
                rgba(255, 50, 80, 0.22);

            border-radius:
                999px;

            background:
                rgba(255, 255, 255, 0.055);
        }


        .genz-clean-loader-progress-bar {

            width:
                0%;

            height:
                100%;

            border-radius:
                inherit;

            background:
                linear-gradient(
                    90deg,
                    rgba(255, 25, 60, 0.82),
                    rgba(255, 80, 100, 1)
                );

            box-shadow:
                0 0 14px
                rgba(255, 35, 70, 0.65);

            transition:
                width 120ms linear;
        }


        .genz-clean-loader-footer {

            display:
                flex;

            align-items:
                center;

            justify-content:
                space-between;

            margin-top:
                12px;

            color:
                rgba(255, 255, 255, 0.30);

            font:
                700 9px
                Arial,
                sans-serif;

            letter-spacing:
                1.4px;
        }


        .genz-clean-loader-footer strong {

            color:
                rgba(255, 255, 255, 0.82);

            font-size:
                10px;
        }


        @keyframes genzCleanOrbit {

            from {

                transform:
                    rotate(0deg);
            }

            to {

                transform:
                    rotate(360deg);
            }
        }


        @keyframes genzCleanPulse {

            0%,
            100% {

                transform:
                    scale(0.94);

                box-shadow:
                    inset 0 0 18px
                    rgba(255, 40, 70, 0.12),

                    0 0 16px
                    rgba(255, 30, 65, 0.16);
            }

            50% {

                transform:
                    scale(1.04);

                box-shadow:
                    inset 0 0 22px
                    rgba(255, 40, 70, 0.22),

                    0 0 30px
                    rgba(255, 30, 65, 0.30);
            }
        }


        @media (max-width: 640px) {

            .genz-clean-loader-panel {

                padding:
                    28px 22px 24px;

                border-radius:
                    20px;
            }


            .genz-clean-loader-title {

                font-size:
                    17px;
            }
        }

    `;


    document.head.appendChild(
        style
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
        state.cleanedFile?.name ||
        createCleanedFilename(
            state.file?.name ||
            "media"
        );


    anchor.style.display =
        "none";


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

    const safeName =
        String(
            originalName ||
            "media"
        );


    const dot =
        safeName.lastIndexOf(
            "."
        );


    if (
        dot <= 0
    ) {

        return `${safeName}_cleaned`;
    }


    const base =
        safeName.slice(
            0,
            dot
        );


    const extension =
        safeName.slice(
            dot + 1
        );


    return `${base}_cleaned.${extension}`;
}


/* =========================================================
   RESET FOR NEW FILE
========================================================= */

function resetForNewFile() {

    state.checked =
        false;


    state.metadata =
        [];


    state.aiIndicators =
        [];


    state.provenance =
        null;


    state.cleanedBlob =
        null;


    state.cleanedFile =
        null;


    if (
        state.originalURL
    ) {

        revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    if (
        state.cleanedURL
    ) {

        revokeObjectURL(
            state.cleanedURL
        );


        state.cleanedURL =
            null;
    }


    clearOriginalPreview();


    clearCleanedPreview();


    hideElement(
        elements.cleanResult
    );


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;
    }


    renderMetadata();


    hideElement(
        elements.aiOverlay
    );


    elements.statusIndicator?.classList.remove(
        "is-detected",
        "is-clear",
        "is-unknown"
    );
}


/* =========================================================
   RESET APPLICATION
========================================================= */

function resetApplication() {

    resetForNewFile();


    state.file =
        null;


    state.fileType =
        null;


    state.provenance =
        null;


    if (
        state.originalURL
    ) {

        revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    if (
        elements.fileInput
    ) {

        elements.fileInput.value =
            "";
    }


    elements.fileInfo?.classList.add(
        "hidden"
    );


    clearOriginalPreview();


    clearCleanedPreview();


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
   REVOKE OBJECT URL
========================================================= */

function revokeObjectURL(
    url
) {

    if (
        !url
    ) {

        return;
    }


    if (
        typeof url !==
        "string"
    ) {

        return;
    }


    if (
        !url.startsWith(
            "blob:"
        )
    ) {

        return;
    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] revokeObjectURL gagal:",
            error
        );
    }
}


/* =========================================================
   ASYNC HELPERS
========================================================= */

function wait(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );
}


async function yieldToBrowser() {

    await new Promise(
        resolve => {

            setTimeout(
                resolve,
                0
            );

        }
    );
}


/* =========================================================
   DOM HELPERS
========================================================= */

function showElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.classList.remove(
        "hidden"
    );
}


function hideElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.classList.add(
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


/* =========================================================
   ASPECT RATIO
========================================================= */

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
   PUBLIC APP
========================================================= */

window.GENZMetadataCleaner =
    Object.freeze({

        getState() {

            return {

                file:
                    state.file,

                fileType:
                    state.fileType,

                metadata:
                    [
                        ...(
                            state.metadata || []
                        )
                    ],

                aiIndicators:
                    [
                        ...(
                            state.aiIndicators || []
                        )
                    ],

                provenance:
                    state.provenance ||
                    null,

                checked:
                    state.checked,

                cleaned:
                    Boolean(
                        state.cleanedBlob
                    ),

                cleanedFile:
                    state.cleanedFile ||
                    null
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
