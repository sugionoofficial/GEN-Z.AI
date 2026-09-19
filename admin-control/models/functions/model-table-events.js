/* =========================================================
   GEN-Z.AI
   MODEL TABLE EVENTS MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-table-events.js

   Tanggung jawab:
   - Event tombol Edit
   - Event tombol Delete
   - Delegasi ke Form Coordinator / Delete module
   - Sinkronisasi hasil operasi dengan Table

   Tidak bertanggung jawab:
   - Render tabel
   - Query Supabase
   - Create / Update database
   - Delete database langsung
   - Form layout
   - Model data loading
   - kie_* tables

   Catatan penting:
   - Event handler tidak boleh memanggil dirinya sendiri.
   - Tidak ada recursive dispatch.
   - Tidak ada query Supabase di file ini.
   - Semua operasi database didelegasikan.
   ========================================================= */


/* =========================================================
   STATE
   ========================================================= */

let tableEventsState = {
    attached: false,
    root: null,
    coordinator: null,
    deleteHandler: null,
    editHandler: null,
    refreshHandler: null
};


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function normalizeId(value) {
    return String(
        value === null ||
        value === undefined
            ? ""
            : value
    ).trim();
}


function getElement(root, selector) {
    if (!root) {
        return null;
    }

    if (
        typeof root.querySelector !== "function"
    ) {
        return null;
    }

    return root.querySelector(
        selector
    );
}


function closestElement(
    element,
    selector
) {
    if (
        !element ||
        typeof element.closest !== "function"
    ) {
        return null;
    }

    return element.closest(
        selector
    );
}


function getRowFromEvent(
    event
) {
    if (!event) {
        return null;
    }

    const target =
        event.target;

    if (!target) {
        return null;
    }

    return (
        closestElement(
            target,
            "[data-model-row]"
        ) ||
        closestElement(
            target,
            "tr[data-model-id]"
        ) ||
        closestElement(
            target,
            "[data-model-id]"
        )
    );
}


function getModelIdFromRow(
    row
) {
    if (!row) {
        return "";
    }

    const id =
        row.dataset
            ? (
                row.dataset.modelId ||
                row.dataset.id ||
                ""
            )
            : "";

    if (id) {
        return normalizeId(id);
    }

    const element =
        getElement(
            row,
            "[data-model-id]"
        );

    if (element) {
        return normalizeId(
            element.dataset
                ? element.dataset.modelId
                : ""
        );
    }

    return "";
}


/* =========================================================
   MODEL EXTRACTION
   ========================================================= */

function getModelFromRow(
    row
) {
    if (!row) {
        return null;
    }

    /*
     * Coordinator/table boleh menaruh object model
     * dalam property DOM. Ini hanya fallback.
     */
    if (row._modelData) {
        return row._modelData;
    }

    if (
        row.dataset &&
        row.dataset.modelJson
    ) {
        try {
            return JSON.parse(
                row.dataset.modelJson
            );
        } catch {
            return null;
        }
    }

    return null;
}


/* =========================================================
   CALLBACK RESOLUTION
   ========================================================= */

function resolveFunction(
    options,
    names
) {
    if (!options) {
        return null;
    }

    for (
        const name
        of names
    ) {
        if (
            typeof options[name] ===
            "function"
        ) {
            return options[name];
        }
    }

    return null;
}


/* =========================================================
   EDIT EVENT
   ========================================================= */

async function executeEdit(
    event,
    options
) {
    const row =
        getRowFromEvent(
            event
        );

    if (!row) {
        return;
    }

    const modelId =
        getModelIdFromRow(
            row
        );

    if (!modelId) {
        console.error(
            "[MODEL TABLE] Model ID untuk Edit tidak ditemukan."
        );

        return;
    }

    const model =
        getModelFromRow(
            row
        );

    const handler =
        tableEventsState.editHandler ||
        resolveFunction(
            options,
            [
                "onEdit",
                "editModel",
                "openEditModel",
                "handleEdit"
            ]
        );

    if (!handler) {
        console.error(
            "[MODEL TABLE] Edit handler belum tersedia."
        );

        return;
    }

    /*
     * PENTING:
     *
     * Handler hanya dipanggil SATU KALI.
     *
     * Jangan dispatch event edit lagi dari sini.
     */
    return await handler(
        model || modelId,
        {
            event,
            row,
            modelId,
            source: "model-table"
        }
    );
}


/* =========================================================
   DELETE EVENT
   ========================================================= */

async function executeDelete(
    event,
    options
) {
    const row =
        getRowFromEvent(
            event
        );

    if (!row) {
        return;
    }

    const modelId =
        getModelIdFromRow(
            row
        );

    if (!modelId) {
        console.error(
            "[MODEL TABLE] Model ID untuk Delete tidak ditemukan."
        );

        return;
    }

    const model =
        getModelFromRow(
            row
        );

    const handler =
        tableEventsState.deleteHandler ||
        resolveFunction(
            options,
            [
                "onDelete",
                "deleteModel",
                "handleDelete"
            ]
        );

    if (!handler) {
        console.error(
            "[MODEL TABLE] Delete handler belum tersedia."
        );

        return;
    }

    /*
     * Delete diserahkan ke module/coordinator.
     * File ini tidak menyentuh Supabase.
     */
    return await handler(
        model || modelId,
        {
            event,
            row,
            modelId,
            source: "model-table"
        }
    );
}


/* =========================================================
   CLICK HANDLER
   ========================================================= */

async function handleTableClick(
    event,
    options = {}
) {
    if (!event) {
        return;
    }

    const target =
        event.target;

    if (!target) {
        return;
    }

    /*
     * EDIT
     */
    const editButton =
        closestElement(
            target,
            [
                "[data-model-edit]",
                "[data-action='edit-model']",
                "[data-action='edit']",
                ".model-edit-btn",
                ".btn-edit-model"
            ].join(",")
        );

    if (editButton) {
        event.preventDefault();
        event.stopPropagation();

        try {
            await executeEdit(
                event,
                options
            );
        } catch (error) {
            console.error(
                "[MODEL TABLE] Edit gagal:",
                error
            );

            emitOperationError(
                "edit",
                error,
                event
            );
        }

        return;
    }


    /*
     * DELETE
     */
    const deleteButton =
        closestElement(
            target,
            [
                "[data-model-delete]",
                "[data-action='delete-model']",
                "[data-action='delete']",
                ".model-delete-btn",
                ".btn-delete-model"
            ].join(",")
        );

    if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();

        try {
            await executeDelete(
                event,
                options
            );
        } catch (error) {
            console.error(
                "[MODEL TABLE] Delete gagal:",
                error
            );

            emitOperationError(
                "delete",
                error,
                event
            );
        }

        return;
    }
}


/* =========================================================
   DOUBLE CLICK GUARD
   ========================================================= */

let operationLock = false;

function lockOperation() {
    if (operationLock) {
        return false;
    }

    operationLock = true;

    return true;
}


function unlockOperation() {
    operationLock = false;
}


/* =========================================================
   OPERATION WRAPPER
   ========================================================= */

async function executeLocked(
    operation,
    ...args
) {
    if (
        typeof operation !==
        "function"
    ) {
        return null;
    }

    if (!lockOperation()) {
        return null;
    }

    try {
        return await operation(
            ...args
        );
    } finally {
        unlockOperation();
    }
}


/* =========================================================
   SAFE EDIT EXECUTOR
   ========================================================= */

async function executeEditLocked(
    event,
    options
) {
    return executeLocked(
        executeEdit,
        event,
        options
    );
}


/* =========================================================
   SAFE DELETE EXECUTOR
   ========================================================= */

async function executeDeleteLocked(
    event,
    options
) {
    return executeLocked(
        executeDelete,
        event,
        options
    );
}


/* =========================================================
   ERROR EVENT
   ========================================================= */

function emitOperationError(
    operation,
    error,
    originalEvent
) {
    if (
        typeof document ===
        "undefined"
    ) {
        return;
    }

    try {
        document.dispatchEvent(
            new CustomEvent(
                "genz:model-operation-error",
                {
                    detail: {
                        operation,
                        error,
                        originalEvent
                    }
                }
            )
        );
    } catch {
        /*
         * Error reporting tidak boleh
         * menyebabkan error kedua.
         */
    }
}


/* =========================================================
   SUCCESS EVENT
   ========================================================= */

export function emitOperationSuccess(
    operation,
    data = {}
) {
    if (
        typeof document ===
        "undefined"
    ) {
        return;
    }

    try {
        document.dispatchEvent(
            new CustomEvent(
                "genz:model-operation-success",
                {
                    detail: {
                        operation,
                        ...data
                    }
                }
            )
        );
    } catch {
        /*
         * Ignore event dispatch errors.
         */
    }
}


/* =========================================================
   REFRESH TABLE
   ========================================================= */

export async function refreshModelTable(
    options = {}
) {
    const handler =
        tableEventsState.refreshHandler ||
        resolveFunction(
            options,
            [
                "refreshTable",
                "reloadTable",
                "loadTable",
                "onRefresh"
            ]
        );

    if (
        typeof handler !==
        "function"
    ) {
        return null;
    }

    /*
     * Refresh dipanggil langsung.
     *
     * Tidak dispatch event yang kemudian
     * memanggil refresh lagi.
     */
    return await handler({
        source: "model-table-events"
    });
}


/* =========================================================
   ATTACH EVENTS
   ========================================================= */

export function attachModelTableEvents(
    root,
    options = {}
) {
    if (!root) {
        throw new Error(
            "MODEL_TABLE_ROOT_MISSING"
        );
    }

    /*
     * Jika sudah terpasang pada root yang sama,
     * jangan menambahkan listener kedua.
     *
     * Ini penting karena render ulang tabel
     * sering terjadi.
     */
    if (
        tableEventsState.attached &&
        tableEventsState.root === root
    ) {
        updateModelTableEventHandlers(
            options
        );

        return root;
    }

    /*
     * Jika sebelumnya terpasang di root lain,
     * lepaskan terlebih dahulu.
     */
    if (
        tableEventsState.attached
    ) {
        detachModelTableEvents();
    }

    tableEventsState.root =
        root;

    tableEventsState.coordinator =
        options.coordinator ||
        null;

    tableEventsState.editHandler =
        resolveFunction(
            options,
            [
                "onEdit",
                "editModel",
                "openEditModel",
                "handleEdit"
            ]
        );

    tableEventsState.deleteHandler =
        resolveFunction(
            options,
            [
                "onDelete",
                "deleteModel",
                "handleDelete"
            ]
        );

    tableEventsState.refreshHandler =
        resolveFunction(
            options,
            [
                "refreshTable",
                "reloadTable",
                "loadTable",
                "onRefresh"
            ]
        );

    /*
     * Gunakan satu listener delegasi.
     *
     * Tidak ada listener per tombol.
     * Tidak ada listener yang ditambahkan
     * setiap kali tabel dirender ulang.
     */
    tableEventsState.clickHandler =
        event => {
            handleTableClick(
                event,
                options
            );
        };

    root.addEventListener(
        "click",
        tableEventsState.clickHandler
    );

    tableEventsState.attached =
        true;

    if (root.dataset) {
        root.dataset.modelTableEvents =
            "attached";
    }

    return root;
}


/* =========================================================
   UPDATE HANDLERS
   ========================================================= */

export function updateModelTableEventHandlers(
    options = {}
) {
    if (
        options.coordinator
    ) {
        tableEventsState.coordinator =
            options.coordinator;
    }

    const editHandler =
        resolveFunction(
            options,
            [
                "onEdit",
                "editModel",
                "openEditModel",
                "handleEdit"
            ]
        );

    if (editHandler) {
        tableEventsState.editHandler =
            editHandler;
    }

    const deleteHandler =
        resolveFunction(
            options,
            [
                "onDelete",
                "deleteModel",
                "handleDelete"
            ]
        );

    if (deleteHandler) {
        tableEventsState.deleteHandler =
            deleteHandler;
    }

    const refreshHandler =
        resolveFunction(
            options,
            [
                "refreshTable",
                "reloadTable",
                "loadTable",
                "onRefresh"
            ]
        );

    if (refreshHandler) {
        tableEventsState.refreshHandler =
            refreshHandler;
    }

    return getModelTableEventState();
}


/* =========================================================
   DETACH EVENTS
   ========================================================= */

export function detachModelTableEvents() {
    const root =
        tableEventsState.root;

    if (
        root &&
        tableEventsState.clickHandler
    ) {
        root.removeEventListener(
            "click",
            tableEventsState.clickHandler
        );
    }

    if (
        root &&
        root.dataset
    ) {
        delete root.dataset
            .modelTableEvents;
    }

    tableEventsState = {
        attached: false,
        root: null,
        coordinator: null,
        deleteHandler: null,
        editHandler: null,
        refreshHandler: null
    };

    operationLock = false;
}


/* =========================================================
   EVENT STATE
   ========================================================= */

export function getModelTableEventState() {
    return {
        attached:
            tableEventsState.attached,

        hasEditHandler:
            typeof
                tableEventsState.editHandler ===
            "function",

        hasDeleteHandler:
            typeof
                tableEventsState.deleteHandler ===
            "function",

        hasRefreshHandler:
            typeof
                tableEventsState.refreshHandler ===
            "function",

        hasCoordinator:
            Boolean(
                tableEventsState.coordinator
            ),

        operationLocked:
            operationLock
    };
}


/* =========================================================
   DIRECT EVENT METHODS
   ---------------------------------------------------------
   Berguna untuk coordinator yang ingin menjalankan
   operasi tanpa mensimulasikan click event.
   ========================================================= */

export async function triggerEdit(
    modelOrId,
    options = {}
) {
    const handler =
        tableEventsState.editHandler ||
        resolveFunction(
            options,
            [
                "onEdit",
                "editModel",
                "openEditModel",
                "handleEdit"
            ]
        );

    if (
        typeof handler !==
        "function"
    ) {
        throw new Error(
            "MODEL_EDIT_HANDLER_MISSING"
        );
    }

    return executeLocked(
        handler,
        modelOrId,
        {
            source:
                "model-table-direct"
        }
    );
}


export async function triggerDelete(
    modelOrId,
    options = {}
) {
    const handler =
        tableEventsState.deleteHandler ||
        resolveFunction(
            options,
            [
                "onDelete",
                "deleteModel",
                "handleDelete"
            ]
        );

    if (
        typeof handler !==
        "function"
    ) {
        throw new Error(
            "MODEL_DELETE_HANDLER_MISSING"
        );
    }

    return executeLocked(
        handler,
        modelOrId,
        {
            source:
                "model-table-direct"
        }
    );
}


/* =========================================================
   FIND ACTION BUTTON
   ========================================================= */

export function findEditButton(
    row
) {
    return closestElement(
        row,
        "[data-model-edit]"
    ) ||
    getElement(
        row,
        [
            "[data-model-edit]",
            "[data-action='edit-model']",
            "[data-action='edit']",
            ".model-edit-btn",
            ".btn-edit-model"
        ].join(",")
    );
}


export function findDeleteButton(
    row
) {
    return closestElement(
        row,
        "[data-model-delete]"
    ) ||
    getElement(
        row,
        [
            "[data-model-delete]",
            "[data-action='delete-model']",
            "[data-action='delete']",
            ".model-delete-btn",
            ".btn-delete-model"
        ].join(",")
    );
}


/* =========================================================
   DATA ATTRIBUTES
   ========================================================= */

export function setRowModelData(
    row,
    model
) {
    if (!row || !model) {
        return row;
    }

    const modelId =
        normalizeId(
            model.id
        );

    if (row.dataset) {
        row.dataset.modelId =
            modelId;

        row.dataset.modelIdApi =
            normalizeId(
                model.model_id
            );

        /*
         * Simpan object secara internal.
         * Tidak dimasukkan ke HTML sebagai JSON,
         * sehingga tidak ada masalah escaping.
         */
        row._modelData = model;
    }

    return row;
}


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

const ModelTableEvents = {
    attachModelTableEvents,
    updateModelTableEventHandlers,
    detachModelTableEvents,

    getModelTableEventState,

    triggerEdit,
    triggerDelete,

    refreshModelTable,

    emitOperationSuccess,

    setRowModelData,

    findEditButton,
    findDeleteButton
};


/* =========================================================
   GLOBAL COMPATIBILITY
   ========================================================= */

if (
    typeof window !== "undefined"
) {
    window.GENZModelTableEvents =
        ModelTableEvents;
}


export default ModelTableEvents;
