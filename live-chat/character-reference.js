export function buildCharacterReferenceParts(referenceImage) {
    if (!referenceImage) return [];

    return [
        {
            type: "text",
            text: "Foto berikut adalah REFERENSI KARAKTER BARU, bukan frame dari video. Analisis penampilan yang terlihat dan gunakan sebagai identitas karakter pengganti."
        },
        {
            type: "image_url",
            image_url: { url: referenceImage.dataUrl }
        }
    ];
}

export function buildCharacterReplacementInstruction({
    description = "",
    hasReferenceImage = false
} = {}) {
    const characterDescription = description.trim();
    const references = [];
    if (hasReferenceImage) {
        references.push("analisis foto referensi karakter yang dilampirkan dan gunakan ciri visual yang benar-benar terlihat, seperti wajah, rambut, warna kulit, bentuk tubuh, pakaian, dan aksesori, sebagai identitas karakter baru");
    }
    if (characterDescription) {
        references.push(`gunakan juga deskripsi karakter ini: "${characterDescription}"`);
    }

    const identitySource = references.length
        ? `${references.join("; ")}. Jika foto dan deskripsi berbeda, prioritaskan ciri visual foto kecuali deskripsi menyatakan perubahan secara eksplisit`
        : "rancang karakter baru yang sesuai dengan suasana dan aksi adegan";

    return `GANTI KARAKTER: ${identitySource}. Ganti hanya identitas/penampilan karakter utama; pertahankan lokasi/lingkungan, aksi dan timing, blocking, kamera, komposisi, pencahayaan, warna, suasana, dan urutan adegan dari video sumber. Sesuaikan gerak tubuh agar masuk akal bagi karakter baru.`;
}
