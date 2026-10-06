/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-models.js

   Fungsi:
   - Mengambil katalog model OpenKey
   - Memfilter model yang dapat menerima image/frame input
   - Mengisi dropdown #visionVideoModel
   - Menyimpan katalog ke Vision Video State
   - Memilih model yang valid secara otomatis
   - Tidak menangani analisis, upload, credit, atau history
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        endpoint:
            "/api/openkey-chat",

        timeout:
            30000,

        operation:
            "openkey_models"

    });


    /* =====================================================
       DEPENDENCIES
    ===================================================== */

    function getState() {

        const state =
            window.GENZVisionVideoState;


        if (!state) {

            throw new Error(
                "GEN-Z.AI Vision Video State belum tersedia."
            );

        }


        return state;

    }


    function getDOM() {

        const dom =
            window.GENZVisionVideoDOM;


        if (!dom) {

            throw new Error(
                "GEN-Z.AI Vision Video DOM belum tersedia."
            );

        }


        return dom;

    }


    function getModelSelect() {

        const select =
            getDOM().get(
                "model"
            );


        if (!select) {

            throw new Error(
                "Dropdown #visionVideoModel tidak ditemukan."
            );

        }


        return select;

    }


    /* =====================================================
       SESSION
    ===================================================== */

    async function getAccessToken() {

        const clients = [

            window.supabaseClient,

            window.GENZ_SUPABASE

        ].filter(Boolean);


        for (
            const client
            of clients
        ) {

            try {

                if (
                    client.auth &&
                    typeof client.auth.getSession ===
                        "function"
                ) {

                    const result =
                        await client.auth.getSession();


                    const session =
                        result?.data?.session ||
                        null;


                    if (
                        session?.access_token
                    ) {

                        return session.access_token;

                    }

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision Video] Gagal membaca session:",
                    error
                );

            }

        }


        if (
            window.GENZVisionVideoSession &&
            window.GENZVisionVideoSession.access_token
        ) {

            return (
                window.GENZVisionVideoSession.access_token
            );

        }


        return null;

    }


    /* =====================================================
       API REQUEST
    ===================================================== */

    async function requestCatalog() {

        const token =
            await getAccessToken();


        const headers = {

            "Content-Type":
                "application/json",

            "Accept":
                "application/json"

        };


        if (token) {

            headers.Authorization =
                "Bearer " + token;

        }


        const controller =
            new AbortController();


        const timer =
            window.setTimeout(
                function () {

                    controller.abort();

                },
                CONFIG.timeout
            );


        try {

            const response =
                await fetch(
                    CONFIG.endpoint,
                    {

                        method:
                            "POST",

                        headers,

                        credentials:
                            "same-origin",

                        body:
                            JSON.stringify({

                                operation:
                                    CONFIG.operation

                        }),

                        signal:
                            controller.signal

                    }
                );


            const text =
                await response.text();


            let data = {};


            try {

                data =
                    text
                        ? JSON.parse(text)
                        : {};

            } catch {

                data = {

                    raw:
                        text

                };

            }


            if (
                !response.ok
            ) {

                throw new Error(

                    data?.error ||
                    data?.message ||
                    data?.raw ||
                    `HTTP ${response.status}`

                );

            }


            if (
                data?.success === false
            ) {

                throw new Error(

                    data?.error ||
                    data?.message ||
                    "Katalog model OpenKey gagal."

                );

            }


            return data;

        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Timeout saat mengambil katalog model OpenKey."
                );

            }


            throw error;

        } finally {

            window.clearTimeout(
                timer
            );

        }

    }


    /* =====================================================
       COLLECT VALUES
    ===================================================== */

    function collectValues(
        value,
        result = []
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return result;

        }


        if (
            Array.isArray(value)
        ) {

            value.forEach(
                item => {

                    collectValues(
                        item,
                        result
                    );

                }
            );


            return result;

        }


        if (
            typeof value ===
            "object"
        ) {

            Object.entries(
                value
            ).forEach(
                (
                    [
                        key,
                        item
                    ]
                ) => {

                    const normalizedKey =
                        String(
                            key
                        )
                            .trim()
                            .toLowerCase();


                    if (
                        normalizedKey
                    ) {

                        result.push(
                            normalizedKey
                        );

                    }


                    if (
                        item !== true
                    ) {

                        collectValues(
                            item,
                            result
                        );

                    }

                }
            );


            return result;

        }


        const text =
            String(
                value
            )
                .trim()
                .toLowerCase();


        if (
            text
        ) {

            result.push(
                text
            );

        }


        return result;

    }


    /* =====================================================
       NORMALIZE MODEL
    ===================================================== */

    function normalizeModel(
        model
    ) {

        if (
            !model ||
            typeof model !==
                "object"
        ) {

            return null;

        }


        const id =
            String(

                model.model_id ||
                model.modelId ||
                model.id ||
                model.slug ||
                model.model ||
                ""

            ).trim();


        const name =
            String(

                model.model_name ||
                model.modelName ||
                model.name ||
                model.display_name ||
                model.displayName ||
                id ||
                ""

            ).trim();


        if (
            !id
        ) {

            return null;

        }


        return {

            ...model,

            id,

            name,

            provider:
                String(

                    model.provider ||
                    model.provider_name ||
                    model.providerName ||
                    "openkey"

                ).trim()

        };

    }


    /* =====================================================
       MODEL ARRAY EXTRACTION
    ===================================================== */

    function findModelArray(
        source
    ) {

        if (
            !source
        ) {

            return [];

        }


        if (
            Array.isArray(source)
        ) {

            return source;

        }


        if (
            typeof source !==
            "object"
        ) {

            return [];

        }


        const directKeys = [

            "models",
            "model_list",
            "modelList",
            "model_catalog",
            "modelCatalog",
            "available_models",
            "availableModels",
            "data",
            "results",
            "items"

        ];


        for (
            const key
            of directKeys
        ) {

            if (
                Array.isArray(
                    source[key]
                )
            ) {

                return source[key];

            }

        }


        for (
            const key
            of directKeys
        ) {

            const nested =
                source[key];


            if (
                nested &&
                typeof nested ===
                    "object"
            ) {

                const result =
                    findModelArray(
                        nested
                    );


                if (
                    result.length
                ) {

                    return result;

                }

            }

        }


        return [];

    }


    /* =====================================================
       VISION INPUT DETECTION
    ===================================================== */

    function supportsVisionInput(
        model
    ) {

        if (
            !model
        ) {

            return false;

        }


        const values = [];


        /*
         * -------------------------------------------------
         * Direct modality / input fields
         * -------------------------------------------------
         */

        const modalityFields = [

            "input",
            "inputs",
            "input_type",
            "input_types",
            "inputType",
            "inputTypes",
            "input_modalities",
            "inputModalities",

            "supported_input",
            "supported_inputs",
            "supportedInput",
            "supportedInputs",
            "supported_input_types",
            "supportedInputTypes",

            "supported_modalities",
            "supportedModalities",

            "modalities",
            "modality",

            "capabilities",
            "architecture",

            "media",
            "media_types",
            "mediaTypes",

            "accepts",
            "accepted_inputs",
            "acceptedInputs"

        ];


        modalityFields.forEach(
            key => {

                if (
                    Object.prototype.hasOwnProperty.call(
                        model,
                        key
                    )
                ) {

                    collectValues(
                        model[key],
                        values
                    );

                }

            }
        );


        /* -------------------------------------------------
           Raw provider object
        ------------------------------------------------- */

        if (
            model.raw &&
            typeof model.raw ===
                "object"
        ) {

            modalityFields.forEach(
                key => {

                    if (
                        Object.prototype.hasOwnProperty.call(
                            model.raw,
                            key
                        )
                    ) {

                        collectValues(
                            model.raw[key],
                            values
                        );

                    }

                }
            );

        }


        /* -------------------------------------------------
           Nested metadata / config / specification
        ------------------------------------------------- */

        const nestedFields = [

            "metadata",
            "meta",
            "config",
            "configuration",
            "spec",
            "specification",
            "details",
            "features"

        ];


        nestedFields.forEach(
            key => {

                if (
                    model[key] !==
                    undefined
                ) {

                    collectValues(
                        model[key],
                        values
                    );

                }

            }
        );


        if (
            model.raw &&
            typeof model.raw ===
                "object"
        ) {

            nestedFields.forEach(
                key => {

                    if (
                        model.raw[key] !==
                        undefined
                    ) {

                        collectValues(
                            model.raw[key],
                            values
                        );

                    }

                }
            );

        }


        /* =================================================
           EXPLICIT BOOLEAN CAPABILITIES
        ================================================= */

        const positiveFlags = [

            "supports_image",
            "supports_images",
            "supportsImage",
            "supportsImages",

            "supports_vision",
            "supportsVision",

            "supports_video",
            "supports_videos",
            "supportsVideo",
            "supportsVideos",

            "image_input",
            "imageInput",
            "image_inputs",
            "imageInputs",

            "vision_input",
            "visionInput",

            "video_input",
            "videoInput",

            "accepts_image",
            "acceptsImage",

            "accepts_video",
            "acceptsVideo",

            "image_supported",
            "imageSupported",

            "vision_supported",
            "visionSupported",

            "video_supported",
            "videoSupported"

        ];


        for (
            const key
            of positiveFlags
        ) {

            if (
                model[key] === true
            ) {

                return true;

            }


            if (
                model.raw &&
                model.raw[key] === true
            ) {

                return true;

            }

        }


        /* =================================================
           NORMALIZED VALUES
        ================================================= */

        const uniqueValues =
            [
                ...new Set(
                    values
                        .map(
                            value =>
                                String(
                                    value
                                )
                                    .trim()
                                    .toLowerCase()
                        )
                        .filter(Boolean)
                )
            ];


        const serialized =
            uniqueValues.join(
                " "
            );


        /* =================================================
           IMAGE DETECTION
        ================================================= */

        const hasImage =
            uniqueValues.some(
                value => {

                    return (

                        value ===
                            "image" ||

                        value ===
                            "images" ||

                        value ===
                            "img" ||

                        value ===
                            "vision" ||

                        value ===
                            "multimodal" ||

                        value.includes(
                            "image"
                        ) ||

                        value.includes(
                            "vision"
                        ) ||

                        value.includes(
                            "visual"
                        )

                    );

                }
            );


        /* =================================================
           VIDEO DETECTION
        ================================================= */

        const hasVideo =
            uniqueValues.some(
                value => {

                    return (

                        value ===
                            "video" ||

                        value ===
                            "videos" ||

                        value.includes(
                            "video"
                        )

                    );

                }
            );


        /* =================================================
           FRAME DETECTION
        ================================================= */

        const hasFrame =
            uniqueValues.some(
                value => {

                    return (

                        value ===
                            "frame" ||

                        value ===
                            "frames" ||

                        value.includes(
                            "frame"
                        ) ||

                        value.includes(
                            "first_frame"
                        ) ||

                        value.includes(
                            "last_frame"
                        )

                    );

                }
            );


        if (
            hasImage ||
            hasVideo ||
            hasFrame
        ) {

            return true;

        }


        /* =================================================
           SERIALIZED FALLBACK
        ================================================= */

        return (

            serialized.includes(
                "multimodal"
            ) ||

            serialized.includes(
                "vision"
            ) ||

            serialized.includes(
                "image"
            ) ||

            serialized.includes(
                "visual"
            ) ||

            serialized.includes(
                "video"
            ) ||

            serialized.includes(
                "frame"
            )

        );

    }


    /* =====================================================
       FILTER
    ===================================================== */

    function filterVisionModels(
        models
    ) {

        if (
            !Array.isArray(
                models
            )
        ) {

            return [];

        }


        const normalized =
            models
                .map(
                    normalizeModel
                )
                .filter(Boolean);


        return normalized.filter(
            supportsVisionInput
        );

    }


    /* =====================================================
       LOADING UI
    ===================================================== */

    function setLoadingUI() {

        const select =
            getModelSelect();


        select.disabled =
            true;


        select.innerHTML =
            "";


        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            "Loading models...";


        option.disabled =
            true;


        option.selected =
            true;


        select.appendChild(
            option
        );

    }


    /* =====================================================
       ERROR UI
    ===================================================== */

    function setErrorUI(
        message
    ) {

        const select =
            getModelSelect();


        select.disabled =
            true;


        select.innerHTML =
            "";


        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            message ||
            "Model tidak tersedia";


        option.disabled =
            true;


        option.selected =
            true;


        select.appendChild(
            option
        );

    }


    /* =====================================================
       POPULATE SELECT
    ===================================================== */

    function populate(
        models
    ) {

        const select =
            getModelSelect();


        select.innerHTML =
            "";


        if (
            !models.length
        ) {

            setErrorUI(
                "Tidak ada model Vision yang tersedia."
            );


            return null;

        }


        models.forEach(
            model => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    model.id;


                option.textContent =
                    model.name;


                option.dataset.modelId =
                    model.id;


                option.dataset.provider =
                    model.provider ||
                    "openkey";


                select.appendChild(
                    option
                );

            }
        );


        const state =
            getState();


        const previous =
            state.getValue(
                "settings.model",
                ""
            );


        const previousExists =
            models.some(
                model =>
                    model.id ===
                    previous
            );


        const selected =
            previousExists
                ? previous
                : models[0].id;


        select.value =
            selected;


        select.disabled =
            false;


        state.setSettings({

            model:
                selected

        });


        return (
            models.find(
                model =>
                    model.id ===
                    selected
            ) ||
            models[0]
        );

    }


    /* =====================================================
       LOAD MODELS
    ===================================================== */

    async function loadModels() {

        const state =
            getState();


        setLoadingUI();


        if (
            typeof state.setModelsLoading ===
            "function"
        ) {

            state.setModelsLoading(
                true
            );

        }


        try {

            const response =
                await requestCatalog();


            /* =================================================
               EXTRACT RAW MODEL LIST
            ================================================= */

            const rawModels =
                findModelArray(
                    response
                );


            if (
                !rawModels.length
            ) {

                throw new Error(
                    "OpenKey tidak mengembalikan daftar model."
                );

            }


            console.info(
                "[GEN-Z.AI Vision Video] OpenKey catalog:",
                rawModels.length,
                "model"
            );


            /* =================================================
               FILTER VISION MODELS
            ================================================= */

            const models =
                filterVisionModels(
                    rawModels
                );


            console.info(
                "[GEN-Z.AI Vision Video] Vision-compatible models:",
                models.length
            );


            if (
                !models.length
            ) {

                /*
                 * Jangan membuat model statis.
                 *
                 * Jika katalog memang dikembalikan tetapi
                 * metadata capability tidak dikenali,
                 * tampilkan error yang lebih informatif.
                 */

                throw new Error(
                    "OpenKey mengembalikan model, tetapi tidak ada model yang terdeteksi mendukung input image/frame."
                );

            }


            /* =================================================
               SAVE TO STATE
            ================================================= */

            if (
                typeof state.setModels ===
                "function"
            ) {

                state.setModels(
                    models
                );

            }


            /* =================================================
               POPULATE DROPDOWN
            ================================================= */

            const selected =
                populate(
                    models
                );


            /* =================================================
               READY EVENT
            ================================================= */

            document.dispatchEvent(
                new CustomEvent(
                    "genz:vision-video:models-ready",
                    {

                        detail: {

                            models,

                            selected

                        }

                    }
                )
            );


            /* =================================================
               LOG
            ================================================= */

            console.info(
                "[GEN-Z.AI Vision Video] Models loaded:",
                models.map(
                    model =>
                        model.id
                )
            );


            return {

                models,

                selected

            };

        } catch (
            error
        ) {

            if (
                typeof state.setModelsError ===
                "function"
            ) {

                state.setModelsError(
                    error
                );

            }


            setErrorUI(
                error?.message ||
                "Model Vision tidak dapat dimuat."
            );


            console.error(
                "[GEN-Z.AI Vision Video] Model catalog gagal:",
                error
            );


            throw error;

        } finally {

            if (
                typeof state.setModelsLoading ===
                "function"
            ) {

                state.setModelsLoading(
                    false
                );

            }

        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZVisionVideoModels = {

        config:
            CONFIG,

        loadModels,

        normalizeModel,

        supportsVisionInput,

        filterVisionModels

    };


    window.GENZVisionVideoModelsReady =
        true;


    console.info(
        "[GEN-Z.AI Vision Video] Models module ready."
    );

})();
