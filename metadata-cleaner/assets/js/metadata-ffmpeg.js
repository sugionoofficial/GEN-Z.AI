/* =========================================================
   PUBLIC:
   SAFE DELETE FFMPEG FILE
   ---------------------------------------------------------
   Mendukung dua pola pemanggilan:

   1. safeDeleteFFmpegFile(filename)

   2. safeDeleteFFmpegFile(ffmpeg, filename)

   Penting:
   - Jangan pernah mengirim object FFmpeg sebagai path.
   - FFmpeg instance harus tetap berada di sisi JS.
   - Yang dikirim ke Worker hanya string filename.
========================================================= */

export async function safeDeleteFFmpegFile(
    firstArgument,
    secondArgument
) {

    let ffmpeg =
        null;

    let filename =
        "";


    /* =====================================================
       DETEKSI ARGUMEN
    ===================================================== */

    /*
       Pola:
       safeDeleteFFmpegFile(ffmpeg, filename)
    */

    if (
        firstArgument &&
        typeof firstArgument === "object" &&
        typeof firstArgument.deleteFile === "function"
    ) {

        ffmpeg =
            firstArgument;

        filename =
            secondArgument || "";

    }

    /*
       Pola:
       safeDeleteFFmpegFile(filename)
    */

    else {

        filename =
            firstArgument || "";

    }


    /* =====================================================
       VALIDASI FILENAME
    ===================================================== */

    if (
        typeof filename !== "string"
    ) {

        console.warn(
            "[GEN-Z.AI][FFmpeg] safeDeleteFFmpegFile: invalid filename.",
            filename
        );

        return false;

    }


    filename =
        filename.trim();


    if (
        !filename
    ) {

        return false;

    }


    /*
       Proteksi tambahan:
       jangan pernah mengizinkan object,
       function, FFmpeg instance, Blob, File,
       atau nilai kompleks masuk ke deleteFile().
    */

    if (
        typeof filename !== "string"
    ) {

        return false;

    }


    /* =====================================================
       RESOLVE FFMPEG INSTANCE
    ===================================================== */

    if (
        !ffmpeg
    ) {

        try {

            ffmpeg =
                await ensureFFmpeg();

        }
        catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][FFmpeg] Unable to initialize FFmpeg for cleanup:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       VALIDATE FFMPEG INSTANCE
    ===================================================== */

    if (
        !ffmpeg ||
        typeof ffmpeg.deleteFile !== "function"
    ) {

        console.warn(
            "[GEN-Z.AI][FFmpeg] Invalid FFmpeg instance during cleanup."
        );

        return false;

    }


    /* =====================================================
       DELETE FILE
    ===================================================== */

    try {

        await ffmpeg.deleteFile(
            filename
        );


        console.log(
            "[GEN-Z.AI][FFmpeg] Temporary file deleted:",
            filename
        );


        return true;

    }
    catch (
        error
    ) {

        /*
           File mungkin memang sudah tidak ada.

           Cleanup tidak boleh membuat proses utama
           metadata gagal hanya karena file sementara
           gagal dihapus.
        */

        const message =
            getErrorMessage(
                error
            );


        console.warn(
            "[GEN-Z.AI][FFmpeg] Unable to delete file:",
            filename,
            message
        );


        return false;

    }

}
