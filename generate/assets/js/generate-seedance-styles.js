/* =========================================================
   GEN-Z.AI
   SEEDANCE 2.5 GENERATE STYLES
   ---------------------------------------------------------
   File:
   generate/generate-seedance-styles.js

   Tanggung jawab:
   - Seluruh CSS khusus Seedance 2.5
   - Tidak menangani logic Generate
   - Tidak menangani upload
   - Tidak menangani parameter
   - Tidak menangani validation

   IMPORTANT:
   - CSS dibuat scoped menggunakan .seedance-form
   - Layout Seedance tidak boleh dipengaruhi
     oleh grid/flex global dari halaman Generate
========================================================= */

"use strict";


/* =========================================================
   INJECT SEEDANCE STYLES
========================================================= */

function injectSeedanceStyles() {

    const styleId =
        "seedance-generate-styles";


    let style =
        document.getElementById(
            styleId
        );


    /*
     * Seedance dapat dirender ulang tanpa reload halaman.
     * Karena itu CSS selalu diperbarui.
     */

    if (!style) {

        style =
            document.createElement(
                "style"
            );

        style.id =
            styleId;

        document.head.appendChild(
            style
        );

    }


    style.textContent = `

        /* =====================================================
           ROOT FORM
           -----------------------------------------------------
           Seedance menggunakan grid 2 kolom.
           Field tertentu dapat menggunakan full width.

           PENTING:
           Grid 2 kolom berlaku pada desktop DAN mobile.
        ===================================================== */

        .seedance-form {

            display:
                grid !important;

            grid-template-columns:
                minmax(0, 1fr)
                minmax(0, 1fr) !important;

            grid-auto-flow:
                row !important;

            grid-auto-rows:
                max-content !important;

            column-gap:
                20px !important;

            row-gap:
                18px !important;

            width:
                100% !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            height:
                auto !important;

            min-height:
                0 !important;

            max-height:
                none !important;

            margin:
                0 !important;

            padding:
                0 !important;

            box-sizing:
                border-box !important;

            overflow:
                visible !important;

            grid-column:
                1 / -1 !important;

            grid-row:
                auto !important;

            flex:
                0 0 100% !important;

            align-self:
                stretch !important;

            justify-self:
                stretch !important;

            align-items:
                stretch !important;

            justify-items:
                stretch !important;

            align-content:
                start !important;

            justify-content:
                stretch !important;

        }


        .seedance-form *,
        .seedance-form *::before,
        .seedance-form *::after {

            box-sizing:
                border-box !important;

        }


        /* =====================================================
           SEEDANCE FIELD
           -----------------------------------------------------
           Jangan lagi memaksa semua field menjadi full-width.
           Posisi ditentukan oleh:
           - seedance-field-half
           - seedance-field-full

           Fallback:
           field biasa tetap berada dalam satu kolom.
        ===================================================== */

        .seedance-form > .seedance-field {

            display:
                block !important;

            position:
                relative;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            min-height:
                0 !important;

            max-height:
                none !important;

            margin:
                0 !important;

            padding:
                16px !important;

            box-sizing:
                border-box !important;

            grid-column:
                auto !important;

            grid-row:
                auto !important;

            grid-template-columns:
                none !important;

            grid-template-rows:
                none !important;

            flex:
                0 0 auto !important;

            align-self:
                stretch !important;

            justify-self:
                stretch !important;

            align-items:
                initial !important;

            justify-items:
                initial !important;

            overflow:
                visible !important;

            border:
                1px solid
                rgba(255,45,80,.20);

            border-radius:
                14px;

            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.045),
                    rgba(0,0,0,.25)
                );

            box-shadow:
                0 0 22px
                rgba(255,35,70,.055);

        }


        /* =====================================================
           HALF WIDTH
           -----------------------------------------------------
           Tetap 1 kolom dari grid 2 kolom.
        ===================================================== */

        .seedance-form
        > .seedance-field.seedance-field-half {

            grid-column:
                span 1 !important;

            width:
                100% !important;

            min-width:
                0 !important;

            max-width:
                none !important;

            justify-self:
                stretch !important;

        }


        /* =====================================================
           FULL WIDTH
           -----------------------------------------------------
           Prompt
           Reference Audio
           Web Search

           Field mengambil kedua kolom.
        ===================================================== */

        .seedance-form
        > .seedance-field.seedance-field-full {

            grid-column:
                1 / -1 !important;

            width:
                100% !important;

            min-width:
                0 !important;

            max-width:
                none !important;

            justify-self:
                stretch !important;

        }


        /* =====================================================
           FORCE PROMPT FULL WIDTH
           -----------------------------------------------------
           Pengaman apabila class dari renderer berubah.
        ===================================================== */

        .seedance-form
        > .seedance-field:has(#seedancePrompt) {

            grid-column:
                1 / -1 !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            justify-self:
                stretch !important;

        }


        /* =====================================================
           FORCE REFERENCE AUDIO FULL WIDTH
           -----------------------------------------------------
           Pengaman apabila class dari renderer berubah.
        ===================================================== */

        .seedance-form
        > .seedance-field:has(
            [data-seedance-media="referenceAudio"]
        ) {

            grid-column:
                1 / -1 !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            justify-self:
                stretch !important;

        }


        /* =====================================================
           FORCE WEB SEARCH FULL WIDTH
           -----------------------------------------------------
           Pengaman apabila class dari renderer berubah.
        ===================================================== */

        .seedance-form
        > .seedance-field:has(#seedanceWebSearch) {

            grid-column:
                1 / -1 !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            justify-self:
                stretch !important;

        }


        /* =====================================================
           FALLBACK
           -----------------------------------------------------
           Jika field belum memiliki class half/full,
           tetap gunakan satu grid cell.
        ===================================================== */

        .seedance-form
        > .seedance-field:not(.seedance-field-half):not(.seedance-field-full) {

            grid-column:
                auto !important;

            width:
                100% !important;

            min-width:
                0 !important;

            max-width:
                none !important;

        }


        /* =====================================================
           FIELD HEADER
        ===================================================== */

        .seedance-field-header {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            margin:
                0 0 12px 0 !important;

            padding:
                0 !important;

            box-sizing:
                border-box !important;

            grid-template-columns:
                none !important;

        }


        .seedance-field-header > div {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

        }


        .seedance-field-title {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            color:
                #fff;

            font-size:
                14px;

            font-weight:
                800;

            line-height:
                1.35;

        }


        .seedance-field-description {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            margin-top:
                5px !important;

            color:
                rgba(255,255,255,.48);

            font-size:
                12px;

            line-height:
                1.45;

        }


        /* =====================================================
           MEDIA SOURCE
        ===================================================== */

        .seedance-media-source {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            margin:
                0 !important;

            padding:
                0 !important;

            box-sizing:
                border-box !important;

            overflow:
                visible !important;

        }


        .seedance-source-panel {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            margin:
                0 !important;

            padding:
                0 !important;

        }


        .seedance-source-panel[hidden] {

            display:
                none !important;

        }


        /* =====================================================
           SOURCE TABS
        ===================================================== */

        .seedance-source-tabs {

            display:
                flex !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            gap:
                7px;

            margin:
                0 0 10px 0 !important;

            padding:
                0 !important;

            align-items:
                stretch !important;

            justify-content:
                stretch !important;

            flex-direction:
                row !important;

            flex-wrap:
                nowrap !important;

        }


        .seedance-source-tab {

            display:
                block !important;

            flex:
                1 1 0 !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                36px;

            margin:
                0 !important;

            padding:
                0 10px;

            border:
                1px solid
                rgba(255,255,255,.12);

            border-radius:
                9px;

            background:
                rgba(255,255,255,.045);

            color:
                rgba(255,255,255,.62);

            cursor:
                pointer;

            font-size:
                12px;

            font-weight:
                700;

            line-height:
                normal;

            white-space:
                nowrap;

        }


        .seedance-source-tab.is-active {

            border-color:
                rgba(255,35,70,.65);

            background:
                rgba(255,35,70,.12);

            color:
                #fff;

        }


        /* =====================================================
           UPLOAD TOOLBAR
        ===================================================== */

        .seedance-upload-toolbar {

            display:
                flex !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                auto !important;

            margin:
                0 0 9px 0 !important;

            padding:
                0 !important;

            align-items:
                center !important;

            justify-content:
                space-between !important;

            flex-direction:
                row !important;

            flex-wrap:
                nowrap !important;

            gap:
                8px;

        }


        .seedance-add-file-button {

            display:
                block !important;

            flex:
                0 0 auto !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                34px;

            margin:
                0 !important;

            padding:
                0 11px;

            border:
                1px solid
                rgba(255,35,70,.55);

            border-radius:
                8px;

            background:
                rgba(255,35,70,.10);

            color:
                #fff;

            cursor:
                pointer;

            font-size:
                11px;

            font-weight:
                800;

            line-height:
                normal;

            white-space:
                nowrap;

        }


        .seedance-add-file-button:hover {

            background:
                rgba(255,35,70,.20);

            border-color:
                rgba(255,35,70,.85);

        }


        .seedance-file-limit {

            display:
                block !important;

            flex:
                0 0 auto !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin-left:
                auto !important;

            color:
                rgba(255,255,255,.45);

            font-size:
                10px;

            font-weight:
                700;

            white-space:
                nowrap;

        }


        /* =====================================================
           NATIVE FILE INPUT
        ===================================================== */

        .seedance-file-input {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                40px;

            margin:
                0 !important;

            padding:
                8px;

            border:
                1px solid
                rgba(255,255,255,.11);

            border-radius:
                9px;

            background:
                rgba(0,0,0,.32);

            color:
                #fff;

            font-size:
                11px;

            line-height:
                normal;

            outline:
                none;

        }


        .seedance-file-input.seedance-hidden-native-input {

            position:
                absolute !important;

            display:
                block !important;

            width:
                1px !important;

            height:
                1px !important;

            min-width:
                1px !important;

            max-width:
                1px !important;

            padding:
                0 !important;

            margin:
                -1px !important;

            opacity:
                0 !important;

            overflow:
                hidden !important;

            clip:
                rect(0,0,0,0) !important;

            white-space:
                nowrap !important;

            border:
                0 !important;

        }


        /* =====================================================
           FILE HELP
        ===================================================== */

        .seedance-file-help {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                6px 0 0 0 !important;

            padding:
                0 !important;

            color:
                rgba(255,255,255,.38);

            font-size:
                10px;

            line-height:
                1.4;

        }


        /* =====================================================
           SELECTED FILES
        ===================================================== */

        .seedance-selected-files {

            display:
                grid !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                10px 0 0 0 !important;

            padding:
                0 !important;

            gap:
                6px;

            grid-template-columns:
                minmax(0, 1fr) !important;

            grid-auto-columns:
                auto !important;

        }


        .seedance-selected-file {

            display:
                flex !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                7px 8px;

            align-items:
                center !important;

            justify-content:
                flex-start !important;

            flex-direction:
                row !important;

            flex-wrap:
                nowrap !important;

            gap:
                8px;

            border:
                1px solid
                rgba(255,255,255,.07);

            border-radius:
                8px;

            background:
                rgba(255,255,255,.025);

        }


        .seedance-selected-file-index {

            display:
                flex !important;

            flex:
                0 0 24px !important;

            width:
                24px !important;

            max-width:
                24px !important;

            min-width:
                24px !important;

            height:
                24px !important;

            margin:
                0 !important;

            padding:
                0 !important;

            align-items:
                center !important;

            justify-content:
                center !important;

            border-radius:
                6px;

            background:
                rgba(255,35,70,.10);

            color:
                rgba(255,255,255,.75);

            font-size:
                9px;

            font-weight:
                800;

        }


        .seedance-selected-file-info {

            display:
                block !important;

            flex:
                1 1 auto !important;

            width:
                auto !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            overflow:
                hidden !important;

        }


        .seedance-selected-file-name {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            overflow:
                hidden !important;

            text-overflow:
                ellipsis !important;

            white-space:
                nowrap !important;

            color:
                rgba(255,255,255,.78);

            font-size:
                10px;

            font-weight:
                700;

            line-height:
                1.3;

        }


        .seedance-selected-file-size {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                100% !important;

            margin:
                2px 0 0 0 !important;

            padding:
                0 !important;

            color:
                rgba(255,255,255,.35);

            font-size:
                9px;

            line-height:
                1.2;

        }


        .seedance-remove-file-button {

            display:
                block !important;

            flex:
                0 0 auto !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            height:
                29px;

            margin:
                0 !important;

            padding:
                0 8px;

            border:
                1px solid
                rgba(255,70,90,.25);

            border-radius:
                7px;

            background:
                rgba(255,35,70,.07);

            color:
                rgba(255,150,160,.9);

            cursor:
                pointer;

            font-size:
                9px;

            font-weight:
                800;

            white-space:
                nowrap;

        }


        .seedance-remove-file-button:hover {

            border-color:
                rgba(255,70,90,.65);

            background:
                rgba(255,35,70,.16);

            color:
                #fff;

        }


        /* =====================================================
           URL / PROMPT / SELECT
        ===================================================== */

        .seedance-url-input,
        .seedance-prompt-input,
        .seedance-select {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            box-sizing:
                border-box !important;

            border:
                1px solid
                rgba(255,255,255,.11);

            border-radius:
                9px;

            background:
                rgba(0,0,0,.32);

            color:
                #fff;

            outline:
                none;

        }


        .seedance-url-input,
        .seedance-prompt-input {

            padding:
                11px;

            resize:
                vertical;

            line-height:
                1.45;

        }


        .seedance-prompt-input {

            min-height:
                130px;

        }


        .seedance-url-input {

            min-height:
                72px;

        }


        .seedance-select {

            min-height:
                42px;

            padding:
                0 11px;

        }


        .seedance-prompt-input:focus,
        .seedance-url-input:focus,
        .seedance-select:focus,
        .seedance-file-input:focus {

            border-color:
                rgba(255,35,70,.65);

            box-shadow:
                0 0 0 3px
                rgba(255,35,70,.08);

        }


        /* =====================================================
           PREVIEW
        ===================================================== */

        .seedance-media-preview {

            display:
                grid !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                10px 0 0 0 !important;

            padding:
                0 !important;

            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(
                        140px,
                        1fr
                    )
                ) !important;

            gap:
                8px;

        }


        .seedance-preview-media {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            height:
                auto !important;

            max-height:
                240px;

            margin:
                0 !important;

            padding:
                0 !important;

            object-fit:
                contain;

            border-radius:
                8px;

            background:
                #000;

        }


        /* =====================================================
           COUNTER
        ===================================================== */

        .seedance-counter {

            display:
                block !important;

            width:
                100% !important;

            max-width:
                none !important;

            margin:
                5px 0 0 0 !important;

            padding:
                0 !important;

            text-align:
                right;

            color:
                rgba(255,255,255,.34);

            font-size:
                9px;

        }


        /* =====================================================
           DURATION
        ===================================================== */

        .seedance-duration-row {

            display:
                flex !important;

            width:
                100% !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            align-items:
                center !important;

            justify-content:
                stretch !important;

            flex-direction:
                row !important;

            flex-wrap:
                nowrap !important;

            gap:
                10px;

        }


        .seedance-duration-range {

            display:
                block !important;

            flex:
                1 1 auto !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            accent-color:
                #ff2346;

        }


        .seedance-duration-value {

            display:
                block !important;

            flex:
                0 0 auto !important;

            width:
                auto !important;

            max-width:
                none !important;

            min-width:
                65px !important;

            margin:
                0 !important;

            padding:
                0 !important;

            text-align:
                right;

            color:
                #fff;

            font-size:
                12px;

            font-weight:
                800;

        }


        .seedance-duration-scale {

            display:
                flex !important;

            width:
                100% !important;

            max-width:
                none !important;

            margin:
                6px 0 0 0 !important;

            padding:
                0 !important;

            align-items:
                center !important;

            justify-content:
                space-between !important;

            color:
                rgba(255,255,255,.3);

            font-size:
                9px;

        }


        /* =====================================================
           TOGGLE
        ===================================================== */

        .seedance-toggle {

            display:
                inline-flex !important;

            width:
                auto !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            align-items:
                center !important;

            justify-content:
                flex-start !important;

            flex-direction:
                row !important;

            flex-wrap:
                nowrap !important;

            gap:
                8px;

            cursor:
                pointer;

        }


        .seedance-toggle input {

            position:
                absolute !important;

            width:
                1px !important;

            height:
                1px !important;

            margin:
                -1px !important;

            padding:
                0 !important;

            opacity:
                0 !important;

            pointer-events:
                none !important;

        }


        .seedance-toggle-track {

            position:
                relative;

            display:
                block !important;

            flex:
                0 0 42px !important;

            width:
                42px !important;

            max-width:
                42px !important;

            min-width:
                42px !important;

            height:
                23px !important;

            margin:
                0 !important;

            padding:
                0 !important;

            border-radius:
                20px;

            background:
                rgba(255,255,255,.12);

            transition:
                .2s;

        }


        .seedance-toggle-thumb {

            position:
                absolute;

            display:
                block !important;

            top:
                3px;

            left:
                3px;

            width:
                17px !important;

            max-width:
                17px !important;

            min-width:
                17px !important;

            height:
                17px !important;

            margin:
                0 !important;

            padding:
                0 !important;

            border-radius:
                50%;

            background:
                rgba(255,255,255,.7);

            transition:
                .2s;

        }


        .seedance-toggle input:checked
        + .seedance-toggle-track {

            background:
                rgba(255,35,70,.72);

        }


        .seedance-toggle input:checked
        + .seedance-toggle-track
        .seedance-toggle-thumb {

            transform:
                translateX(19px);

            background:
                #fff;

        }


        .seedance-toggle-label {

            display:
                block !important;

            width:
                auto !important;

            max-width:
                100% !important;

            min-width:
                0 !important;

            margin:
                0 !important;

            padding:
                0 !important;

            color:
                rgba(255,255,255,.72);

            font-size:
                11px;

            font-weight:
                700;

            line-height:
                normal;

        }


        /* =====================================================
           MOBILE
           -----------------------------------------------------
           PENTING:
           HP TETAP 2 KOLOM.

           Full-width:
             - Prompt
             - Reference Audio
             - Web Search

           Half-width:
             - Frame Awal / Frame Akhir
             - Reference Images / Reference Videos
             - Resolution / Aspect Ratio
             - Duration / Output Format
             - Generate Audio / Return Last Frame
        ===================================================== */

        @media (max-width: 640px) {

            .seedance-form {

                display:
                    grid !important;

                grid-template-columns:
                    minmax(0, 1fr)
                    minmax(0, 1fr) !important;

                grid-auto-flow:
                    row !important;

                grid-auto-rows:
                    max-content !important;

                column-gap:
                    8px !important;

                row-gap:
                    12px !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

                min-width:
                    0 !important;

                margin:
                    0 !important;

                padding:
                    0 !important;

                overflow:
                    visible !important;

                grid-column:
                    1 / -1 !important;

                flex:
                    0 0 100% !important;

            }


            /* ================================================
               MOBILE HALF
            ================================================= */

            .seedance-form
            > .seedance-field.seedance-field-half {

                grid-column:
                    span 1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

                min-width:
                    0 !important;

                height:
                    auto !important;

                min-height:
                    0 !important;

                margin:
                    0 !important;

                padding:
                    11px !important;

                align-self:
                    stretch !important;

                justify-self:
                    stretch !important;

                overflow:
                    visible !important;

                border-radius:
                    11px;

            }


            /* ================================================
               MOBILE FULL
            ================================================= */

            .seedance-form
            > .seedance-field.seedance-field-full {

                grid-column:
                    1 / -1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

                min-width:
                    0 !important;

                height:
                    auto !important;

                min-height:
                    0 !important;

                margin:
                    0 !important;

                padding:
                    11px !important;

                align-self:
                    stretch !important;

                justify-self:
                    stretch !important;

                overflow:
                    visible !important;

                border-radius:
                    11px;

            }


            /* ================================================
               MOBILE PROMPT
            ================================================= */

            .seedance-form
            > .seedance-field:has(#seedancePrompt) {

                grid-column:
                    1 / -1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

            }


            /* ================================================
               MOBILE REFERENCE AUDIO
            ================================================= */

            .seedance-form
            > .seedance-field:has(
                [data-seedance-media="referenceAudio"]
            ) {

                grid-column:
                    1 / -1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

            }


            /* ================================================
               MOBILE WEB SEARCH
            ================================================= */

            .seedance-form
            > .seedance-field:has(#seedanceWebSearch) {

                grid-column:
                    1 / -1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

            }


            .seedance-field-header {

                margin-bottom:
                    9px !important;

            }


            .seedance-field-title {

                font-size:
                    12px;

            }


            .seedance-field-description {

                margin-top:
                    3px !important;

                font-size:
                    9px;

                line-height:
                    1.35;

            }


            .seedance-media-source {

                display:
                    block !important;

                width:
                    100% !important;

                max-width:
                    none !important;

                min-width:
                    0 !important;

            }


            .seedance-source-tabs {

                display:
                    flex !important;

                width:
                    100% !important;

                gap:
                    5px;

                margin-bottom:
                    8px !important;

                flex-direction:
                    row !important;

                flex-wrap:
                    nowrap !important;

            }


            .seedance-source-tab {

                flex:
                    1 1 0 !important;

                width:
                    auto !important;

                height:
                    32px;

                padding:
                    0 7px;

                font-size:
                    10px;

            }


            .seedance-upload-toolbar {

                display:
                    flex !important;

                width:
                    100% !important;

                align-items:
                    center !important;

                justify-content:
                    space-between !important;

                gap:
                    6px;

                flex-direction:
                    row !important;

                flex-wrap:
                    nowrap !important;

                margin-bottom:
                    7px !important;

            }


            .seedance-add-file-button {

                flex:
                    0 0 auto !important;

                height:
                    31px;

                padding:
                    0 9px;

                font-size:
                    10px;

            }


            .seedance-file-limit {

                flex:
                    0 0 auto !important;

                margin-left:
                    auto !important;

                font-size:
                    9px;

            }


            .seedance-file-input {

                width:
                    100% !important;

                height:
                    36px;

                padding:
                    7px;

                font-size:
                    10px;

            }


            .seedance-selected-files {

                width:
                    100% !important;

                grid-template-columns:
                    minmax(0, 1fr) !important;

                gap:
                    5px;

                margin-top:
                    7px !important;

            }


            .seedance-selected-file {

                width:
                    100% !important;

                gap:
                    6px;

                padding:
                    6px 7px;

            }


            .seedance-selected-file-index {

                flex:
                    0 0 21px !important;

                flex-basis:
                    21px !important;

                width:
                    21px !important;

                max-width:
                    21px !important;

                min-width:
                    21px !important;

                height:
                    21px !important;

                border-radius:
                    5px;

                font-size:
                    8px;

            }


            .seedance-selected-file-name {

                font-size:
                    9px;

            }


            .seedance-selected-file-size {

                font-size:
                    8px;

            }


            .seedance-remove-file-button {

                height:
                    26px;

                padding:
                    0 6px;

                font-size:
                    8px;

            }


            .seedance-file-help {

                font-size:
                    9px;

            }


            .seedance-prompt-input {

                width:
                    100% !important;

                min-height:
                    105px;

            }


            .seedance-url-input {

                width:
                    100% !important;

                min-height:
                    60px;

            }


            .seedance-url-input,
            .seedance-prompt-input,
            .seedance-select {

                width:
                    100% !important;

                font-size:
                    11px;

            }


            .seedance-select {

                min-height:
                    38px;

            }


            .seedance-media-preview {

                width:
                    100% !important;

                grid-template-columns:
                    repeat(
                        2,
                        minmax(
                            0,
                            1fr
                        )
                    ) !important;

                gap:
                    5px;

                margin-top:
                    7px !important;

            }


            .seedance-preview-media {

                max-height:
                    150px;

                border-radius:
                    6px;

            }


            .seedance-duration-row {

                display:
                    flex !important;

                width:
                    100% !important;

                gap:
                    7px;

                flex-direction:
                    row !important;

                flex-wrap:
                    nowrap !important;

            }


            .seedance-duration-range {

                flex:
                    1 1 auto !important;

                width:
                    auto !important;

                min-width:
                    0 !important;

            }


            .seedance-duration-value {

                flex:
                    0 0 auto !important;

                min-width:
                    55px !important;

                font-size:
                    10px;

            }


            .seedance-duration-scale {

                width:
                    100% !important;

                margin-top:
                    4px !important;

                font-size:
                    8px;

            }


            .seedance-toggle {

                display:
                    inline-flex !important;

                gap:
                    7px;

            }


            .seedance-toggle-track {

                flex:
                    0 0 39px !important;

                width:
                    39px !important;

                max-width:
                    39px !important;

                min-width:
                    39px !important;

                height:
                    22px !important;

            }


            .seedance-toggle-thumb {

                width:
                    16px !important;

                max-width:
                    16px !important;

                min-width:
                    16px !important;

                height:
                    16px !important;

            }


            .seedance-toggle input:checked
            + .seedance-toggle-track
            .seedance-toggle-thumb {

                transform:
                    translateX(17px);

            }


            .seedance-toggle-label {

                font-size:
                    10px;

            }


            .seedance-counter {

                font-size:
                    8px;

            }

        }


        /* =====================================================
           VERY SMALL PHONE
           -----------------------------------------------------
           Tetap 2 kolom.
           Jangan kembali ke 1 kolom.
        ===================================================== */

        @media (max-width: 380px) {

            .seedance-form {

                width:
                    100% !important;

                max-width:
                    100% !important;

                min-width:
                    0 !important;

                grid-template-columns:
                    minmax(0, 1fr)
                    minmax(0, 1fr) !important;

                column-gap:
                    6px !important;

            }


            .seedance-form
            > .seedance-field.seedance-field-half {

                grid-column:
                    span 1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

            }


            .seedance-form
            > .seedance-field.seedance-field-full {

                grid-column:
                    1 / -1 !important;

                width:
                    100% !important;

                max-width:
                    100% !important;

            }


            .seedance-form
            > .seedance-field:has(#seedancePrompt) {

                grid-column:
                    1 / -1 !important;

            }


            .seedance-form
            > .seedance-field:has(
                [data-seedance-media="referenceAudio"]
            ) {

                grid-column:
                    1 / -1 !important;

            }


            .seedance-form
            > .seedance-field:has(#seedanceWebSearch) {

                grid-column:
                    1 / -1 !important;

            }


            .seedance-field {

                padding:
                    9px !important;

                margin-bottom:
                    10px !important;

            }


            .seedance-source-tab {

                height:
                    30px;

                font-size:
                    9px;

            }


            .seedance-add-file-button {

                height:
                    29px;

                padding:
                    0 8px;

                font-size:
                    9px;

            }


            .seedance-file-limit {

                font-size:
                    8px;

            }


            .seedance-selected-file {

                gap:
                    5px;

                padding:
                    5px 6px;

            }


            .seedance-selected-file-index {

                flex:
                    0 0 20px !important;

                flex-basis:
                    20px !important;

                width:
                    20px !important;

                max-width:
                    20px !important;

                min-width:
                    20px !important;

                height:
                    20px !important;

            }


            .seedance-remove-file-button {

                height:
                    24px;

                padding:
                    0 5px;

                font-size:
                    7px;

            }


            .seedance-media-preview {

                gap:
                    4px;

            }


            .seedance-preview-media {

                max-height:
                    125px;

            }


            .seedance-duration-value {

                min-width:
                    50px !important;

                font-size:
                    9px;

            }

        }

    `;

}


/* =========================================================
   PUBLIC API
========================================================= */

export {

    injectSeedanceStyles

};


export default Object.freeze({

    injectSeedanceStyles

});
