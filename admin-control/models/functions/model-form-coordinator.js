/* =========================================================
   GEN-Z.AI
   MODEL FORM COORDINATOR
   ---------------------------------------------------------
   Tanggung jawab:
   - Menjadi penghubung fungsi Create
   - Menjadi penghubung fungsi Edit
   - Menjadi penghubung fungsi Delete
   - Menjadi penghubung Provider
   - Menjadi penghubung Price
   - Tidak menyimpan business logic CRUD
   ========================================================= */

(function () {
    "use strict";

    function getCreate() {
        return window.GENZModelFormCreate || null;
    }

    function getEdit() {
        return window.GENZModelFormEdit || null;
    }

    function getDelete() {
        return window.GENZModelFormDelete || null;
    }

    function getProvider() {
        return (
            window.GENZModelProviderDropdown ||
            window.GENZModelsProvider ||
            null
        );
    }

    function getPrice() {
        return (
            window.GENZModelPriceCalculation ||
            window.GENZModelsPrice ||
            null
        );
    }

    function create(data) {

        const module =
            getCreate();

        if (
            !module ||
            typeof module.create !== "function"
        ) {
            throw new Error(
                "Module Create Model belum tersedia."
            );
        }

        return module.create(data);
    }

    function createFromForm() {

        const module =
            getCreate();

        if (
            !module ||
            typeof module.createFromForm !==
                "function"
        ) {
            throw new Error(
                "Module Create Model belum tersedia."
            );
        }

        return module.createFromForm();
    }

    function update(data) {

        const module =
            getEdit();

        if (
            !module ||
            typeof module.update !== "function"
        ) {
            throw new Error(
                "Module Edit Model belum tersedia."
            );
        }

        return module.update(data);
    }

    function updateFromForm(model) {

        const module =
            getEdit();

        if (
            !module ||
            typeof module.updateFromForm !==
                "function"
        ) {
            throw new Error(
                "Module Edit Model belum tersedia."
            );
        }

        return module.updateFromForm(
            model
        );
    }

    function populateEdit(model) {

        const module =
            getEdit();

        if (
            !module ||
            typeof module.populate !==
                "function"
        ) {
            throw new Error(
                "Module Edit Model belum tersedia."
            );
        }

        return module.populate(
            model
        );
    }

    function remove(model) {

        const module =
            getDelete();

        if (
            !module ||
            typeof module.remove !==
                "function"
        ) {
            throw new Error(
                "Module Delete Model belum tersedia."
            );
        }

        return module.remove(
            model
        );
    }

    function removeById(modelId) {

        const module =
            getDelete();

        if (
            !module ||
            typeof module.removeById !==
                "function"
        ) {
            throw new Error(
                "Module Delete Model belum tersedia."
            );
        }

        return module.removeById(
            modelId
        );
    }

    function setProvider(providerId) {

        const module =
            getProvider();

        if (
            !module ||
            typeof module.setValue !==
                "function"
        ) {
            throw new Error(
                "Module Provider belum tersedia."
            );
        }

        return module.setValue(
            providerId
        );
    }

    function clearProvider() {

        const module =
            getProvider();

        if (
            !module ||
            typeof module.clear !==
                "function"
        ) {
            return false;
        }

        return module.clear();
    }

    function calculatePrice(data) {

        const module =
            getPrice();

        if (
            !module ||
            typeof module.calculate !==
                "function"
        ) {
            return null;
        }

        return module.calculate(
            data
        );
    }

    function syncPrice() {

        const module =
            getPrice();

        if (
            !module ||
            typeof module.syncForm !==
                "function"
        ) {
            return null;
        }

        return module.syncForm();
    }

    function getModules() {

        return {
            create:
                getCreate(),

            edit:
                getEdit(),

            delete:
                getDelete(),

            provider:
                getProvider(),

            price:
                getPrice()
        };
    }

    function status() {

        const modules =
            getModules();

        return {
            create:
                !!modules.create,

            edit:
                !!modules.edit,

            delete:
                !!modules.delete,

            provider:
                !!modules.provider,

            price:
                !!modules.price
        };
    }

    window.GENZModelFormCoordinator =
        Object.freeze({
            create,
            createFromForm,

            update,
            updateFromForm,
            populateEdit,

            remove,
            removeById,

            setProvider,
            clearProvider,

            calculatePrice,
            syncPrice,

            getModules,
            status
        });

})();
