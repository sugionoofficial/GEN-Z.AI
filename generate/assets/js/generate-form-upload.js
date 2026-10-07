/* =========================================================
   GEN-Z.AI
   GENERATE FORM UPLOAD
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-upload.js

   Tanggung jawab:
   - Image URL / Upload field
   - Audio URL / Upload field
   - Image validation
   - Audio validation
   - Supabase Storage upload
   - Resolve uploaded image URL
   - Resolve uploaded audio URL

   Catatan:
   - Tidak menangani submit
   - Tidak menangani credit
   - Tidak menangani model state
   - Tidak menangani render seluruh form
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

import {
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   CONSTANTS
========================================================= */

export const STORAGE_BUCKET =
    "dashboard-videos";


export const ALLOWED_IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);


export const MAX_IMAGE_SIZE =
    10 * 1024 * 1024;


export const ALLOWED_AUDIO_TYPES =
    new Set([
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/x-pn-wav"
    ]);


export const MAX_AUDIO_SIZE =
    50 * 1024 * 1024;


/* =========================================================
   RANDOM ID
========================================================= */

function createRandomPart() {

    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {

        return crypto.randomUUID();

    }


    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );

}


/* =========================================================
   IMAGE STORAGE PATH
========================================================= */

export function createImageStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "image"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    const extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "jpg";


    return (
        "generate-input/" +
        safeUserId +
        "/" +
        createRandomPart() +
        "." +
        extension
    );

}


/* =========================================================
   AUDIO STORAGE PATH
========================================================= */

export function createAudioStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "audio"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    let extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "mp3";


    if (
        extension ===
        "mpeg"
    ) {

        extension =
            "mp3";

    }


    return (
        "generate-input/" +
        safeUserId +
        "/audio-" +
        createRandomPart() +
        "." +
        extension
    );

}


/* =========================================================
   IMAGE VALIDATION
========================================================= */

export function validateImageFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }


    if (
        !ALLOWED_IMAGE_TYPES.has(
            file.type
        )
    ) {

        throw new Error(
            "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP."
        );

    }


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Ukuran gambar maksimal 10 MB."
        );

    }


    return true;

}


/* =========================================================
   AUDIO VALIDATION
========================================================= */

export function validateAudioFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File audio tidak ditemukan."
        );

    }


    const mimeType =
        String(
            file.type ||
            ""
        )
            .trim()
            .toLowerCase();


    const fileName =
        String(
            file.name ||
            ""
        )
            .trim()
            .toLowerCase();


    const extensionAllowed =
        fileName.endsWith(
            ".mp3"
        ) ||
        fileName.endsWith(
            ".wav"
        );


    const mimeAllowed =
        ALLOWED_AUDIO_TYPES.has(
            mimeType
        );


    /*
     * Beberapa browser Windows dapat memberikan
     * MIME type kosong untuk WAV.
     *
     * Extension digunakan sebagai fallback.
     */

    if (
        !mimeAllowed &&
        !extensionAllowed
    ) {

        throw new Error(
            "Format audio tidak didukung. Gunakan MP3 atau WAV."
        );

    }


    if (
        file.size >
        MAX_AUDIO_SIZE
    ) {

        throw new Error(
            "Ukuran audio maksimal 50 MB."
        );

    }


    return true;

}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

export async function uploadImageFile(
    file
) {

    validateImageFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload gambar."
        );

    }


    const path =
        createImageStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const {
        error:
            uploadError
    } =
        await supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType:
                        file.type
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik gambar tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar berhasil:",
        publicUrl
    );


    return {
        path,
        url:
            publicUrl
    };

}


/* =========================================================
   UPLOAD AUDIO
========================================================= */

export async function uploadAudioFile(
    file
) {

    validateAudioFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload audio."
        );

    }


    const path =
        createAudioStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload audio:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const contentType =
        file.type ||
        (
            file.name
                .toLowerCase()
                .endsWith(
                    ".wav"
                )
                ? "audio/wav"
                : "audio/mpeg"
        );


    const {
        error:
            uploadError
    } =
        await supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload audio gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik audio tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload audio berhasil:",
        publicUrl
    );


    return {
        path,
        url:
            publicUrl
    };

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


    const controls =
        document.createElement(
            "div"
        );


    controls.className =
        "generate-image-mode";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";


    urlButton.className =
        "generate-image-mode-button active";


    urlButton.textContent =
        "URL";


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";


    uploadButton.className =
        "generate-image-mode-button";


    uploadButton.textContent =
        "Upload";


    controls.appendChild(
        urlButton
    );


    controls.appendChild(
        uploadButton
    );


    wrapper.appendChild(
        controls
    );


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";


    urlInput.className =
        "generate-image-url form-input";


    urlInput.placeholder =
        "https://...";


    urlInput.dataset.parameter =
        parameterName;


    wrapper.appendChild(
        urlInput
    );


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.className =
        "generate-image-file form-input";


    fileInput.accept =
        definition.accept ||
        "image/jpeg,image/png,image/webp";


    const configuredMaxItems =
        Number(
            definition?.maxItems ??
            definition?.max_items
        );


    const multiple =
        definition?.multiple === true ||
        (
            Number.isFinite(
                configuredMaxItems
            ) &&
            configuredMaxItems > 1
        );


    fileInput.multiple =
        multiple;


    fileInput.style.display =
        "none";


    wrapper.appendChild(
        fileInput
    );


    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-image-preview";


    wrapper.appendChild(
        preview
    );


    function setMode(
        mode
    ) {

        const normalized =
            mode ===
            "upload"
                ? "upload"
                : "url";


        wrapper.dataset.imageMode =
            normalized;


        urlButton.classList.toggle(
            "active",
            normalized ===
            "url"
        );


        uploadButton.classList.toggle(
            "active",
            normalized ===
            "upload"
        );


        urlInput.style.display =
            normalized ===
            "url"
                ? ""
                : "none";


        fileInput.style.display =
            normalized ===
            "upload"
                ? ""
                : "none";

    }


    function clearPreview() {

        preview.innerHTML =
            "";

    }


    function setUploadedUrls(
        urls
    ) {

        const normalized =
            Array.isArray(
                urls
            )
                ? urls
                    .map(
                        url =>
                            String(
                                url ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean)
                : [];


        wrapper.dataset.uploadedUrls =
            JSON.stringify(
                normalized
            );


        wrapper.dataset.uploadedUrl =
            normalized[0] ||
            "";

    }


    function getUploadedUrls() {

        try {

            const parsed =
                JSON.parse(
                    wrapper.dataset.uploadedUrls ||
                    "[]"
                );


            if (
                Array.isArray(
                    parsed
                )
            ) {

                return parsed
                    .map(
                        url =>
                            String(
                                url ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean);

            }

        } catch {
            /* fallback */
        }


        const single =
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


        return single
            ? [single]
            : [];

    }


    function renderPreview(
        files
    ) {

        clearPreview();


        Array.from(
            files ||
            []
        ).forEach(
            file => {

                if (
                    !file ||
                    !file.type.startsWith(
                        "image/"
                    )
                ) {

                    return;

                }


                const reader =
                    new FileReader();


                reader.onload =
                    event => {

                        const image =
                            document.createElement(
                                "img"
                            );


                        image.src =
                            event.target?.result ||
                            "";


                        image.alt =
                            file.name ||
                            "Preview";


                        image.className =
                            "generate-image-preview-item";


                        preview.appendChild(
                            image
                        );

                    };


                reader.readAsDataURL(
                    file
                );

            }
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


    fileInput.addEventListener(
        "change",
        () => {

            const files =
                Array.from(
                    fileInput.files ||
                    []
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


            const selected =
                files.slice(
                    0,
                    multiple
                        ? maxItems
                        : 1
                );


            try {

                selected.forEach(
                    validateImageFile
                );


                renderPreview(
                    selected
                );


                wrapper._imageUploadPromise =
                    (async () => {

                        const urls =
                            [];


                        for (
                            const file
                            of selected
                        ) {

                            const uploaded =
                                await uploadImageFile(
                                    file
                                );


                            if (
                                uploaded?.url
                            ) {

                                urls.push(
                                    uploaded.url
                                );

                            }

                        }


                        setUploadedUrls(
                            urls
                        );


                        return urls;

                    })();


                wrapper._imageUploadPromise
                    .catch(
                        error => {

                            console.error(
                                "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
                                error
                            );

                        }
                    );

            } catch (
                error
            ) {

                fileInput.value =
                    "";


                clearPreview();


                wrapper._imageUploadPromise =
                    null;


                throw error;

            }

        }
    );


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
        () =>
            getUploadedUrls();


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            setUploadedUrls(
                normalized
                    ? [normalized]
                    : []
            );

        };


    wrapper.getSelectedFiles =
        () =>
            Array.from(
                fileInput.files ||
                []
            );


    wrapper.getImageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.clearUploadedFile =
        async () => {

            try {

                fileInput.value =
                    "";

            } catch {
                /* ignore */
            }


            urlInput.value =
                "";


            wrapper._imageUploadPromise =
                null;


            delete wrapper.dataset.uploadedUrl;


            delete wrapper.dataset.uploadedUrls;


            clearPreview();


            setMode(
                "url"
            );

        };


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


    wrapper.dataset.parameter =
        parameterName;


    wrapper.dataset.audioMode =
        "url";


    const controls =
        document.createElement(
            "div"
        );


    controls.className =
        "generate-audio-mode";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";


    urlButton.className =
        "generate-audio-mode-button active";


    urlButton.textContent =
        "URL";


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";


    uploadButton.className =
        "generate-audio-mode-button";


    uploadButton.textContent =
        "Upload";


    controls.appendChild(
        urlButton
    );


    controls.appendChild(
        uploadButton
    );


    wrapper.appendChild(
        controls
    );


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";


    urlInput.className =
        "generate-audio-url form-input";


    urlInput.placeholder =
        "https://...";


    urlInput.dataset.parameter =
        parameterName;


    wrapper.appendChild(
        urlInput
    );


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.className =
        "generate-audio-file form-input";


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


    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-audio-preview";


    wrapper.appendChild(
        preview
    );


    function setMode(
        mode
    ) {

        const normalized =
            mode ===
            "upload"
                ? "upload"
                : "url";


        wrapper.dataset.audioMode =
            normalized;


        urlButton.classList.toggle(
            "active",
            normalized ===
            "url"
        );


        uploadButton.classList.toggle(
            "active",
            normalized ===
            "upload"
        );


        urlInput.style.display =
            normalized ===
            "url"
                ? ""
                : "none";


        fileInput.style.display =
            normalized ===
            "upload"
                ? ""
                : "none";

    }


    function clearPreview() {

        preview.innerHTML =
            "";

    }


    function renderPreview(
        file
    ) {

        clearPreview();


        if (
            !file
        ) {

            return;

        }


        const audio =
            document.createElement(
                "audio"
            );


        audio.controls =
            true;


        audio.className =
            "generate-audio-preview-player";


        const reader =
            new FileReader();


        reader.onload =
            event => {

                audio.src =
                    event.target?.result ||
                    "";

            };


        reader.readAsDataURL(
            file
        );


        preview.appendChild(
            audio
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


    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files?.[0] ||
                null;


            if (
                !file
            ) {

                return;

            }


            try {

                validateAudioFile(
                    file
                );


                renderPreview(
                    file
                );


                wrapper._audioUploadPromise =
                    uploadAudioFile(
                        file
                    )
                        .then(
                            uploaded => {

                                const url =
                                    String(
                                        uploaded?.url ||
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
                        );

                wrapper._audioUploadPromise
                    .catch(
                        error => {

                            console.error(
                                "[GEN-Z.AI][Generate Form] Upload audio gagal:",
                                error
                            );

                        }
                    );

            } catch (
                error
            ) {

                fileInput.value =
                    "";


                clearPreview();


                wrapper._audioUploadPromise =
                    null;


                throw error;

            }

        }
    );


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
            fileInput.files?.[0] ||
            null;


    wrapper.getAudioMode =
        () =>
            wrapper.dataset.audioMode ||
            "url";


    wrapper.clearUploadedFile =
        async () => {

            try {

                fileInput.value =
                    "";

            } catch {
                /* ignore */
            }


            urlInput.value =
                "";


            wrapper._audioUploadPromise =
                null;


            delete wrapper.dataset.uploadedUrl;


            clearPreview();


            setMode(
                "url"
            );

        };


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   RESOLVE IMAGE PARAMETER
========================================================= */

export async function resolveImageParameterValue(
    imageInput,
    definition = {}
) {

    if (
        !imageInput
    ) {

        return [];

    }


    const mode =
        typeof imageInput.getInputMode ===
        "function"

            ? imageInput.getInputMode()

            : (
                imageInput.dataset.imageMode ||
                "url"
            );


    if (
        mode !==
        "upload"
    ) {

        const urlInput =
            typeof imageInput.getUrlInput ===
            "function"

                ? imageInput.getUrlInput()

                : imageInput.querySelector(
                    'input[type="url"]'
                );


        const url =
            String(
                urlInput?.value ||
                ""
            ).trim();


        return url
            ? [url]
            : [];

    }


    if (
        imageInput._imageUploadPromise
    ) {

        const pendingUrls =
            await imageInput._imageUploadPromise;


        if (
            Array.isArray(
                pendingUrls
            ) &&
            pendingUrls.length
        ) {

            return pendingUrls;

        }

    }


    if (
        typeof imageInput.getUploadedUrls ===
        "function"
    ) {

        const uploadedUrls =
            imageInput.getUploadedUrls();


        if (
            uploadedUrls.length
        ) {

            return uploadedUrls;

        }

    }


    const existingUrl =
        typeof imageInput.getUploadedUrl ===
        "function"

            ? imageInput.getUploadedUrl()

            : String(
                imageInput.dataset.uploadedUrl ||
                ""
            ).trim();


    if (
        existingUrl
    ) {

        return [
            existingUrl
        ];

    }


    const fileInput =
        typeof imageInput.getFileInput ===
        "function"

            ? imageInput.getFileInput()

            : imageInput.querySelector(
                ".generate-image-file"
            );


    const files =
        Array.from(
            fileInput?.files ||
            []
        );


    if (
        !files.length
    ) {

        return [];

    }


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


    const uploadedUrls =
        [];


    for (
        const file
        of selectedFiles
    ) {

        const uploaded =
            await uploadImageFile(
                file
            );


        if (
            uploaded?.url
        ) {

            uploadedUrls.push(
                uploaded.url
            );

        }

    }


    if (
        uploadedUrls.length
    ) {

        imageInput.dataset.uploadedUrl =
            uploadedUrls[0];


        imageInput.dataset.uploadedUrls =
            JSON.stringify(
                uploadedUrls
            );

    }


    return uploadedUrls;

}


/* =========================================================
   RESOLVE AUDIO PARAMETER
========================================================= */

export async function resolveAudioParameterValue(
    audioInput
) {

    if (
        !audioInput
    ) {

        return "";

    }


    const mode =
        typeof audioInput.getInputMode ===
        "function"

            ? audioInput.getInputMode()

            : (
                audioInput.dataset.audioMode ||
                "url"
            );


    if (
        mode !==
        "upload"
    ) {

        const urlInput =
            typeof audioInput.getUrlInput ===
            "function"

                ? audioInput.getUrlInput()

                : audioInput.querySelector(
                    'input[type="url"]'
                );


        return String(
            urlInput?.value ||
            ""
        ).trim();

    }


    if (
        audioInput._audioUploadPromise
    ) {

        const pendingUrl =
            await audioInput._audioUploadPromise;


        return String(
            pendingUrl ||
            ""
        ).trim();

    }


    const existingUrl =
        typeof audioInput.getUploadedUrl ===
        "function"

            ? audioInput.getUploadedUrl()

            : String(
                audioInput.dataset.uploadedUrl ||
                ""
            ).trim();


    if (
        existingUrl
    ) {

        return existingUrl;

    }


    const fileInput =
        typeof audioInput.getFileInput ===
        "function"

            ? audioInput.getFileInput()

            : audioInput.querySelector(
                ".generate-audio-file"
            );


    const file =
        fileInput?.files?.[0] ||
        null;


    if (
        !file
    ) {

        return "";

    }


    const uploaded =
        await uploadAudioFile(
            file
        );


    const uploadedUrl =
        String(
            uploaded?.url ||
            ""
        ).trim();


    if (
        uploadedUrl
    ) {

        audioInput.dataset.uploadedUrl =
            uploadedUrl;

    }


    return uploadedUrl;

}
