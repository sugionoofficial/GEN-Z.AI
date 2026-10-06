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
                model.id ||
                model.slug ||
                ""

            ).trim();


        const name =
            String(

                model.model_name ||
                model.name ||
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
                    "openkey"

                ).trim()

        };

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


        collectValues(
            model.input_modalities,
            values
        );


        collectValues(
            model.inputModalities,
            values
        );


        collectValues(
            model.modalities,
            values
        );


        collectValues(
            model.modality,
            values
        );


        collectValues(
            model.capabilities,
            values
        );


        collectValues(
            model.architecture,
            values
        );


        if (
            model.raw
        ) {

            collectValues(
                model.raw.input_modalities,
                values
            );


            collectValues(
                model.raw.inputModalities,
                values
            );


            collectValues(
                model.raw.modalities,
                values
            );


            collectValues(
                model.raw.modality,
                values
            );


            collectValues(
                model.raw.capabilities,
                values
            );


            collectValues(
                model.raw.architecture,
                values
            );

        }


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


        const hasImage =
            uniqueValues.some(
                value =>
                    value === "image" ||
                    value === "images" ||
                    value === "vision" ||
                    value === "multimodal" ||
                    value.includes("image") ||
                    value.includes("vision")
            );


        const hasVideo =
            uniqueValues.some(
                value =>
                    value === "video" ||
                    value === "videos" ||
                    value.includes("video")
            );


        if (
            hasImage ||
            hasVideo
        ) {

            return true;

        }


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
                "video"
            )

        );

    }


    /* =====================================================
       FILTER
    ===================================================== */

    function filterVisionModels(
        models
    ) {

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


            const rawModels =
                Array.isArray(
                    response?.models
                )

                    ? response.models

                    : (

                        Array.isArray(
                            response?.data
                        )

                            ? response.data

                            : []

                    );


            if (
                !rawModels.length
            ) {

                throw new Error(
                    "OpenKey tidak mengembalikan daftar model."
                );

            }


            const models =
                filterVisionModels(
                    rawModels
                );


            if (
                !models.length
            ) {

                throw new Error(
                    "OpenKey tidak menyediakan model yang mendukung input image/frame."
                );

            }


            if (
                typeof state.setModels ===
                "function"
            ) {

                state.setModels(
                    models
                );

            }


            const selected =
                populate(
                    models
                );


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
