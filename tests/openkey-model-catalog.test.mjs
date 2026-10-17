import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const source = await fs.readFile(
    new URL("../provider/openkey/models.js", import.meta.url),
    "utf8"
);

async function importModelsWithClient(client) {
    const clientModule = `export default globalThis.__openKeyModelsTestClient;\n// ${Math.random()}`;
    const sourceWithStubbedClient = source.replace(
        /import openKeyClient\s+from "\.\/client\.js";/,
        `import openKeyClient from "data:text/javascript,${encodeURIComponent(clientModule)}";`
    );
    globalThis.__openKeyModelsTestClient = client;
    try {
        return await import(`data:text/javascript,${encodeURIComponent(sourceWithStubbedClient)}#${Math.random()}`);
    } finally {
        delete globalThis.__openKeyModelsTestClient;
    }
}

test("loads the authenticated catalog directly without waiting for public metadata lookups", async () => {
    const calls = [];
    const module = await importModelsWithClient({
        async listModels(apiKey) {
            calls.push(apiKey);
            return {
                data: [
                    { id: "z-model", name: "Zulu" },
                    { id: "a-model", name: "Alpha" }
                ]
            };
        }
    });

    const models = await module.default.loadAuthenticatedModels({ apiKey: "test-api-key" });

    assert.deepEqual(calls, ["test-api-key"]);
    assert.deepEqual(models.map(model => model.model_id), ["a-model", "z-model"]);
});

test("fails explicitly when the authenticated catalog contains no models", async () => {
    const module = await importModelsWithClient({
        async listModels() {
            return { data: [] };
        }
    });

    await assert.rejects(
        module.default.loadAuthenticatedModels(),
        /OpenKey tidak mengembalikan daftar model/
    );
});
