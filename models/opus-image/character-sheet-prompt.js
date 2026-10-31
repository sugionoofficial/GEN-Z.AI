/* =========================================================
   GEN-Z.AI
   MASTER CHARACTER SHEET PROMPT BUILDER
   ---------------------------------------------------------
   File:
     models/opus-image/character-sheet-prompt.js

   Prompt master sistem terkunci untuk sub-mode
   "Generate Karakter Sheet" pada Generate Gambar:
   - Mempertahankan identitas wajah, proporsi tubuh, warna kulit,
     dan gaya rambut dari Foto Karakter Utama (@image1) 100%.
   - Bila Foto Outfit (@image2) disertakan, menerapkan pakaian
     dari @image2 secara konsisten di seluruh sudut pandang.
   - Menghasilkan turnaround full-body 4 sudut (depan, 3/4,
     samping, belakang) + panel close-up ekspresi wajah dalam
     satu lembar referensi studio bersih tanpa teks/watermark.
========================================================= */

export const IMAGE_MODE_STANDARD = "standard";
export const IMAGE_MODE_CHARACTER_SHEET = "character_sheet";
export const CHARACTER_SHEET_DEFAULT_RATIO = "16:9";
export const MAX_CHARACTER_NOTES_LENGTH = 1000;

export function normalizeImageSubMode(rawMode) {
    const token = String(rawMode || "")
        .trim()
        .toLowerCase();

    if (
        token === IMAGE_MODE_CHARACTER_SHEET ||
        token === "charactersheet" ||
        token === "character-sheet" ||
        token === "karakter_sheet" ||
        token === "karakter-sheet"
    ) {
        return IMAGE_MODE_CHARACTER_SHEET;
    }

    return IMAGE_MODE_STANDARD;
}

export function buildCharacterSheetPrompt({
    hasOutfitImage = false,
    extraNotes = ""
} = {}) {
    const cleanNotes = String(extraNotes || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_CHARACTER_NOTES_LENGTH);

    const identityInstruction =
        "Create a professional, ultra-clean studio Character Design Reference Sheet (Turnaround & Expression Sheet) of the exact character shown in @image1. " +
        "Preserve 100% identical facial identity, bone structure, eyes, nose, lips, skin tone, hair color, hairstyle silhouette, age, and body proportions from @image1 across every single view.";

    const outfitInstruction = hasOutfitImage
        ? "OUTFIT REPLACEMENT & CONTINUITY: Dress the character from @image1 in the exact outfit, garment design, silhouette, fabric texture, colors, layering, accessories, and footwear shown in @image2. " +
          "Completely replace the original clothing from @image1 with the outfit from @image2, keeping every seam, pattern, collar, sleeve, trouser/skirt cut, and shoe detail 100% consistent across front, 3/4, side, back, and close-up views."
        : "OUTFIT CONTINUITY: Keep the exact outfit, garment silhouette, fabric texture, colors, layering, and footwear worn by the character in @image1 strictly consistent across front, 3/4, side, back, and close-up views.";

    const layoutInstruction =
        "SHEET COMPOSITION & LAYOUT: " +
        "(1) Left-to-center main section: 4 aligned full-body standing turnaround views side-by-side at identical head-to-toe scale on a flat studio ground line — Front view, 3/4 front-angle view, strict 90-degree Side profile view, and full Back view, in a relaxed neutral anatomical turnaround pose with hands clearly visible and feet fully shown (never cropped). " +
        "(2) Right section: 3 clean head-and-shoulders close-up expression portraits of the same character (neutral calm expression, natural warm smile, and focused/confident 3/4 expression) with crisp eye and facial detail. " +
        "LIGHTING & BACKGROUND: Even, shadow-free neutral light-gray studio backdrop, sharp focus, balanced studio key lighting, zero motion blur, and strictly NO text, NO typography, NO labels, NO watermarks, NO grid lines, and NO extra background props.";

    const parts = [identityInstruction, outfitInstruction, layoutInstruction];

    if (cleanNotes) {
        parts.push(`ADDITIONAL USER DETAILS: ${cleanNotes}`);
    }

    return parts.join(" ");
}

export function buildCharacterSheetHistorySummary({
    hasOutfitImage = false,
    extraNotes = ""
} = {}) {
    const cleanNotes = String(extraNotes || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);

    const baseLabel = hasOutfitImage
        ? "[Karakter Sheet + Custom Outfit]"
        : "[Karakter Sheet]";

    return cleanNotes
        ? `${baseLabel} ${cleanNotes}`
        : `${baseLabel} Turnaround Full-Body (Depan, 3/4, Samping, Belakang) & Close-up Wajah`;
}
