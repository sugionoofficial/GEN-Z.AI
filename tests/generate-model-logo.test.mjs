import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getModelLogoFile } from "../generate/assets/js/generate-model-logo.js";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

const modelsDir = path.join(root, "models");
const logoDir = path.join(root, "generate", "assets", "models");

/*
 * Semua model di registry dimuat secara dinamis, sehingga model
 * baru ikut ter-cover begitu registry bertambah.
 */
const modelDirs = fs
    .readdirSync(modelsDir)
    .filter((dir) => fs.existsSync(
        path.join(modelsDir, dir, "config.js")
    ));

async function loadModels() {
    const models = [];

    for (const dir of modelDirs) {
        const file = path.join(modelsDir, dir, "config.js");
        const module = await import(pathToFileURL(file).href);
        models.push(module.default);
    }

    return models;
}

const models = await loadModels();

/*
 * Bentuk payload yang dikirim /api/model-config ke frontend.
 */
function asApiPayload(config) {
    return {
        model_id: config.id,
        model_name: config.name,
        provider_id: config.providerId,
        provider_name: config.providerName,
        logo: config.logo
    };
}

/*
 * Bentuk payload dari versi API lama, tanpa field logo.
 * Dipakai untuk menguji fallback LOGO_MAP.
 */
function asLegacyPayload(config) {
    return {
        model_id: config.id,
        model_name: config.name,
        provider_id: config.providerId,
        provider_name: config.providerName
    };
}

test("registry memuat model dan setiap model mendeklarasikan logo", () => {
    assert.ok(models.length > 0, "registry models tidak boleh kosong");

    for (const config of models) {
        assert.ok(
            config.logo,
            `model "${config.id}" tidak mendeklarasikan field logo`
        );
    }
});

test("setiap model memakai logo yang dideklarasikan registry-nya", () => {
    for (const config of models) {
        assert.equal(
            getModelLogoFile(asApiPayload(config)),
            config.logo,
            `model "${config.id}"resolve ke logo yang salah`
        );
    }
});

test("file logo yang dipakai model benar-benar ada", () => {
    for (const config of models) {
        assert.ok(
            fs.existsSync(path.join(logoDir, config.logo)),
            `file logo "${config.logo}" untuk model "${config.id}" tidak ada di generate/assets/models/`
        );
    }
});

test("setiap file logo di folder dipakai oleh minimal satu model", () => {
    const used = new Set(models.map((config) => config.logo));
    const available = fs
        .readdirSync(logoDir)
        .filter((file) => file.endsWith(".svg"));

    for (const file of available) {
        assert.ok(
            used.has(file),
            `file logo "${file}" tidak dipakai model mana pun, sehingga tidak akan pernah tampil`
        );
    }
});

test("model wan memakai logo wan, bukan logo provider", () => {
    const wan = models.find((config) =>
        String(config.id).includes("wan")
    );

    assert.ok(wan, "model wan tidak ditemukan di registry");
    assert.equal(wan.logo, "wan.svg");

    /*
     * Provider "motiongen" dipakai bersama oleh beberapa model.
     * Resolution logo harus menghasilkan wan.svg, bukan minimax.svg.
     */
    assert.equal(
        getModelLogoFile(asApiPayload(wan)),
        "wan.svg"
    );

    assert.equal(
        getModelLogoFile(asLegacyPayload(wan)),
        "wan.svg"
    );
});

test("fallback tanpa field logo tetap memilih logo yang benar", () => {
    /*
     * Model wan dan model digital-human berbagi provider
     * "motiongen". Tanpa pencocokan model, keduanya akan
     * memakai logo provider yang sama.
     */
    const expected = new Map(
        models.map((config) => [config.id, config.logo])
    );

    for (const config of models) {
        assert.equal(
            getModelLogoFile(asLegacyPayload(config)),
            expected.get(config.id),
            `fallback untuk model "${config.id}" salah`
        );
    }
});

test("nama file logo yang berbahaya ditolak", () => {
    const dangerous = [
        "../../etc/passwd",
        "../secret.svg",
        "wan.svg?x=1",
        "sub/dir/logo.svg"
    ];

    for (const logo of dangerous) {
        const resolved = getModelLogoFile({
            model_id: "wan-30-ref-s6",
            provider_id: "motiongen",
            logo
        });

        assert.ok(
            resolved !== logo,
            `nama file berbahaya "${logo}" tidak boleh dipakai langsung`
        );
    }
});
