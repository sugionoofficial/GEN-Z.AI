/* =========================================================
   GEN-Z.AI
   MODEL FORM COORDINATOR
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-coordinator.js

   TANGGUNG JAWAB:
   - Menghubungkan Create Model
   - Menghubungkan Edit Model
   - Menghubungkan Delete Model
   - Menjadi satu pintu untuk operasi CRUD Form

   TIDAK BERTANGGUNG JAWAB:
   - Provider dropdown
   - Model ID dropdown
   - Search Model
   - Kalkulasi Credit
   - Kalkulasi Harga
   - Event Listener
   - Render UI
   - Query Supabase langsung

   Prinsip:
   Satu fungsi = satu owner.
   Coordinator hanya meneruskan pekerjaan ke module owner.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getCreate() {

        return (
            window.GENZModelFormCreate ||
            null
        );

    }


    function getEdit() {

        return (
            window.GENZModelFormEdit ||
            null
        );

    }


    function getDelete() {

        return (
            window.GENZModelFormDelete ||
            null
        );

    }


    /* =====================================================
       VALIDATE MODULE
    ===================================================== */

    function requireModule(
        module,
        name
    ) {

        if (!module) {

            throw new Error(
                `Module ${name} belum tersedia.`
            );

        }

        return module;

    }


    function requireFunction(
        module,
        functionName,
        moduleName
    ) {

        if (
            !module ||
            typeof module[functionName] !==
                "function"
        ) {

            throw new Error(
                `Fungsi ${functionName} pada Module ${moduleName} belum tersedia.`
            );

        }

        return module[functionName];

    }


    /* =====================================================
       CREATE
    ===================================================== */

    function create(
        data
    ) {

        const module =
            requireModule(
                getCreate(),
                "Create Model"
            );

        const handler =
            requireFunction(
                module,
                "create",
                "Create Model"
            );

        return handler.call(
            module,
            data
        );

    }


    function createFromForm() {

        const module =
            requireModule(
                getCreate(),
                "Create Model"
            );

        const handler =
            requireFunction(
                module,
                "createFromForm",
                "Create Model"
            );

        return handler.call(
            module
        );

    }


    /* =====================================================
       EDIT
    ===================================================== */

    function update(
        data
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        const handler =
            requireFunction(
                module,
                "update",
                "Edit Model"
            );

        return handler.call(
            module,
            data
        );

    }


    function updateFromForm(
        model
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        const handler =
            requireFunction(
                module,
                "updateFromForm",
                "Edit Model"
            );

        return handler.call(
            module,
            model
        );

    }


    function populateEdit(
        model
    ) {

        const module =
            requireModule(
                getEdit(),
                "Edit Model"
            );

        const handler =
            requireFunction(
                module,
                "populate",
                "Edit Model"
            );

        return handler.call(
            module,
            model
        );

    }


    /* =====================================================
       DELETE
    ===================================================== */

    function remove(
        model
    ) {

        const module =
            requireModule(
                getDelete(),
                "Delete Model"
            );

        const handler =
            requireFunction(
                module,
                "remove",
                "Delete Model"
            );

        return handler.call(
            module,
            model
        );

    }


    function removeById(
        modelId
    ) {

        const module =
            requireModule(
                getDelete(),
                "Delete Model"
            );

        const handler =
            requireFunction(
                module,
                "removeById",
                "Delete Model"
            );

        return handler.call(
            module,
            modelId
        );

    }


    /* =====================================================
       MODULE STATUS
    ===================================================== */

    function getModules() {

        return {

            create:
                getCreate(),

            edit:
                getEdit(),

            delete:
                getDelete()

        };

    }


    function status() {

        const modules =
            getModules();

        return {

            create:
                Boolean(
                    modules.create
                ),

            edit:
                Boolean(
                    modules.edit
                ),

            delete:
                Boolean(
                    modules.delete
                )

        };

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelFormCoordinator =
        Object.freeze({

            /* Create */
            create,
            createFromForm,

            /* Edit */
            update,
            updateFromForm,
            populateEdit,

            /* Delete */
            remove,
            removeById,

            /* Diagnostics */
            getModules,
            status

        });


})();
