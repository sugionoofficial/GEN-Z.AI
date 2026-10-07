/* =========================================================
   GEN-Z.AI
   GENERATE FORM MEDIA
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-media.js

   Tanggung jawab:
   - Image field
   - Audio field
   - URL / Upload mode
   - Preview image
   - Preview audio
   - File validation
   - Delegasi upload ke uploader
   - Tidak menangani state model
   - Tidak menangani submit
   - Tidak menangani credit
========================================================= */

"use strict";


/* =========================================================
   FACTORY DEPENDENCIES
========================================================= */

let imageUploadHandler = null;
let audioUploadHandler = null;
let imageValidator = null;
let audioValidator = null;


/* =========================================================
   REGISTER IMAGE DEPENDENCIES
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
   REGISTER AUDIO DEPENDENCIES
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
   INTERNAL IMAGE VALIDATION
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
   INTERNAL AUDIO VALIDATION
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
   IMAGE UPLOAD
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


    const result =
        await imageUploadHandler(
            file
        );


    return result;

}


/* =========================================================
   AUDIO UPLOAD
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


    const result =
        await audioUploadHandler(
            file
        );


    return result;

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
        );


    if (
        !selectedFiles.length
    ) {

        preview.style.display =
            "none";

        return;

    }


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


                    image.loading =
                        "lazy";


                    preview.appendChild(
                        image
                    );


                    preview.style.display =
                        "grid";

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

function renderAudioPreview(
    preview,
    file
) {

    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    if (
        !file
    ) {

        preview.style.display =
            "none";

        return;

    }


    const audio =
        document.createElement(
            "audio"
        );


    audio.controls =
        true;


    audio.preload =
        "metadata";


    const objectUrl =
        URL.createObjectURL(
            file
        );


    audio.src =
        objectUrl;


    audio.addEventListener(
        "ended",
        () => {

            try {

                URL.revokeObjectURL(
                    objectUrl
                );

            } catch {
                /* ignore */
            }

        },
        {
            once:
                true
        }
    );


    preview.appendChild(
        audio
    );


    preview.style.display =
        "block";

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


    wrapper.dataset.parameter =
        parameterName;


    wrapper.dataset.imageMode =
        "url";


    /* =====================================================
       MODE BUTTONS
    ===================================================== */

    const modeWrapper =
        document.createElement(
            "div"
        );


    modeWrapper.className =
        "generate-media-mode";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";


    urlButton.className =
        "generate-media-mode-button active";


    urlButton.textContent =
        "URL";


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";


    uploadButton.className =
        "generate-media-mode-button";


    uploadButton.textContent =
        "Upload";


    modeWrapper.appendChild(
        urlButton
    );


    modeWrapper.appendChild(
        uploadButton
    );


    wrapper.appendChild(
        modeWrapper
    );


    /* =====================================================
       URL INPUT
    ===================================================== */

    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";


    urlInput.className =
        "form-input generate-image-url";


    urlInput.dataset.parameter =
        parameterName;


    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL gambar";


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !==
        undefined &&
        defaultValue !==
        null
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


    wrapper.appendChild(
        urlInput
    );


    /* =====================================================
       FILE INPUT
    ===================================================== */

    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.className =
        "generate-image-file";


    fileInput.accept =
        definition.accept ||
        "image/jpeg,image/png,image/webp";


    const multiple =
        definition.multiple === true ||
        Number(
            definition.maxItems ??
            definition.max_items
        ) > 1;


    fileInput.multiple =
        multiple;


    fileInput.style.display =
        "none";


    wrapper.appendChild(
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


    wrapper.appendChild(
        preview
    );


    /* =====================================================
       UPLOAD STATE
    ===================================================== */

    wrapper._imageUploadPromise =
        null;


    wrapper._imageMode =
        "url";


    wrapper._urlInput =
        urlInput;


    wrapper._fileInput =
        fileInput;


    wrapper._preview =
        preview;


    /* =====================================================
       SET MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const nextMode =
            mode === "upload"
                ? "upload"
                : "url";


        wrapper._imageMode =
            nextMode;


        wrapper.dataset.imageMode =
            nextMode;


        const uploadMode =
            nextMode ===
            "upload";


        urlInput.style.display =
            uploadMode
                ? "none"
                : "";


        fileInput.style.display =
            uploadMode
                ? ""
                : "none";


        urlButton.classList.toggle(
            "active",
            !uploadMode
        );


        uploadButton.classList.toggle(
            "active",
            uploadMode
        );

    }


    urlButton.addEventListener(
        "click",
        () => {

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        () => {

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
        () => {

            const files =
                Array.from(
                    fileInput.files ||
                    []
                );


            if (
                !files.length
            ) {

                wrapper._imageUploadPromise =
                    null;


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


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

            } catch (
                error
            ) {

                fileInput.value =
                    "";


                wrapper._imageUploadPromise =
                    null;


                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;


                renderImagePreview(
                    preview,
                    []
                );


                console.error(
                    "[GEN-Z.AI][Generate Form] File gambar ditolak:",
                    error
                );


                return;

            }


            renderImagePreview(
                preview,
                files
            );


            wrapper._imageUploadPromise =
                Promise.all(
                    files.map(
                        file =>
                            uploadImage(
                                file
                            )
                    )
                )
                    .then(
                        results => {

                            const urls =
                                results
                                    .map(
                                        result =>
                                            String(
                                                result?.url ||
                                                ""
                                            ).trim()
                                    )
                                    .filter(
                                        Boolean
                                    );


                            if (
                                urls.length
                            ) {

                                wrapper.dataset.uploadedUrl =
                                    urls[0];


                                wrapper.dataset.uploadedUrls =
                                    JSON.stringify(
                                        urls
                                    );

                            }


                            return urls;

                        }
                    )
                    .catch(
                        error => {

                            delete wrapper.dataset.uploadedUrl;
                            delete wrapper.dataset.uploadedUrls;

                            throw error;

                        }
                    );

        }
    );


    /* =====================================================
       PUBLIC METHODS
    ===================================================== */

    wrapper.getInputMode =
        () =>
            wrapper._imageMode;


    wrapper.getUrlInput =
        () =>
            wrapper._urlInput;


    wrapper.getFileInput =
        () =>
            wrapper._fileInput;


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
                        .map(
                            value =>
                                String(
                                    value ||
                                    ""
                                ).trim()
                        )
                        .filter(
                            Boolean
                        )
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


                wrapper.dataset.uploadedUrls =
                    JSON.stringify([
                        normalized
                    ]);

            } else {

                delete wrapper.dataset.uploadedUrl;
                delete wrapper.dataset.uploadedUrls;

            }

        };


    wrapper.getSelectedFiles =
        () =>
            Array.from(
                wrapper._fileInput?.files ||
                []
            );


    wrapper.getImageMode =
        () =>
            wrapper._imageMode;


    wrapper.clearUploadedFile =
        async () => {

            wrapper._imageUploadPromise =
                null;


            delete wrapper.dataset.uploadedUrl;
            delete wrapper.dataset.uploadedUrls;


            try {

                wrapper._fileInput.value =
                    "";

            } catch {
                /* ignore */
            }


            wrapper._preview.innerHTML =
                "";


            wrapper._preview.style.display =
                "none";


            setMode(
                "url"
            );

        };


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


    wrapper.dataset.parameter =
        parameterName;


    wrapper.dataset.audioMode =
        "url";


    /* =====================================================
       MODE BUTTONS
    ===================================================== */

    const modeWrapper =
        document.createElement(
            "div"
        );


    modeWrapper.className =
        "generate-media-mode";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";


    urlButton.className =
        "generate-media-mode-button active";


    urlButton.textContent =
        "URL";


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";


    uploadButton.className =
        "generate-media-mode-button";


    uploadButton.textContent =
        "Upload";


    modeWrapper.appendChild(
        urlButton
    );


    modeWrapper.appendChild(
        uploadButton
    );


    wrapper.appendChild(
        modeWrapper
    );


    /* =====================================================
       URL INPUT
    ===================================================== */

    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";


    urlInput.className =
        "form-input generate-audio-url";


    urlInput.dataset.parameter =
        parameterName;


    urlInput.placeholder =
        definition.placeholder ||
        "Masukkan URL audio";


    const defaultValue =
        definition.default ??
        definition.default_value ??
        definition.value;


    if (
        defaultValue !==
        undefined &&
        defaultValue !==
        null
    ) {

        urlInput.value =
            String(
                defaultValue
            );

    }


    wrapper.appendChild(
        urlInput
    );


    /* =====================================================
       FILE INPUT
    ===================================================== */

    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.className =
        "generate-audio-file";


    fileInput.accept =
        definition.accept ||
        ".mp3,.wav,audio/mpeg,audio/wav";


    fileInput.multiple =
        false;


    fileInput.style.display =
        "none";


    wrapper.appendChild(
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


    wrapper.appendChild(
        preview
    );


    /* =====================================================
       UPLOAD STATE
    ===================================================== */

    wrapper._audioUploadPromise =
        null;


    wrapper._audioMode =
        "url";


    wrapper._urlInput =
        urlInput;


    wrapper._fileInput =
        fileInput;


    wrapper._preview =
        preview;


    /* =====================================================
       SET MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        const nextMode =
            mode === "upload"
                ? "upload"
                : "url";


        wrapper._audioMode =
            nextMode;


        wrapper.dataset.audioMode =
            nextMode;


        const uploadMode =
            nextMode ===
            "upload";


        urlInput.style.display =
            uploadMode
                ? "none"
                : "";


        fileInput.style.display =
            uploadMode
                ? ""
                : "none";


        urlButton.classList.toggle(
            "active",
            !uploadMode
        );


        uploadButton.classList.toggle(
            "active",
            uploadMode
        );

    }


    urlButton.addEventListener(
        "click",
        () => {

            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        () => {

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
        () => {

            const file =
                fileInput.files?.[0] ||
                null;


            if (
                !file
            ) {

                wrapper._audioUploadPromise =
                    null;


                delete wrapper.dataset.uploadedUrl;


                renderAudioPreview(
                    preview,
                    null
                );


                return;

            }


            try {

                validateAudio(
                    file
                );

            } catch (
                error
            ) {

                fileInput.value =
                    "";


                wrapper._audioUploadPromise =
                    null;


                delete wrapper.dataset.uploadedUrl;


                renderAudioPreview(
                    preview,
                    null
                );


                console.error(
                    "[GEN-Z.AI][Generate Form] File audio ditolak:",
                    error
                );


                return;

            }


            renderAudioPreview(
                preview,
                file
            );


            wrapper._audioUploadPromise =
                uploadAudio(
                    file
                )
                    .then(
                        result => {

                            const url =
                                String(
                                    result?.url ||
                                    ""
                                ).trim();


                            if (
                                url
                            ) {

                                wrapper.dataset.uploadedUrl =
                                    url;

                            }


                            return url;

                        }
                    )
                    .catch(
                        error => {

                            delete wrapper.dataset.uploadedUrl;

                            throw error;

                        }
                    );

        }
    );


    /* =====================================================
       PUBLIC METHODS
    ===================================================== */

    wrapper.getInputMode =
        () =>
            wrapper._audioMode;


    wrapper.getUrlInput =
        () =>
            wrapper._urlInput;


    wrapper.getFileInput =
        () =>
            wrapper._fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


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

        };


    wrapper.getSelectedFile =
        () =>
            wrapper._fileInput?.files?.[0] ||
            null;


    wrapper.getAudioMode =
        () =>
            wrapper._audioMode;


    wrapper.clearUploadedFile =
        async () => {

            wrapper._audioUploadPromise =
                null;


            delete wrapper.dataset.uploadedUrl;


            try {

                wrapper._fileInput.value =
                    "";

            } catch {
                /* ignore */
            }


            wrapper._preview.innerHTML =
                "";


            wrapper._preview.style.display =
                "none";


            setMode(
                "url"
            );

        };


    return wrapper;

}
