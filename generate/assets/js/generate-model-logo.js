/**
 * GEN-Z.AI
 * Generate Model Logo
 *
 * Tugas:
 * - Menampilkan logo model di dalam blok MODEL ENGINE.
 * - Tidak mengubah logic pemilihan model.
 * - Tidak mengubah model state.
 * - Tidak mengubah pricing.
 * - Logo menggunakan asset lokal.
 *
 * Struktur asset:
 * generate/assets/models/
 *
 * Contoh:
 * generate/assets/models/grok.svg
 * generate/assets/models/kling.svg
 * generate/assets/models/seedance.svg
 * generate/assets/models/default.svg
 */

const LOGO_BASE_PATH = "./assets/models/";

const MODEL_LOGOS = {
    grok: "grok.svg",
    kling: "kling.svg",
    seedance: "seedance.svg",
    seed: "seedance.svg",
    seedream: "seedream.svg"
};

function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\\/g, "/");
}

function resolveLogoFile(model = {}) {
    const modelId = normalize(
        model.model_id ||
        model.id ||
        ""
    );

    const modelName = normalize(
        model.model_name ||
        model.name ||
        ""
    );

    const combined = `${modelId} ${modelName}`;

    if (
        combined.includes("grok") ||
        combined.includes("xai") ||
        combined.includes("x-ai")
    ) {
        return MODEL_LOGOS.grok;
    }

    if (
        combined.includes("kling") ||
        combined.includes("klingai")
    ) {
        return MODEL_LOGOS.kling;
    }

    if (
        combined.includes("seedance")
    ) {
        return MODEL_LOGOS.seedance;
    }

    if (
        combined.includes("seedream")
    ) {
        return MODEL_LOGOS.seedream;
    }

    return "default.svg";
}

function createLogoElement(model = {}) {
    const wrapper = document.createElement("div");

    wrapper.className = "generate-model-logo";

    wrapper.setAttribute(
        "aria-hidden",
        "true"
    );

    const image = document.createElement("img");

    image.className = "generate-model-logo-image";

    image.alt = "";

    image.decoding = "async";

    image.loading = "eager";

    const logoFile = resolveLogoFile(model);

    image.src = `${LOGO_BASE_PATH}${logoFile}`;

    image.onerror = () => {
        if (image.dataset.fallbackApplied === "true") {
            return;
        }

        image.dataset.fallbackApplied = "true";

        image.src =
            `${LOGO_BASE_PATH}default.svg`;
    };

    wrapper.appendChild(image);

    return wrapper;
}

function getPreviewElement() {
    return document.getElementById(
        "selectedModelLogo"
    );
}

function clearModelLogo() {
    const container = getPreviewElement();

    if (!container) {
        return;
    }

    container.innerHTML = "";
    container.hidden = true;
}

export function updateModelLogo(model = null) {
    const container = getPreviewElement();

    if (!container) {
        return;
    }

    if (!model) {
        clearModelLogo();
        return;
    }

    container.innerHTML = "";

    const logo = createLogoElement(model);

    container.appendChild(logo);

    container.hidden = false;
}

export function getModelLogoFile(model = {}) {
    return resolveLogoFile(model);
}

export function initModelLogo() {
    const container = getPreviewElement();

    if (!container) {
        return false;
    }

    container.hidden = true;

    return true;
}

window.GENZModelLogo = {
    updateModelLogo,
    getModelLogoFile,
    initModelLogo
};
