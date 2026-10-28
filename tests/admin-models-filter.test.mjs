import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const pageSearchSource = readFileSync(
    new URL("../admin-control/models/functions/model-page-search.js", import.meta.url),
    "utf8"
);
const modelsHtmlSource = readFileSync(
    new URL("../admin-control/models.html", import.meta.url),
    "utf8"
);
const modelsUiSource = readFileSync(
    new URL("../admin-control/models/models-ui.js", import.meta.url),
    "utf8"
);

class MockOption {
    constructor(value = "", textContent = "") {
        this.value = value;
        this.textContent = textContent;
        this.dataset = {};
    }
}

class MockFragment {
    constructor() {
        this.children = [];
    }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
}

class MockElement {
    constructor(id, tagName = "div") {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.value = "";
        this.options = [];
        this.dataset = {};
        this.listeners = new Map();
    }

    addEventListener(type, fn) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(fn);
    }

    removeEventListener(type, fn) {
        this.listeners.get(type)?.delete(fn);
    }

    dispatchEvent(event) {
        const set = this.listeners.get(event.type);
        if (!set) return;
        for (const fn of set) {
            fn.call(this, event);
        }
    }

    appendChild(child) {
        if (child instanceof MockFragment) {
            this.options.push(...child.children);
        } else {
            this.options.push(child);
        }
        if (!this.value && this.options.length > 0) {
            this.value = this.options[0].value;
        }
        return child;
    }

    replaceChildren(fragment) {
        this.options = [];
        this.appendChild(fragment);
    }
}

function createHarness() {
    const searchInput = new MockElement("modelSearch", "input");
    const statusSelect = new MockElement("modelStatusFilter", "select");
    statusSelect.options = [
        new MockOption("all", "Semua Status"),
        new MockOption("active", "Aktif"),
        new MockOption("inactive", "Nonaktif")
    ];
    statusSelect.value = "all";

    const providerSelect = new MockElement("modelProviderFilter", "select");
    providerSelect.options = [new MockOption("all", "Semua Provider")];
    providerSelect.value = "all";

    const elementsById = new Map([
        ["modelSearch", searchInput],
        ["modelStatusFilter", statusSelect],
        ["modelProviderFilter", providerSelect]
    ]);

    let renderedModels = [];
    let renderCalls = 0;

    const table = {
        setModels(list) {
            renderedModels = Array.isArray(list) ? [...list] : [];
        },
        render() {
            renderCalls += 1;
        }
    };

    const document = {
        getElementById(id) {
            return elementsById.get(id) || null;
        },
        createElement(tag) {
            if (String(tag).toLowerCase() === "option") {
                return new MockOption();
            }
            return new MockElement("", tag);
        },
        createDocumentFragment() {
            return new MockFragment();
        }
    };

    const windowObj = {
        document,
        GENZModelTable: table,
        GENZModelsTable: table,
        console
    };

    const context = vm.createContext({
        window: windowObj,
        document,
        console
    });

    vm.runInContext(pageSearchSource, context);

    return {
        pageSearch: windowObj.GENZModelsPageSearch,
        windowObj,
        searchInput,
        statusSelect,
        providerSelect,
        getRenderedModels: () => [...renderedModels],
        getRenderCalls: () => renderCalls
    };
}

const SAMPLE_PROVIDERS = [
    {
        id: "11111111-1111-4111-8111-111111111111",
        provider_id: "kie",
        provider_name: "GEN-Z.AI",
        status: "active"
    },
    {
        id: "22222222-2222-4222-8222-222222222222",
        provider_id: "motiongen",
        provider_name: "GEN-Z.AI",
        status: "active"
    },
    {
        id: "33333333-3333-4333-8333-333333333333",
        provider_id: "openkey",
        provider_name: "OpenKey",
        status: "active"
    },
    {
        id: "44444444-4444-4444-8444-444444444444",
        provider_id: "qwencloud",
        provider_name: "QwenCloud",
        status: "active"
    },
    {
        id: "55555555-5555-4555-8555-555555555555",
        provider_id: "opus",
        provider_name: "Opus",
        status: "active"
    }
];

const SAMPLE_MODELS = [
    {
        id: "aaaa1111-1111-4111-8111-111111111111",
        model_id: "kie-veo-3",
        model_name: "Veo 3 Fast",
        provider_id: "11111111-1111-4111-8111-111111111111",
        provider_code: "kie",
        provider_name: "GEN-Z.AI",
        status: "active"
    },
    {
        id: "aaaa2222-2222-4222-8222-222222222222",
        model_id: "motiongen-wan-26",
        model_name: "Wan 2.6 Studio",
        provider_id: "22222222-2222-4222-8222-222222222222",
        provider_code: "motiongen",
        provider_name: "GEN-Z.AI",
        status: "inactive"
    },
    {
        id: "aaaa3333-3333-4333-8333-333333333333",
        model_id: "qwen-wan26-t2v",
        model_name: "Qwen Wan 2.6 T2V",
        provider_id: "44444444-4444-4444-8444-444444444444",
        provider_code: "qwencloud",
        provider_name: "QwenCloud",
        status: "active"
    },
    {
        id: "aaaa4444-4444-4444-8444-444444444444",
        model_id: "opus-seedance-2.5-t2v",
        model_name: "Opus Seedance 2.5 T2V",
        provider_id: "55555555-5555-4555-8555-555555555555",
        provider_code: "opus",
        provider_name: "Opus",
        status: "active"
    },
    {
        id: "aaaa5555-5555-4555-8555-555555555555",
        model_id: "opus-hailuo-3-i2v",
        model_name: "Opus Hailuo 3 I2V",
        provider_id: "55555555-5555-4555-8555-555555555555",
        provider_code: "opus",
        provider_name: "Opus",
        status: "inactive"
    }
];

test("Admin Models toolbar mengisi daftar provider (termasuk disambiguasi nama kembar) dan memfilter status + provider + keyword", () => {
    const {
        pageSearch,
        searchInput,
        statusSelect,
        providerSelect,
        getRenderedModels
    } = createHarness();

    assert.ok(pageSearch, "GENZModelsPageSearch harus diekspos ke window");

    pageSearch.initialize();
    pageSearch.setProviders(SAMPLE_PROVIDERS);
    pageSearch.setModels(SAMPLE_MODELS);

    // 1. Opsi dropdown provider terisi otomatis & mendisambiguasi nama kembar GEN-Z.AI
    const optionPairs = providerSelect.options.map((opt) => ({
        value: opt.value,
        label: opt.textContent
    }));
    assert.deepEqual(optionPairs, [
        { value: "all", label: "Semua Provider" },
        { value: "kie", label: "GEN-Z.AI (kie)" },
        { value: "motiongen", label: "GEN-Z.AI (motiongen)" },
        { value: "openkey", label: "OpenKey" },
        { value: "opus", label: "Opus" },
        { value: "qwencloud", label: "QwenCloud" }
    ]);

    // Default "all" menampilkan seluruh 5 model
    assert.equal(getRenderedModels().length, 5);

    // 2. Filter Status = active (3 model aktif)
    statusSelect.value = "active";
    statusSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["kie-veo-3", "qwen-wan26-t2v", "opus-seedance-2.5-t2v"]
    );

    // 3. Filter Status = inactive (2 model nonaktif)
    statusSelect.value = "inactive";
    statusSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["motiongen-wan-26", "opus-hailuo-3-i2v"]
    );

    // 4. Kembalikan Status = all, lalu pilih Provider = opus (2 model Opus)
    statusSelect.value = "all";
    statusSelect.dispatchEvent({ type: "change" });
    providerSelect.value = "opus";
    providerSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["opus-seedance-2.5-t2v", "opus-hailuo-3-i2v"]
    );

    // 5. Kombinasi Provider = opus + Status = active (hanya 1 model Opus aktif)
    statusSelect.value = "active";
    statusSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["opus-seedance-2.5-t2v"]
    );

    // 6. Disambiguasi GEN-Z.AI (kie) vs GEN-Z.AI (motiongen) tidak saling bocor
    statusSelect.value = "all";
    statusSelect.dispatchEvent({ type: "change" });
    providerSelect.value = "kie";
    providerSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["kie-veo-3"]
    );

    providerSelect.value = "motiongen";
    providerSelect.dispatchEvent({ type: "change" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["motiongen-wan-26"]
    );

    // 7. Saat katalog di-refresh (setModels dipanggil ulang), pilihan filter tetap dipertahankan
    pageSearch.setModels([
        ...SAMPLE_MODELS,
        {
            id: "aaaa6666-6666-4666-8666-666666666666",
            model_id: "motiongen-seedance-2",
            model_name: "MotionGen Seedance 2",
            provider_id: "22222222-2222-4222-8222-222222222222",
            provider_code: "motiongen",
            provider_name: "GEN-Z.AI",
            status: "active"
        }
    ]);
    assert.equal(providerSelect.value, "motiongen");
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["motiongen-wan-26", "motiongen-seedance-2"]
    );

    // 8. Search keyword dikombinasikan dengan filter provider
    searchInput.value = "seedance";
    searchInput.dispatchEvent({ type: "input" });
    assert.deepEqual(
        getRenderedModels().map((m) => m.model_id),
        ["motiongen-seedance-2"]
    );

    // 9. Clear mereset semua filter ke "all" dan mengembalikan seluruh katalog (6 model)
    pageSearch.clear();
    assert.equal(searchInput.value, "");
    assert.equal(statusSelect.value, "all");
    assert.equal(providerSelect.value, "all");
    assert.equal(getRenderedModels().length, 6);
});

test("models.html dan models-ui.js tidak menimpa hasil filter dengan syncTableState mentah", () => {
    assert.match(
        modelsHtmlSource,
        /id="modelStatusFilter"/,
        "models.html harus memiliki select #modelStatusFilter"
    );
    assert.match(
        modelsHtmlSource,
        /id="modelProviderFilter"/,
        "models.html harus memiliki select #modelProviderFilter"
    );
    assert.match(
        modelsHtmlSource,
        /pageSearch\.setModels\(\s*list\s*\)/,
        "applyModels() di models.html harus menyalurkan model melalui GENZModelsPageSearch"
    );

    const loadModelsBlock = modelsUiSource.slice(
        modelsUiSource.indexOf("async function loadModels"),
        modelsUiSource.indexOf("async function refreshModels")
    );
    const tableIdx = loadModelsBlock.indexOf("syncTableState()");
    const pageSearchIdx = loadModelsBlock.indexOf("syncPageSearchState()");
    assert.ok(
        tableIdx !== -1 && pageSearchIdx !== -1 && tableIdx < pageSearchIdx,
        "loadModels() di models-ui.js harus menjalankan syncTableState() sebelum syncPageSearchState() agar filter aktif tidak tertimpa"
    );
});
