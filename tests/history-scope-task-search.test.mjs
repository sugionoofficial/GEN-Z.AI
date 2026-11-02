import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: History scope toggle + Task ID search.
 *
 * - Admin/owner boleh memilih riwayat pribadi atau global.
 * - Role user selalu dikunci ke riwayat pribadi.
 * - Pencarian Task ID dilakukan di server (ILIKE) sebelum LIMIT,
 *   bukan hanya menyaring 200 baris yang sudah terunduh.
 * - Respons query lama tidak boleh menimpa scope/pencarian terbaru.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dataSource = readFileSync(
    path.join(root, "history/assets/js/history-data.js"),
    "utf8"
);
const renderSource = readFileSync(
    path.join(root, "history/assets/js/history-render.js"),
    "utf8"
);
const eventsSource = readFileSync(
    path.join(root, "history/assets/js/history-events.js"),
    "utf8"
);
const authSource = readFileSync(
    path.join(root, "history/assets/js/history-auth.js"),
    "utf8"
);
const stateSource = readFileSync(
    path.join(root, "history/assets/js/history-state.js"),
    "utf8"
);
const historyHtml = readFileSync(path.join(root, "history/index.html"), "utf8");
const controlsCss = readFileSync(
    path.join(root, "history/assets/css/history-controls.css"),
    "utf8"
);

function loadDataModule({ role = "USER", rows = [], client } = {}) {
    const windowObj = { GENZHistory: {} };
    const sandbox = {
        window: windowObj,
        console: { warn() {}, log() {}, error() {}, info() {} },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        URL,
        Promise,
        Map,
        Set,
        Math,
        JSON
    };

    vm.createContext(sandbox);
    vm.runInContext(dataSource, sandbox);

    const App = windowObj.GENZHistory;
    App.state.currentUser = { id: "user-123" };
    App.state.currentProfile = { role };
    App.state.supabaseClient = client || makeFakeClient(rows);
    App.elements = {};
    return App;
}

function makeFakeClient(rows = [], { deferred } = {}) {
    const calls = [];

    function makeQuery(table) {
        const call = { table, filters: [], ilike: [], limit: null, order: null };
        calls.push(call);

        const query = {
            select() { return query; },
            order(column, options) {
                call.order = { column, options };
                return query;
            },
            limit(value) {
                call.limit = value;
                return query;
            },
            eq(column, value) {
                call.filters.push({ column, value });
                return query;
            },
            ilike(column, pattern) {
                call.ilike.push({ column, pattern });
                return query;
            },
            then(resolve, reject) {
                const promise = deferred
                    ? deferred.promise
                    : Promise.resolve({ data: rows, error: null });
                return promise.then(resolve, reject);
            }
        };

        return query;
    }

    return {
        calls,
        from(table) {
            return makeQuery(table);
        },
        storage: {
            from() {
                return {
                    async createSignedUrl() {
                        return { data: { signedUrl: "https://signed.example/media" }, error: null };
                    }
                };
            }
        }
    };
}

function makeDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function loadRenderModule(overrides = {}) {
    const windowObj = { GENZHistory: {} };
    const sandbox = {
        window: windowObj,
        document: {
            querySelectorAll: () => [],
            querySelector: () => null,
            getElementById: () => null
        },
        console,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => callback(),
        Number,
        String,
        Math,
        JSON,
        Array,
        Object,
        Date,
        URL
    };

    vm.createContext(sandbox);
    vm.runInContext(renderSource, sandbox);
    Object.assign(windowObj.GENZHistory, overrides);
    return windowObj.GENZHistory;
}

test("scope global hanya untuk admin/owner; user dipaksa ke own", () => {
    const userApp = loadDataModule({ role: "USER" });
    assert.equal(userApp.setHistoryScope("global"), "own");
    assert.equal(userApp.getHistoryScope(), "own");

    const adminApp = loadDataModule({ role: "ADMIN" });
    assert.equal(adminApp.getHistoryScope(), "own");
    assert.equal(adminApp.setHistoryScope("global"), "global");
    assert.equal(adminApp.getHistoryScope(), "global");

    const ownerApp = loadDataModule({ role: "OWNER" });
    assert.equal(ownerApp.setHistoryScope(" GLOBAL "), "global");
    assert.equal(ownerApp.setHistoryScope("unknown"), "own");
});

test("query user selalu memakai user_id walaupun state mencoba global", async () => {
    const client = makeFakeClient([]);
    const App = loadDataModule({ role: "USER", client });
    App.state.historyScope = "global";

    await App.loadHistory({ silent: true });

    assert.equal(client.calls.length, 1);
    assert.deepEqual(client.calls[0].filters, [
        { column: "user_id", value: "user-123" }
    ]);
    assert.equal(client.calls[0].limit, 200);
});

test("admin scope own memfilter user_id, scope global tidak", async () => {
    const ownClient = makeFakeClient([]);
    const ownApp = loadDataModule({ role: "ADMIN", client: ownClient });
    ownApp.setHistoryScope("own");
    await ownApp.loadHistory({ silent: true });
    assert.deepEqual(ownClient.calls[0].filters, [
        { column: "user_id", value: "user-123" }
    ]);

    const globalClient = makeFakeClient([]);
    const globalApp = loadDataModule({ role: "OWNER", client: globalClient });
    globalApp.setHistoryScope("global");
    await globalApp.loadHistory({ silent: true });
    assert.deepEqual(globalClient.calls[0].filters, []);
});

test("pencarian Task ID dikirim sebagai ILIKE ter-escape sebelum limit", async () => {
    const client = makeFakeClient([]);
    const App = loadDataModule({ role: "USER", client });

    App.setTaskIdSearch("  task_100%\\abc  ");
    await App.loadHistory({ silent: true });

    assert.equal(client.calls[0].ilike.length, 1);
    assert.equal(client.calls[0].ilike[0].column, "task_id");
    assert.equal(
        client.calls[0].ilike[0].pattern,
        "%task\\_100\\%\\\\abc%"
    );
    assert.equal(client.calls[0].limit, 200);
    assert.equal(App.getTaskIdSearch(), "task_100%\\abc");
});

test("pencarian kosong tidak mengirim ILIKE dan dibatasi 256 karakter", () => {
    const App = loadDataModule({ role: "USER" });
    assert.equal(App.setTaskIdSearch("   "), "");
    assert.equal(App.normalizeTaskIdSearch("a".repeat(300)).length, 256);
    assert.equal(App.escapeLikePattern("%_\\"), "\\%\\_\\\\");
});

test("respons lama tidak menimpa hasil scope/pencarian terbaru", async () => {
    const first = makeDeferred();
    const second = makeDeferred();
    const responses = [first, second];
    let index = 0;

    const client = {
        calls: [],
        from() {
            const deferred = responses[index++];
            const call = { filters: [], ilike: [] };
            this.calls.push(call);
            const query = {
                select() { return query; },
                order() { return query; },
                limit() { return query; },
                eq(column, value) { call.filters.push({ column, value }); return query; },
                ilike(column, pattern) { call.ilike.push({ column, pattern }); return query; },
                then(resolve, reject) {
                    return deferred.promise.then(resolve, reject);
                }
            };
            return query;
        },
        storage: { from() { return { createSignedUrl: async () => ({ data: null, error: null }) }; } }
    };

    const App = loadDataModule({ role: "ADMIN", client });
    let renders = 0;
    App.renderHistory = () => { renders += 1; };

    App.setHistoryScope("own");
    const firstLoad = App.loadHistory({ silent: true });

    App.setHistoryScope("global");
    App.setTaskIdSearch("task-baru");
    const secondLoad = App.loadHistory({ silent: true });

    second.resolve({ data: [{ id: "new", task_id: "task-baru" }], error: null });
    await secondLoad;

    first.resolve({ data: [{ id: "old", task_id: "task-lama" }], error: null });
    await firstLoad;

    assert.deepEqual(App.state.historyData.map(item => item.id), ["new"]);
    assert.equal(App.state.historyLoadInProgress, false);
    assert.equal(renders, 1);
});

test("filter lokal menggabungkan status dan Task ID secara case-insensitive", () => {
    const App = loadDataModule({ role: "USER" });
    App.state.historyData = [
        { id: "1", task_id: "TASK-ABC", status: "success" },
        { id: "2", task_id: "task-abc-lain", status: "failed" },
        { id: "3", task_id: "lain", status: "success" }
    ];

    App.setCurrentFilter("success");
    App.setTaskIdSearch("task-abc");
    assert.deepEqual(App.getFilteredHistory().map(item => item.id), ["1"]);

    App.setCurrentFilter("all");
    assert.deepEqual(App.getFilteredHistory().map(item => item.id), ["1", "2"]);
});

test("kolom User hanya tampil untuk admin/owner pada scope global", () => {
    const adminGlobal = loadRenderModule({
        isAdminOrOwner: () => true,
        getHistoryScope: () => "global"
    });
    assert.equal(adminGlobal.shouldShowHistoryUserColumn(), true);

    const adminOwn = loadRenderModule({
        isAdminOrOwner: () => true,
        getHistoryScope: () => "own"
    });
    assert.equal(adminOwn.shouldShowHistoryUserColumn(), false);

    const userGlobal = loadRenderModule({
        isAdminOrOwner: () => false,
        getHistoryScope: () => "global"
    });
    assert.equal(userGlobal.shouldShowHistoryUserColumn(), false);

    const html = adminGlobal.getRowHtml(
        { id: "a", task_id: "t", status: "success", user_id: "u" },
        0,
        true
    );
    assert.match(html, /history-row-global/);
    assert.match(html, /history-user-cell/);
});

test("markup History menyediakan kontrol scope tersembunyi + pencarian Task ID", () => {
    assert.match(historyHtml, /id="historyScopeControl"[\s\S]*?hidden/);
    assert.match(historyHtml, /data-history-scope="own"/);
    assert.match(historyHtml, /data-history-scope="global"/);
    assert.match(historyHtml, /id="taskIdSearchForm"/);
    assert.match(historyHtml, /id="taskIdSearchInput"[\s\S]*?type="search"[\s\S]*?maxlength="256"/);
    assert.match(historyHtml, /id="taskIdSearchClear"/);
    assert.match(historyHtml, /id="historySearchMeta"[\s\S]*?role="status"/);
    assert.match(historyHtml, /id="emptyStateTitle"/);
    assert.match(historyHtml, /id="emptyStateDescription"/);
    assert.match(historyHtml, /id="emptyStateGenerateButton"/);
    assert.match(historyHtml, /history-controls\.css\?v=/);
    assert.match(historyHtml, /genz:history-reset-pagination/);
});

test("event scope/search terhubung dan auth menyinkronkan kontrol", () => {
    assert.match(eventsSource, /App\.syncHistoryControls\s*=\s*syncHistoryControls/);
    assert.match(eventsSource, /handleHistoryScopeClick/);
    assert.match(eventsSource, /handleTaskIdSearchSubmit/);
    assert.match(eventsSource, /handleTaskIdSearchInput/);
    assert.match(eventsSource, /handleTaskIdSearchClear/);
    assert.match(eventsSource, /genz:history-reset-pagination/);
    assert.match(eventsSource, /elements\.historyBody\.innerHTML = ""/);
    assert.match(authSource, /GENZHistory\.syncHistoryControls\(\)/);
    assert.doesNotMatch(authSource, /Riwayat generate seluruh aplikasi/);
    assert.match(stateSource, /historyScope:\s*"own"/);
    assert.match(stateSource, /taskIdSearch:\s*""/);
});

test("cache-bust modul berubah tanpa merusak pin versi lama", () => {
    assert.match(historyHtml, /history-data\.js\?v=20261026-expiry-result-only[^"']*scope-task-search/);
    assert.match(historyHtml, /history-render\.js\?v=20261026-expiry-result-only[^"']*scope-task-search/);
    assert.match(historyHtml, /history-events\.js\?v=[^"']*scope-task-search/);
    assert.match(historyHtml, /history-state\.js\?v=[^"']*scope-task-search/);
    assert.match(historyHtml, /history-auth\.js\?v=[^"']*scope-task-search/);
});

test("CSS kontrol responsif, mendukung light theme, dan menyembunyikan toggle user", () => {
    assert.match(controlsCss, /\.history-scope-control\[hidden\]/);
    assert.match(controlsCss, /@media \(max-width: 640px\)/);
    assert.match(controlsCss, /html\[data-genz-theme="light"\] \.history-controls/);
    assert.match(controlsCss, /history-row-global/);
    assert.match(controlsCss, /#emptyStateGenerateButton\[hidden\]/);
});
