export function buildMediaAnalysisInstructions({
    mediaAttachments,
    outputMode,
    replaceCharacter = false,
    replacementDescription = "",
    hasCharacterReference = false
}) {
    if (!mediaAttachments.length) return null;

    const videoAttachments = mediaAttachments.filter(attachment => attachment.kind === "video");
    const imageAttachments = mediaAttachments.filter(attachment => attachment.kind === "image");
    const hasVideo = videoAttachments.length > 0;
    const hasImage = imageAttachments.length > 0;
    const replacement = replaceCharacter
        ? [
            "GANTI KARAKTER: gunakan foto referensi karakter yang dilampirkan dan/atau deskripsi karakter baru untuk mengganti hanya identitas dan penampilan karakter utama.",
            "Pertahankan adegan, lokasi/lingkungan, komposisi, framing, sudut kamera, pencahayaan, warna, suasana, serta aksi dan pose sumber sejauh mungkin.",
            "Jika tidak ada foto atau deskripsi referensi, rancang karakter baru yang sesuai.",
            hasCharacterReference
                ? "Gunakan ciri visual yang benar-benar tampak pada foto referensi karakter; foto ini adalah referensi identitas, bukan sumber adegan."
                : "",
            replacementDescription.trim()
                ? `Deskripsi karakter baru: "${replacementDescription.trim()}".`
                : ""
        ].filter(Boolean).join(" ")
        : "Pertahankan karakter/objek utama dan penampilannya dari media sumber; jangan menggantinya.";

    const modeInstructions = {
        analysis: "Berikan analisis visual terperinci saja; jangan keluarkan prompt final.",
        video: hasVideo
            ? "Berikan analisis terperinci dan satu prompt video final."
            : "Berikan analisis terperinci dan satu prompt video final untuk menghidupkan gambar sumber sebagai video, tanpa mengubah identitas karakter atau adegan.",
        image: "Berikan analisis terperinci dan satu prompt gambar final yang menggambarkan satu komposisi/frame representatif.",
        both: hasVideo
            ? "Berikan analisis terperinci, satu prompt video final, dan satu prompt gambar final."
            : "Berikan analisis terperinci, satu prompt gambar final, dan satu prompt video final untuk menghidupkan gambar sumber."
    };

    const instructions = [
        hasVideo && hasImage
            ? "ANALISIS FOTO DAN VIDEO TERPERINCI:"
            : hasVideo
                ? "ANALISIS VIDEO TERPERINCI:"
                : "ANALISIS FOTO TERPERINCI:",
        hasVideo
            ? "Video dilampirkan sebagai rangkaian cuplikan bertimestamp, satu cuplikan per detik, maksimal 30 detik. Analisis hanya hal yang tampak; cuplikan tidak menunjukkan setiap frame, jadi jangan mengarang gerakan yang tidak terlihat dan nyatakan ketidakpastian."
            : "Analisis hanya hal yang benar-benar tampak pada foto; jangan mengarang detail yang tidak terlihat dan nyatakan ketidakpastian.",
        hasImage
            ? "Untuk setiap foto sumber, jelaskan subjek dan ciri visual, pose/gestur yang tampak, pakaian/objek, latar/lokasi yang terlihat, komposisi, framing, sudut kamera, fokus, pencahayaan, warna, suasana, dan detail visual penting."
            : "",
        hasVideo
            ? "Susun analisis video dengan ringkasan durasi, tabel kronologis per detik berisi aksi/gerakan karakter dan objek, perubahan posisi/blocking, lingkungan, framing, sudut dan gerak kamera, fokus, pencahayaan, transisi, serta kontinuitas."
            : "",
        "Jelaskan lokasi sebagai lingkungan yang terlihat (mis. interior/eksterior, jenis ruang, objek, latar, kondisi sekitar); jangan menebak nama tempat atau lokasi geografis tanpa bukti visual.",
        replacement,
        modeInstructions[outputMode] || modeInstructions.both,
        "Jika diminta prompt final, tulis prompt yang langsung dapat ditempel ke generator. Pisahkan prompt dari analisis dan satu sama lain menggunakan tepat penanda berikut (jangan bungkus dengan code fence):",
        "<<<VIDEO_PROMPT_FINAL>>>prompt video final saja<<</VIDEO_PROMPT_FINAL>>>",
        "<<<IMAGE_PROMPT_FINAL>>>prompt gambar final saja<<</IMAGE_PROMPT_FINAL>>>",
        "Keluarkan hanya penanda prompt yang diminta. Isi setiap penanda harus berupa prompt bersih tanpa judul, bullet, label, atau komentar. Prompt gambar menggambarkan satu frame, bukan urutan video.",
        hasVideo
            ? `Video sumber: ${videoAttachments.map(video => `${video.name} (${video.duration.toFixed(1)} detik, ${video.frames.length} cuplikan bertimestamp)`).join("; ")}.`
            : `Foto sumber: ${imageAttachments.map(image => image.name).join("; ")}.`
    ];

    return {
        role: "system",
        content: instructions.filter(Boolean).join("\n\n")
    };
}
