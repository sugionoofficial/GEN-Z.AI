/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Fungsi:
   - Bind seluruh event halaman
   - File input
   - Drop
   - Change file
   - CHECK
   - CLEAN
   - DOWNLOAD
   - Keyboard interaction
   - Tidak mengambil alih logic cleaner/checker
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   INTERNAL STATE
========================================================= */

let currentCallbacks = null;


/* =========================================================
   SAFE ENABLE CHECK BUTTON
========================================================= */

function enableCheckButton() {

    const button =
        elements?.checkButton ||
        document.getElementById(
            "metadata-check-button"
        );


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] CHECK button tidak ditemukan."
        );


        return false;

    }


    /*
       Lepaskan seluruh mekanisme disabled.
    */

    button.disabled =
        false;


    button.removeAttribute(
        "disabled"
    );


    button.hidden =
        false;


    button.removeAttribute(
        "hidden"
    );


    button.classList.remove(
        "hidden",
        "disabled"
    );


    button.setAttribute(
        "aria-disabled",
        "false"
    );


    button.style.removeProperty(
        "pointer-events"
    );


    button.style.removeProperty(
        "opacity"
    );


    button.style.removeProperty(
        "display"
    );


    console.info(
        "[GEN-Z.AI][EVENTS] CHECK button enabled.",
        {
            disabled:
                button.disabled,

            hidden:
                button.hidden,

            classHidden:
                button.classList.contains(
                    "hidden"
                ),

            pointerEvents:
                getComputedStyle(
                    button
                ).pointerEvents
        }
    );


    return true;

}


/* =========================================================
   SAFE DISABLE CHECK BUTTON
========================================================= */

function disableCheckButton() {

    const button =
        elements?.checkButton ||
        document.getElementById(
            "metadata-check-button"
        );


    if (
        !button
    ) {

        return;

    }


    button.disabled =
        true;


    button.setAttribute(
        "disabled",
        "disabled"
    );


    button.setAttribute(
        "aria-disabled",
        "true"
    );

}


/* =========================================================
   FILE INPUT
========================================================= */

async function handleFileInput(
    event
) {

    const input =
        event?.target ||
        elements?.fileInput ||
        document.getElementById(
            "metadata-file-input"
        );


    const files =
        Array.from(
            input?.files || []
        );


    if (
        files.length === 0
    ) {

        return;

    }


    const file =
        files[0];


    console.info(
        "[GEN-Z.AI][EVENTS] File input:",
        {
            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    /*
       Jangan disable CHECK di sini.

       metadata-file.js / processSelectedFile()
       bertanggung jawab memproses file.
    */

    try {

        if (
            typeof currentCallbacks
                ?.handleFileInputProcess ===
            "function"
        ) {

            await currentCallbacks
                .handleFileInputProcess(
                    file
                );

        }

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] File processing gagal:",
            error
        );

    }


    /*
       Pastikan CHECK aktif setelah file
       benar-benar masuk ke state.
    */

    setTimeout(
        function () {

            const stateFile =
                window
                    ?.GENZMetadataCleaner
                    ?.state
                    ?.file;


            /*
               Jika API state tidak diekspos,
               cukup lihat input file.
            */

            if (
                stateFile ||
                elements?.fileInput?.files?.length
            ) {

                enableCheckButton();

            }

        },
        50
    );

}


/* =========================================================
   OPEN FILE PICKER
========================================================= */

function handleOpenFilePicker(
    event
) {

    event?.preventDefault();


    const callback =
        currentCallbacks
            ?.openFilePicker;


    if (
        typeof callback ===
        "function"
    ) {

        callback();

    }

}


/* =========================================================
   CHANGE BUTTON
========================================================= */

function handleChangeFile(
    event
) {

    event?.preventDefault();


    /*
       Klik GANTI harus membuka file picker,
       bukan mengubah state secara manual.
    */

    if (
        typeof currentCallbacks
            ?.openFilePicker ===
        "function"
    ) {

        currentCallbacks
            .openFilePicker();

    }

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const callback =
        currentCallbacks
            ?.handleDragOver;


    if (
        typeof callback ===
        "function"
    ) {

        callback(
            event
        );

    }

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const callback =
        currentCallbacks
            ?.handleDragLeave;


    if (
        typeof callback ===
        "function"
    ) {

        callback(
            event
        );

    }

}


/* =========================================================
   DROP
========================================================= */

async function handleDrop(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const callback =
        currentCallbacks
            ?.handleDrop;


    if (
        typeof callback ===
        "function"
    ) {

        await callback(
            event
        );

    }


    /*
       Pastikan CHECK tidak terkunci setelah DROP.
    */

    setTimeout(
        function () {

            enableCheckButton();

        },
        100
    );

}


/* =========================================================
   CHECK CLICK
========================================================= */

async function handleCheckClick(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const button =
        elements?.checkButton ||
        document.getElementById(
            "metadata-check-button"
        );


    if (
        !button
    ) {

        return;

    }


    /*
       Jika browser menganggap disabled,
       jangan paksa event berjalan dari sini.
       Ini biasanya berarti state file belum masuk.
    */

    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI][EVENTS] CHECK diklik tetapi button masih disabled."
        );


        return;

    }


    console.info(
        "[GEN-Z.AI][EVENTS] CHECK button clicked."
    );


    const callback =
        currentCallbacks
            ?.checkMetadata;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] checkMetadata callback tidak tersedia."
        );


        return;

    }


    /*
       Lock hanya selama CHECK berjalan.
    */

    button.disabled =
        true;


    button.setAttribute(
        "aria-busy",
        "true"
    );


    try {

        console.info(
            "[GEN-Z.AI][EVENTS] CHECK → checkMetadata()"
        );


        await callback();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] CHECK gagal:",
            error
        );

    } finally {

        button.removeAttribute(
            "aria-busy"
        );


        /*
           Jangan otomatis enable jika tidak ada file.
        */

        const hasFile =
            elements?.fileInput
                ?.files
                ?.length > 0;


        if (
            hasFile
        ) {

            button.disabled =
                false;


            button.removeAttribute(
                "disabled"
            );


            button.setAttribute(
                "aria-disabled",
                "false"
            );

        }

    }

}


/* =========================================================
   CLEAN CLICK
========================================================= */

async function handleCleanClick(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const button =
        elements?.cleanButton ||
        document.getElementById(
            "metadata-clean-button"
        );


    if (
        !button
    ) {

        return;

    }


    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI][EVENTS] CLEAN diklik tetapi button masih disabled."
        );


        return;

    }


    console.info(
        "[GEN-Z.AI][EVENTS] CLEAN button clicked."
    );


    const callback =
        currentCallbacks
            ?.cleanMetadata;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] cleanMetadata callback tidak tersedia."
        );


        return;

    }


    try {

        console.info(
            "[GEN-Z.AI][EVENTS] CLEAN → cleanMetadata()"
        );


        await callback();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] CLEAN gagal:",
            error
        );

    }

}


/* =========================================================
   DOWNLOAD CLICK
========================================================= */

async function handleDownloadClick(
    event
) {

    event.preventDefault();


    event.stopPropagation();


    const button =
        elements?.downloadButton ||
        document.getElementById(
            "metadata-download-button"
        );


    if (
        !button
    ) {

        return;

    }


    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI][EVENTS] DOWNLOAD masih disabled."
        );


        return;

    }


    const callback =
        currentCallbacks
            ?.downloadCleanedFile;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] downloadCleanedFile callback tidak tersedia."
        );


        return;

    }


    try {

        await callback();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][EVENTS] DOWNLOAD gagal:",
            error
        );

    }

}


/* =========================================================
   DROPZONE KEYBOARD
========================================================= */

function handleDropzoneKeydown(
    event
) {

    if (
        event.key !== "Enter" &&
        event.key !== " "
    ) {

        return;

    }


    event.preventDefault();


    handleOpenFilePicker(
        event
    );

}


/* =========================================================
   BIND EVENTS
========================================================= */

export function bindMetadataEvents(
    callbacks = {}
) {

    currentCallbacks =
        callbacks;


    const fileInput =
        elements?.fileInput ||
        document.getElementById(
            "metadata-file-input"
        );


    const dropzone =
        elements?.dropzone ||
        document.getElementById(
            "metadata-dropzone"
        );


    const changeButton =
        elements?.changeButton ||
        document.getElementById(
            "metadata-change-button"
        );


    const checkButton =
        elements?.checkButton ||
        document.getElementById(
            "metadata-check-button"
        );


    const cleanButton =
        elements?.cleanButton ||
        document.getElementById(
            "metadata-clean-button"
        );


    const downloadButton =
        elements?.downloadButton ||
        document.getElementById(
            "metadata-download-button"
        );


    /*
       FILE INPUT
    */

    if (
        fileInput
    ) {

        fileInput.addEventListener(
            "change",
            handleFileInput
        );

    }


    /*
       DROPZONE
    */

    if (
        dropzone
    ) {

        dropzone.addEventListener(
            "click",
            handleOpenFilePicker
        );


        dropzone.addEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        dropzone.addEventListener(
            "dragover",
            handleDragOver
        );


        dropzone.addEventListener(
            "dragleave",
            handleDragLeave
        );


        dropzone.addEventListener(
            "drop",
            handleDrop
        );

    }


    /*
       CHANGE FILE
    */

    if (
        changeButton
    ) {

        changeButton.addEventListener(
            "click",
            handleChangeFile
        );

    }


    /*
       CHECK
    */

    if (
        checkButton
    ) {

        checkButton.addEventListener(
            "click",
            handleCheckClick
        );

    }


    /*
       CLEAN
    */

    if (
        cleanButton
    ) {

        cleanButton.addEventListener(
            "click",
            handleCleanClick
        );

    }


    /*
       DOWNLOAD
    */

    if (
        downloadButton
    ) {

        downloadButton.addEventListener(
            "click",
            handleDownloadClick
        );

    }


    /*
       Jangan enable CHECK saat halaman baru dibuka.
    */

    disableCheckButton();


    console.info(
        "[GEN-Z.AI][EVENTS] Metadata events bound."
    );

}


/* =========================================================
   PUBLIC HELPER
========================================================= */

export {
    enableCheckButton,
    disableCheckButton
};
