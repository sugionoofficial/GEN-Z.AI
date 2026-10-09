/* =========================================================
   GEN-Z.AI
   GENERATE FORM MEDIA
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-media.js

   Tanggung jawab:
   - Image field
   - Audio field
   - Video field
   - URL / Upload mode
   - Preview image
   - Preview audio
   - Preview video
   - Delegasi validation
   - Delegasi upload
   - Menjaga compatibility dengan generate-form.js lama

   Patch UX:
   - Error upload tampil di UI (bukan hanya Console)
   - Indikator state upload (uploading / done / failed)
   - Race condition token untuk multi upload
   - aria-pressed pada tombol mode
   - role="status" aria-live untuk status upload
   - Clear dataset.uploadError saat sukses
========================================================= */

"use strict";


/* =========================================================
   DEBUG FLAG
========================================================= */

function isDebugEnabled() {

    return window.GENZ_DEBUG === true;

}


function debugLog(...args) {

    if (isDebugEnabled()) {

        console.debug(...args);

    }

}


/* =========================================================
   HANDLERS
========================================================= */

let imageUploadHandler = null;
let audioUploadHandler = null;
let videoUploadHandler = null;

let imageValidator = null;
let audioValidator = null;
let videoValidator = null;


/* =========================================================
   UI FEEDBACK HELPERS
   ---------------------------------------------------------
   Semua elemen tambahan pakai class unik:
     - .generate-media-status
     - .generate-media-error

   Class ini TIDAK dipakai oleh CSS lama, jadi aman.
========================================================= */

function setUploadState(
    wrapper,
    state,
    message = ""
) {

    const normalized =
        String(
            state ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        normalized
    ) {

        wrapper.dataset.uploadState =
            normalized;

    } else {

        delete wrapper.dataset.uploadState;

    }


    let statusEl =
        wrapper.querySelector(
            ".generate-media-status"
        );


    if (
        !statusEl
    ) {

        statusEl =
            document.createElement(
                "div"
            );


        statusEl.className =
            "generate-media-status";


        statusEl.setAttribute(
            "role",
            "status"
        );

        statusEl.setAttribute(
            "aria-live",
            "polite"
        );


        statusEl.style.cssText =
            "font-size:12px;margin-top:6px;line-height:1.4;";


        wrapper.appendChild(
            statusEl
        );

    }


    if (
        normalized ===
        "uploading"
    ) {

        statusEl.textContent =
            message ||
            "Mengunggah...";

        statusEl.style.color =
            "#8ab4ff";

    }

    else if (
        normalized ===
        "done"
    ) {

        statusEl.textContent =
            message ||
            "✓ Berhasil diunggah";

        statusEl.style.color =
            "#6fdd8b";

    }

    else if (
        normalized ===
        "failed"
    ) {

        statusEl.textContent =
            message ||
            "✗ Gagal diunggah";

        statusEl.style.color =
            "#ff7a7a";

    }

    else {

        statusEl.textContent =
            "";

    }

}


function showUploadError(
    wrapper,
    message
) {

    let errEl =
        wrapper.querySelector(
            ".generate-media-error"
        );


    if (
        !errEl
    ) {

        errEl =
            document.createElement(
                "div"
            );


        errEl.className =
            "generate-media-error";


        errEl.setAttribute(
            "role",
            "alert"
        );


        errEl.style.cssText =
            "color:#ff7a7a;font-size:13px;margin-top:6px;" +
            "padding:6px 10px;background:rgba(255,60,60,.08);" +
            "border-left:3px solid #ff7a7a;border-radius:4px;";


        wrapper.appendChild(
            errEl
        );

    }


    errEl.textContent =
        String(
            message ||
            "Upload gagal."
        );

}


function clearUploadError(
    wrapper
) {

    const errEl =
        wrapper.querySelector(
            ".generate-media-error"
        );


    if (
        errEl
    ) {

        errEl.remove();

    }


    delete wrapper.dataset.uploadError;

}


/* =========================================================
   REGISTER IMAGE HANDLERS
========================================================= */

export function registerImageMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Image upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Image validator must be a function"
        );

    }


    imageUploadHandler =
        upload;

    imageValidator =
        validate;

}


/* =========================================================
   REGISTER AUDIO HANDLERS
========================================================= */

export function registerAudioMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Audio upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Audio validator must be a function"
        );

    }


    audioUploadHandler =
        upload;

    audioValidator =
        validate;

}


/* =========================================================
   REGISTER VIDEO HANDLERS
========================================================= */

export function registerVideoMediaHandlers({
    upload = null,
    validate = null
} = {}) {

    if (
        upload !== null &&
        typeof upload !== "function"
    ) {

        throw new TypeError(
            "Video upload handler must be a function"
        );

    }


    if (
        validate !== null &&
        typeof validate !== "function"
    ) {

        throw new TypeError(
            "Video validator must be a function"
        );

    }


    videoUploadHandler =
        upload;

    videoValidator =
        validate;

}


/* =========================================================
   VALIDATE IMAGE
========================================================= */

function validateImage(
    file
) {

    if (
        typeof imageValidator ===
        "function"
    ) {

        return imageValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   VALIDATE AUDIO
========================================================= */

function validateAudio(
    file
) {

    if (
        typeof audioValidator ===
        "function"
    ) {

        return audioValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File audio tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   VALIDATE VIDEO
========================================================= */

function validateVideo(
    file
) {

    if (
        typeof videoValidator ===
        "function"
    ) {

        return videoValidator(
            file
        );

    }


    if (
        !file
    ) {

        throw new Error(
            "File video tidak ditemukan."
        );

    }


    return true;

}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadImage(
    file
) {

    validateImage(
        file
    );


    if (
        typeof imageUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Image upload handler is not registered"
        );

    }


    return await imageUploadHandler(
        file
    );

}


/* =========================================================
   UPLOAD AUDIO
========================================================= */

async function uploadAudio(
    file
) {

    validateAudio(
        file
    );


    if (
        typeof audioUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Audio upload handler is not registered"
        );

    }


    return await audioUploadHandler(
        file
    );

}


/* =========================================================
   UPLOAD VIDEO
========================================================= */

async function uploadVideo(
    file
) {

    validateVideo(
        file
    );


    if (
        typeof videoUploadHandler !==
        "function"
    ) {

        throw new Error(
            "Video upload handler is not registered"
        );

    }


    return await videoUploadHandler(
        file
    );

}


/* =========================================================
   EXTRACT UPLOAD URL
   ---------------------------------------------------------
   Uploader bisa mengembalikan string ATAU object.
   Helper ini menangani keduanya.
========================================================= */

function extractUploadUrl(
    result
) {

    if (
        !result
    ) {

        return "";

    }


    if (
        typeof result ===
        "string"
    ) {

        return String(
            result
        ).trim();

    }


    if (
        typeof result ===
        "object"
    ) {

        if (
            typeof result.url ===
            "string"
        ) {

            return String(
                result.url
            ).trim();

        }


        if (
            typeof result.publicUrl ===
            "string"
        ) {

            return String(
                result.publicUrl
            ).trim();

        }


        if (
            typeof result.public_url ===
            "string"
        ) {

            return String(
                result.public_url
            ).trim();

        }


        if (
            typeof result.href ===
            "string"
        ) {

            return String(
                result.href
            ).trim();

        }

    }


    return "";

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function renderImagePreview(
    preview,
    files
) {

    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    const selectedFiles =
        Array.from(
            files || []
        ).filter(
            file =>
                file &&
                file.type &&
                file.type.startsWith(
                    "image/"
                )
        );


    if (
        !selectedFiles.length
    ) {

        preview.style.display =
            "none";

        return;

    }


    preview.style.display =
        "flex";

    preview.style.flexWrap =
        "wrap";

    preview.style.gap =
        "8px";


    selectedFiles.forEach(
        file => {

            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const image =
                        document.createElement(
                            "img"
                        );


                    image.src =
                        String(
                            event.target?.result ||
                            ""
                        );


                    image.alt =
                        "Preview gambar";


                    image.style.width =
                        "160px";

                    image.style.height =
                        "160px";

                    image.style.maxWidth =
                        "160px";

                    image.style.maxHeight =
                        "160px";

                    image.style.objectFit =
                        "cover";

                    image.style.display =
                        "block";

                    image.style.borderRadius =
                        "10px";

                    image.style.border =
                        "1px solid rgba(255,255,255,.12)";


                    preview.appendChild(
                        image
                    );

                };


            reader.onerror =
                () => {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Preview gambar gagal:",
                        file?.name
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   AUDIO PREVIEW
========================================================= */

function createAudioPreview(
    preview
) {

    const audio =
        document.createElement(
            "audio"
        );


    audio.controls =
        true;

    audio.preload =
        "metadata";

    audio.style.width =
        "100%";

    audio.style.maxWidth =
        "500px";


    preview.appendChild(
        audio
    );


    return audio;

}


/* =========================================================
   VIDEO PREVIEW
========================================================= */

function createVideoPreview(
    preview
) {

    const video =
        document.createElement(
            "video"
        );


    video.controls =
        true;

    video.preload =
        "metadata";

    video.muted =
        true;

    video.playsInline =
        true;

    video.style.width =
        "100%";

    video.style.maxWidth =
        "500px";

    video.style.borderRadius =
        "10px";

    video.style.border =
        "1px solid rgba(255,255,255,.12)";


    preview.appendChild(
        video
    );


    return video;

}


/* =========================================================
   IMAGE FIELD
========================================================= */

export function createImageField(
    definition = {},
    parameterName = ""
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-image-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.imageMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-image-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-image-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Gambar";

    uploadButton.className =
        "generate-image-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-image-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-image-url";

    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL gambar";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        if (
            Array.isArray(
                defaultValue
            )
        ) {

            urlInput.value =
                String(
                    defaultValue[0] ||
                    ""
                );

        } else {

            urlInput.value =
                String(
                    defaultValue
                );

        }

    }


    urlContainer.appendChild(
        urlInput
    );


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-image-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.accept =
        definition.accept ||
        "image/jpeg,image/png,image/webp";


    fileInput.multiple =
        definition.multiple === true ||
        Number(
            definition.maxItems ??
            definition.max_items
        ) > 1;


    fileInput.className =
        "generate-image-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-image-preview";


    preview.style.display =
        "none";

    preview.style.flexWrap =
        "wrap";

    preview.style.gap =
        "8px";

    preview.style.marginTop =
        "10px";

    preview.style.maxWidth =
        "360px";


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                renderImagePreview(
                    preview,
                    fileInput.files
                );

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            preview.style.display =
                "none";


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.imageMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;

                wrapper._imageUploadPromise =
                    null;

                setUploadState(
                    wrapper,
                    ""
                );

                renderImagePreview(
                    preview,
                    []
                );

                return;

            }


            try {

                files.forEach(
                    file => {

                        validateImage(
                            file
                        );

                    }
                );


                renderImagePreview(
                    preview,
                    files
                );


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


                const configuredMaxItems =
                    Number(
                        definition?.maxItems ??
                        definition?.max_items
                    );


                const maxItems =
                    Number.isFinite(
                        configuredMaxItems
                    ) &&
                    configuredMaxItems > 0

                        ? Math.floor(
                            configuredMaxItems
                        )

                        : 1;


                const selectedFiles =
                    files.slice(
                        0,
                        maxItems
                    );


                /* =========================================
                   RACE TOKEN
                ========================================= */

                const myToken =
                    ++uploadToken;


                setUploadState(
                    wrapper,
                    "uploading",
                    "Mengunggah gambar..."
                );


                wrapper._imageUploadPromise =
                    (async () => {

                        const uploadedUrls =
                            [];


                        for (
                            const file
                            of selectedFiles
                        ) {

                            const uploaded =
                                await uploadImage(
                                    file
                                );


                            const uploadedUrl =
                                extractUploadUrl(
                                    uploaded
                                );


                            if (
                                uploadedUrl
                            ) {

                                uploadedUrls.push(
                                    uploadedUrl
                                );

                            }

                        }


                        /* =================================
                           STALE CHECK
                        ================================= */

                        if (
                            myToken !==
                            uploadToken
                        ) {

                            debugLog(
                                "[GEN-Z.AI][Generate Form] Upload image stale diabaikan (race condition)."
                            );


                            return uploadedUrls;

                        }


                        if (
                            !uploadedUrls.length
                        ) {

                            throw new Error(
                                "Upload gambar berhasil tetapi URL gambar tidak tersedia."
                            );

                        }


                        wrapper.dataset.uploadedUrl =
                            uploadedUrls[0];


                        wrapper.dataset.uploadedUrls =
                            JSON.stringify(
                                uploadedUrls
                            );


                        debugLog(
                            "[GEN-Z.AI][Generate Form] Image upload ready:",
                            uploadedUrls
                        );


                        return uploadedUrls;

                    })();


                await wrapper._imageUploadPromise;


                if (
                    myToken ===
                    uploadToken
                ) {

                    setUploadState(
                        wrapper,
                        "done",
                        "✓ Gambar berhasil diunggah"
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Image upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                renderImagePreview(
                    preview,
                    []
                );


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload gambar."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah gambar"
                );

            } finally {

                wrapper._imageUploadPromise =
                    null;

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._imageUploadPromise =
        null;

    wrapper._imageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getUploadedUrls =
        () => {

            try {

                const parsed =
                    JSON.parse(
                        wrapper.dataset.uploadedUrls ||
                        "[]"
                    );


                return Array.isArray(
                    parsed
                )
                    ? parsed
                    : [];

            } catch {

                return [];

            }

        };


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            if (
                normalized
            ) {

                wrapper.dataset.uploadedUrl =
                    normalized;

            } else {

                delete wrapper.dataset.uploadedUrl;

            }


            return normalized;

        };


    wrapper.getSelectedFiles =
        () =>
            Array.from(
                fileInput.files || []
            );


    wrapper.getImageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            preview.innerHTML =
                "";

            preview.style.display =
                "none";


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.uploadedUrls;

            delete wrapper.dataset.uploadState;


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._imageUploadPromise =
                null;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   AUDIO FIELD
========================================================= */

export function createAudioField(
    definition = {},
    parameterName = "audio_url"
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-audio-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.audioMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-audio-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-audio-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Audio";

    uploadButton.className =
        "generate-audio-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-audio-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-audio-url";

    urlInput.placeholder =
        "Masukkan URL audio MP3/WAV";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        urlInput.value =
            String(
                Array.isArray(
                    defaultValue
                )
                    ? (
                        defaultValue[0] ||
                        ""
                    )
                    : defaultValue
            );

    }


    urlContainer.appendChild(
        urlInput
    );


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-audio-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";

    fileInput.accept =
        definition.accept ||
        ".mp3,.wav,audio/mpeg,audio/wav";

    fileInput.multiple =
        false;

    fileInput.className =
        "generate-audio-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-audio-preview";


    preview.style.display =
        "none";

    preview.style.marginTop =
        "10px";


    const audio =
        createAudioPreview(
            preview
        );


    function renderPreview(
        file
    ) {

        audio.removeAttribute(
            "src"
        );

        audio.load();


        if (
            !file
        ) {

            preview.style.display =
                "none";

            return;

        }


        const previousUrl =
            audio.dataset.objectUrl;


        if (
            previousUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousUrl
                );

            } catch {
                /* ignore */
            }

        }


        const objectUrl =
            URL.createObjectURL(
                file
            );


        audio.src =
            objectUrl;

        audio.dataset.objectUrl =
            objectUrl;


        preview.style.display =
            "block";

    }


    function clearPreview() {

        const objectUrl =
            audio.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }

        }


        delete audio.dataset.objectUrl;


        audio.removeAttribute(
            "src"
        );

        audio.load();


        preview.style.display =
            "none";

    }


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                renderPreview(
                    fileInput.files[0]
                );

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            clearPreview();


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.audioMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;

                wrapper._audioUploadPromise =
                    null;

                setUploadState(
                    wrapper,
                    ""
                );

                clearPreview();

                return;

            }


            const file =
                files[0];


            try {

                validateAudio(
                    file
                );


                renderPreview(
                    file
                );


                delete wrapper.dataset.uploadedUrl;


                /* =========================================
                   RACE TOKEN
                ========================================= */

                const myToken =
                    ++uploadToken;


                setUploadState(
                    wrapper,
                    "uploading",
                    "Mengunggah audio..."
                );


                wrapper._audioUploadPromise =
                    (async () => {

                        const uploaded =
                            await uploadAudio(
                                file
                            );


                        const uploadedUrl =
                            extractUploadUrl(
                                uploaded
                            );


                        if (
                            myToken !==
                            uploadToken
                        ) {

                            debugLog(
                                "[GEN-Z.AI][Generate Form] Upload audio stale diabaikan (race condition)."
                            );


                            return uploadedUrl;

                        }


                        if (
                            !uploadedUrl
                        ) {

                            throw new Error(
                                "Upload audio berhasil tetapi URL audio tidak tersedia."
                            );

                        }


                        wrapper.dataset.uploadedUrl =
                            uploadedUrl;


                        debugLog(
                            "[GEN-Z.AI][Generate Form] Audio upload ready:",
                            uploadedUrl
                        );


                        return uploadedUrl;

                    })();


                await wrapper._audioUploadPromise;


                if (
                    myToken ===
                    uploadToken
                ) {

                    setUploadState(
                        wrapper,
                        "done",
                        "✓ Audio berhasil diunggah"
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Audio upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                clearPreview();


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload audio."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah audio"
                );

            } finally {

                wrapper._audioUploadPromise =
                    null;

            }

        }
    );


    urlInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._audioUploadPromise =
        null;

    wrapper._audioMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getAudioMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            clearPreview();


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.uploadState;


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._audioUploadPromise =
                null;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   VIDEO FIELD
========================================================= */

export function createVideoField(
    definition = {},
    parameterName = "video_urls"
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-video-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    wrapper.dataset.videoMode =
        "url";


    /* =====================================================
       RACE CONDITION TOKEN
    ===================================================== */

    let uploadToken =
        0;


    /* =====================================================
       MODE SELECTOR
    ===================================================== */

    const modeSelector =
        document.createElement(
            "div"
        );


    modeSelector.className =
        "generate-video-mode-selector";


    modeSelector.style.display =
        "flex";

    modeSelector.style.gap =
        "8px";

    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";

    urlButton.textContent =
        "Gunakan URL";

    urlButton.className =
        "generate-video-mode-button active";

    urlButton.style.cursor =
        "pointer";

    urlButton.setAttribute(
        "aria-pressed",
        "true"
    );


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";

    uploadButton.textContent =
        "Upload Video";

    uploadButton.className =
        "generate-video-mode-button";

    uploadButton.style.cursor =
        "pointer";

    uploadButton.setAttribute(
        "aria-pressed",
        "false"
    );


    modeSelector.appendChild(
        urlButton
    );

    modeSelector.appendChild(
        uploadButton
    );


    /* =====================================================
       URL
    ===================================================== */

    const urlContainer =
        document.createElement(
            "div"
        );


    urlContainer.className =
        "generate-video-url-container";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";

    urlInput.className =
        "generate-video-url";

    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL video MP4/WebM";

    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !== undefined &&
        defaultValue !== null
    ) {

        urlInput.value =
            String(
                Array.isArray(
                    defaultValue
                )
                    ? (
                        defaultValue[0] ||
                        ""
                    )
                    : defaultValue
            );

    }


    urlContainer.appendChild(
        urlInput
    );


    /* =====================================================
       UPLOAD
    ===================================================== */

    const uploadContainer =
        document.createElement(
            "div"
        );


    uploadContainer.className =
        "generate-video-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";

    fileInput.accept =
        definition.accept ||
        "video/mp4,video/webm,.mp4,.webm";

    fileInput.multiple =
        false;

    fileInput.className =
        "generate-video-file";


    uploadContainer.appendChild(
        fileInput
    );


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-video-preview";


    preview.style.display =
        "none";

    preview.style.marginTop =
        "10px";


    const video =
        createVideoPreview(
            preview
        );


    function renderPreview(
        file
    ) {

        video.removeAttribute(
            "src"
        );

        video.load();


        if (
            !file
        ) {

            preview.style.display =
                "none";

            return;

        }


        const previousUrl =
            video.dataset.objectUrl;


        if (
            previousUrl
        ) {

            try {

                URL.revokeObjectURL(
                    previousUrl
                );

            } catch {
                /* ignore */
            }

        }


        const objectUrl =
            URL.createObjectURL(
                file
            );


        video.src =
            objectUrl;

        video.dataset.objectUrl =
            objectUrl;


        preview.style.display =
            "block";

    }


    function clearPreview() {

        const objectUrl =
            video.dataset.objectUrl;


        if (
            objectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }

        }


        delete video.dataset.objectUrl;


        video.removeAttribute(
            "src"
        );

        video.load();


        preview.style.display =
            "none";

    }


    /* =====================================================
       MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";

            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "false"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "true"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                renderPreview(
                    fileInput.files[0]
                );

            }

        } else {

            urlContainer.style.display =
                "block";

            uploadContainer.style.display =
                "none";


            clearPreview();


            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );


            urlButton.setAttribute(
                "aria-pressed",
                "true"
            );

            uploadButton.setAttribute(
                "aria-pressed",
                "false"
            );

        }


        wrapper.dataset.videoMode =
            uploadMode
                ? "upload"
                : "url";

    }


    /* =====================================================
       BUTTON EVENTS
    ===================================================== */

    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            setMode(
                "upload"
            );

        }
    );


    /* =====================================================
       FILE CHANGE
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    fileInput.files || []
                );


            /* =============================================
               CLEAR OLD STATE
            ============================================= */

            clearUploadError(
                wrapper
            );


            /* =============================================
               EMPTY SELECTION
            ============================================= */

            if (
                !files.length
            ) {

                delete wrapper.dataset.uploadedUrl;

                wrapper._videoUploadPromise =
                    null;

                setUploadState(
                    wrapper,
                    ""
                );

                clearPreview();

                return;

            }


            const file =
                files[0];


            try {

                validateVideo(
                    file
                );


                renderPreview(
                    file
                );


                delete wrapper.dataset.uploadedUrl;


                /* =========================================
                   RACE TOKEN
                ========================================= */

                const myToken =
                    ++uploadToken;


                setUploadState(
                    wrapper,
                    "uploading",
                    "Mengunggah video..."
                );


                wrapper._videoUploadPromise =
                    (async () => {

                        const uploaded =
                            await uploadVideo(
                                file
                            );


                        const uploadedUrl =
                            extractUploadUrl(
                                uploaded
                            );


                        if (
                            myToken !==
                            uploadToken
                        ) {

                            debugLog(
                                "[GEN-Z.AI][Generate Form] Upload video stale diabaikan (race condition)."
                            );


                            return uploadedUrl;

                        }


                        if (
                            !uploadedUrl
                        ) {

                            throw new Error(
                                "Upload video berhasil tetapi URL video tidak tersedia."
                            );

                        }


                        wrapper.dataset.uploadedUrl =
                            uploadedUrl;


                        debugLog(
                            "[GEN-Z.AI][Generate Form] Video upload ready:",
                            uploadedUrl
                        );


                        return uploadedUrl;

                    })();


                await wrapper._videoUploadPromise;


                if (
                    myToken ===
                    uploadToken
                ) {

                    setUploadState(
                        wrapper,
                        "done",
                        "✓ Video berhasil diunggah"
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Video upload gagal:",
                    error
                );


                delete wrapper.dataset.uploadedUrl;


                try {

                    fileInput.value =
                        "";

                } catch {
                    /* ignore */
                }


                clearPreview();


                const errorMessage =
                    String(
                        error?.message ||
                        "Gagal mengupload video."
                    );


                wrapper.dataset.uploadError =
                    errorMessage;


                showUploadError(
                    wrapper,
                    errorMessage
                );


                setUploadState(
                    wrapper,
                    "failed",
                    "✗ Gagal mengunggah video"
                );

            } finally {

                wrapper._videoUploadPromise =
                    null;

            }

        }
    );


    urlInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

            }

        }
    );


    /* =====================================================
       HELPERS
    ===================================================== */

    wrapper._videoUploadPromise =
        null;

    wrapper._videoMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";

    wrapper._urlInput =
        urlInput;

    wrapper._fileInput =
        fileInput;

    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.getVideoMode =
        () =>
            wrapper.dataset.videoMode ||
            "url";


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            if (
                normalized
            ) {

                wrapper.dataset.uploadedUrl =
                    normalized;

            } else {

                delete wrapper.dataset.uploadedUrl;

            }


            return normalized;

        };


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";

            urlInput.value =
                "";

            clearPreview();


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.uploadState;


            clearUploadError(
                wrapper
            );

            setUploadState(
                wrapper,
                ""
            );


            wrapper._videoUploadPromise =
                null;


            /* Invalidate stale uploads */
            uploadToken +=
                1;


            setMode(
                "url"
            );

        };


    /* =====================================================
       APPEND
    ===================================================== */

    wrapper.appendChild(
        modeSelector
    );

    wrapper.appendChild(
        urlContainer
    );

    wrapper.appendChild(
        uploadContainer
    );

    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   PUBLIC API
========================================================= */

export default Object.freeze({
    registerImageMediaHandlers,
    registerAudioMediaHandlers,
    registerVideoMediaHandlers,
    createImageField,
    createAudioField,
    createVideoField
});
