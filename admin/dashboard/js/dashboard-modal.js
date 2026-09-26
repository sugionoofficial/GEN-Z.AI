/* =========================================================
   GEN-Z.AI DASHBOARD
   ACTIVITY MODAL MODULE

   Tanggung jawab:
   - Membuka modal aktivitas akun
   - Menampilkan seluruh aktivitas akun
   - Menampilkan generate yang sedang berjalan
   - Tombol Cancel Generate
   - Update status generation_history
   - Close modal
   - Backdrop click
   - Escape key

   Tidak menangani:
   - Auth
   - Statistik
   - Account Activity loading
   - System Information
========================================================= */

(function () {
    "use strict";


    const GENZDashboardModal = {

        /* =====================================================
           STATE
        ===================================================== */

        state: {
            initialized: false,
            open: false,
            selectedUserId: null
        },


        /* =====================================================
           GET SUPABASE CLIENT
        ===================================================== */

        getClient() {

            const auth =
                window.GENZDashboardAuth;


            if (!auth) {

                throw new Error(
                    "GENZDashboardAuth belum tersedia."
                );

            }


            return auth.getSupabaseClient();

        },


        /* =====================================================
           GET ACTIVITY MODULE
        ===================================================== */

        getActivity() {

            const activity =
                window.GENZDashboardActivity;


            if (!activity) {

                throw new Error(
                    "GENZDashboardActivity belum tersedia."
                );

            }


            return activity;

        },


        /* =====================================================
           ELEMENT
        ===================================================== */

        getElement(id) {

            return document.getElementById(id);

        },


        /* =====================================================
           ESCAPE HTML
        ===================================================== */

        escapeHTML(value) {

            if (
                value === null ||
                value === undefined
            ) {

                return "";

            }


            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        },


        /* =====================================================
           FORMAT NUMBER
        ===================================================== */

        formatNumber(value) {

            return new Intl.NumberFormat(
                "id-ID"
            ).format(
                Number(value) || 0
            );

        },


        /* =====================================================
           FORMAT DATE
        ===================================================== */

        formatDate(value) {

            if (!value) {
                return "-";
            }


            const date =
                new Date(value);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "-";

            }


            return date.toLocaleString(
                "id-ID",
                {
                    dateStyle: "medium",
                    timeStyle: "short"
                }
            );

        },


        /* =====================================================
           NORMALIZE STATUS
        ===================================================== */

        normalizeStatus(status) {

            return String(
                status || ""
            )
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_");

        },


        /* =====================================================
           STATUS LABEL
        ===================================================== */

        getStatusLabel(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            const labels = {

                processing:
                    "Processing",

                pending:
                    "Pending",

                queued:
                    "Queued",

                running:
                    "Running",

                generating:
                    "Generating",

                in_progress:
                    "In Progress",

                completed:
                    "Completed",

                complete:
                    "Completed",

                success:
                    "Success",

                succeeded:
                    "Success",

                done:
                    "Done",

                failed:
                    "Failed",

                failure:
                    "Failed",

                error:
                    "Error",

                cancelled:
                    "Cancelled",

                canceled:
                    "Cancelled",

                rejected:
                    "Rejected"

            };


            return (
                labels[normalized] ||
                status ||
                "Unknown"
            );

        },


        /* =====================================================
           STATUS CLASS
        ===================================================== */

        getStatusClass(status) {

            const normalized =
                this.normalizeStatus(
                    status
                );


            if (
                [
                    "processing",
                    "pending",
                    "queued",
                    "running",
                    "generating",
                    "in_progress",
                    "in-progress"
                ].includes(normalized)
            ) {

                return "running";

            }


            if (
                [
                    "completed",
                    "complete",
                    "success",
                    "succeeded",
                    "done"
                ].includes(normalized)
            ) {

                return "success";

            }


            if (
                [
                    "failed",
                    "failure",
                    "error",
                    "cancelled",
                    "canceled",
                    "rejected"
                ].includes(normalized)
            ) {

                return "failed";

            }


            return "unknown";

        },


        /* =====================================================
           GET PROFILE
        ===================================================== */

        getProfile(userId) {

            const activity =
                this.getActivity();


            return activity.state.profiles
                .find(
                    profile =>
                        String(profile?.id) ===
                        String(userId)
                ) || null;

        },


        /* =====================================================
           GET USER HISTORY
        ===================================================== */

        getUserHistory(userId) {

            const activity =
                this.getActivity();


            return activity.getUserHistory(
                userId
            );

        },


        /* =====================================================
           OPEN FOR USER
        ===================================================== */

        openForUser(
            userId,
            activityState
        ) {

            if (!userId) {
                return;
            }


            this.state.selectedUserId =
                userId;


            const modal =
                this.getElement(
                    "activityModal"
                );


            if (!modal) {
                return;
            }


            this.state.open =
                true;


            /*
             * Pastikan modal tidak lagi
             * dianggap hidden.
             */

            modal.hidden =
                false;


            modal.setAttribute(
                "aria-hidden",
                "false"
            );


            modal.classList.add(
                "is-open"
            );


            document.body.classList.add(
                "activity-modal-open"
            );


            this.render(
                userId,
                activityState
            );


            /*
             * Fokus ke tombol close
             * setelah modal terbuka.
             */

            window.setTimeout(
                () => {

                    const close =
                        this.getElement(
                            "activityModalClose"
                        );


                    if (close) {
                        close.focus();
                    }

                },
                0
            );

        },


        /* =====================================================
           RENDER MODAL
        ===================================================== */

        render(
            userId,
            activityState
        ) {

            const activity =
                this.getActivity();


            const profile =
                this.getProfile(
                    userId
                );


            const history =
                activityState
                    ? activity.getUserHistory(
                        userId
                    )
                    : this.getUserHistory(
                        userId
                    );


            this.renderHeader(
                profile
            );


            this.renderContent(
                profile,
                history
            );

        },


        /* =====================================================
           RENDER HEADER
        ===================================================== */

        renderHeader(profile) {

            const title =
                this.getElement(
                    "activityModalTitle"
                );


            const account =
                this.getElement(
                    "activityModalAccount"
                );


            if (!profile) {

                if (title) {

                    title.textContent =
                        "Account Activity";

                }


                if (account) {

                    account.textContent =
                        "Account tidak ditemukan";

                }


                return;

            }


            const name =
                profile.name ||
                profile.full_name ||
                profile.email ||
                "Unknown User";


            const email =
                profile.email ||
                "-";


            if (title) {

                title.textContent =
                    "Account Activity";

            }


            if (account) {

                account.textContent =
                    `${name} • ${email}`;

            }

        },


        /* =====================================================
           RENDER EMPTY CONTENT
        ===================================================== */

        renderEmpty() {

            return `
                <div class="activity-modal-empty">

                    <div class="activity-modal-empty-icon">
                        ◌
                    </div>

                    <div class="activity-modal-empty-title">
                        Belum ada aktivitas
                    </div>

                    <div class="activity-modal-empty-text">
                        Akun ini belum memiliki
                        riwayat generate.
                    </div>

                </div>
            `;

        },


        /* =====================================================
           GET MODEL NAME
        ===================================================== */

        getModelName(item) {

            return (
                item?.model_name ||
                item?.model ||
                item?.model_id ||
                "-"
            );

        },


        /* =====================================================
           GET PROVIDER NAME
        ===================================================== */

        getProviderName(item) {

            return (
                item?.provider_name ||
                item?.provider ||
                "-"
            );

        },


        /* =====================================================
           GET TASK
        ===================================================== */

        getTaskName(item) {

            return (
                item?.task ||
                item?.task_type ||
                item?.type ||
                item?.generation_type ||
                "-"
            );

        },


        /* =====================================================
           GET CREDIT
        ===================================================== */

        getCredit(item) {

            return (
                item?.credit_cost ??
                item?.credits_used ??
                item?.credit_used ??
                item?.credits ??
                0
            );

        },


        /* =====================================================
           GET PROMPT
        ===================================================== */

        getPrompt(item) {

            return (
                item?.prompt ||
                item?.description ||
                item?.input_prompt ||
                ""
            );

        },


        /* =====================================================
           RENDER ACTIVITY ITEM
        ===================================================== */

        renderActivityItem(item) {

            const status =
                item?.status ||
                "unknown";


            const normalized =
                this.normalizeStatus(
                    status
                );


            const isRunning =
                [
                    "processing",
                    "pending",
                    "queued",
                    "running",
                    "generating",
                    "in_progress",
                    "in-progress"
                ].includes(
                    normalized
                );


            const model =
                this.escapeHTML(
                    this.getModelName(
                        item
                    )
                );


            const provider =
                this.escapeHTML(
                    this.getProviderName(
                        item
                    )
                );


            const task =
                this.escapeHTML(
                    this.getTaskName(
                        item
                    )
                );


            const credit =
                this.formatNumber(
                    this.getCredit(
                        item
                    )
                );


            const prompt =
                this.escapeHTML(
                    this.getPrompt(
                        item
                    )
                );


            const createdAt =
                this.formatDate(
                    item?.created_at
                );


            const statusLabel =
                this.escapeHTML(
                    this.getStatusLabel(
                        status
                    )
                );


            const statusClass =
                this.getStatusClass(
                    status
                );


            const generationId =
                this.escapeHTML(
                    item?.id
                );


            return `
                <article
                    class="
                        activity-item
                        ${isRunning
                            ? "is-running"
                            : ""}
                    "
                    data-generation-id="${generationId}"
                >

                    <div class="activity-item-header">

                        <div class="activity-item-title">

                            <span class="activity-item-model">
                                ${model}
                            </span>

                            ${
                                provider !== "-"
                                    ? `
                                        <span class="activity-item-provider">
                                            ${provider}
                                        </span>
                                      `
                                    : ""
                            }

                        </div>


                        <span
                            class="
                                activity-status
                                ${statusClass}
                            "
                        >
                            ${
                                isRunning
                                    ? `
                                        <span class="activity-status-dot"></span>
                                      `
                                    : ""
                            }

                            ${statusLabel}
                        </span>

                    </div>


                    <div class="activity-item-meta">

                        <span>
                            Task:
                            <strong>
                                ${task}
                            </strong>
                        </span>

                        <span>
                            Credit:
                            <strong>
                                ${credit}
                            </strong>
                        </span>

                        <span>
                            ${createdAt}
                        </span>

                    </div>


                    ${
                        prompt
                            ? `
                                <div class="activity-item-prompt">
                                    ${prompt}
                                </div>
                              `
                            : ""
                    }


                    ${
                        isRunning
                            ? `
                                <div class="activity-item-actions">

                                    <button
                                        type="button"
                                        class="
                                            activity-cancel-button
                                            danger
                                        "
                                        data-cancel-generation="${generationId}"
                                    >
                                        Cancel Generate
                                    </button>

                                </div>
                              `
                            : ""
                    }

                </article>
            `;

        },


        /* =====================================================
           RENDER CONTENT
        ===================================================== */

        renderContent(
            profile,
            history
        ) {

            const container =
                this.getElement(
                    "activityModalContent"
                );


            if (!container) {
                return;
            }


            if (!profile) {

                container.innerHTML = `
                    <div class="activity-modal-empty">
                        Account tidak ditemukan.
                    </div>
                `;

                return;

            }


            if (!history.length) {

                container.innerHTML =
                    this.renderEmpty();

                return;

            }


            const runningCount =
                history.filter(
                    item =>
                        [
                            "processing",
                            "pending",
                            "queued",
                            "running",
                            "generating",
                            "in_progress",
                            "in-progress"
                        ].includes(
                            this.normalizeStatus(
                                item?.status
                            )
                        )
                ).length;


            container.innerHTML = `

                <div class="activity-modal-summary">

                    <div class="modal-summary-card">

                        <span>
                            Total Aktivitas
                        </span>

                        <strong>
                            ${this.formatNumber(
                                history.length
                            )}
                        </strong>

                    </div>


                    <div class="modal-summary-card">

                        <span>
                            Sedang Berjalan
                        </span>

                        <strong>
                            ${this.formatNumber(
                                runningCount
                            )}
                        </strong>

                    </div>


                    <div class="modal-summary-card">

                        <span>
                            Credit Akun
                        </span>

                        <strong>
                            ${this.formatNumber(
                                profile?.credits || 0
                            )}
                        </strong>

                    </div>

                </div>


                <div class="activity-modal-list">

                    ${history
                        .map(
                            item =>
                                this.renderActivityItem(
                                    item
                                )
                        )
                        .join("")}

                </div>

            `;


            this.bindContentEvents();

        },


        /* =====================================================
           CONTENT EVENTS
        ===================================================== */

        bindContentEvents() {

            const container =
                this.getElement(
                    "activityModalContent"
                );


            if (!container) {
                return;
            }


            /*
             * Event delegation.
             */

            container.onclick =
                async event => {

                    const button =
                        event.target.closest(
                            "[data-cancel-generation]"
                        );


                    if (!button) {
                        return;
                    }


                    const generationId =
                        button.dataset
                            .cancelGeneration;


                    if (!generationId) {
                        return;
                    }


                    await this.cancelGeneration(
                        generationId,
                        button
                    );

                };

        },


        /* =====================================================
           CANCEL GENERATION
        ===================================================== */

        async cancelGeneration(
            generationId,
            button
        ) {

            if (!generationId) {
                return;
            }


            const selectedUserId =
                this.state.selectedUserId;


            /*
             * Cancel hanya boleh dilakukan
             * jika modal memang sedang membuka
             * akun tertentu.
             */

            if (!selectedUserId) {

                window.alert(
                    "Akun Generate tidak ditemukan."
                );

                return;

            }


            const confirmed =
                window.confirm(
                    "Batalkan Generate yang sedang berjalan?"
                );


            if (!confirmed) {
                return;
            }


            if (button) {

                button.disabled =
                    true;


                button.textContent =
                    "Membatalkan...";

            }


            try {

                const client =
                    this.getClient();


                /*
                 * SECURITY:
                 *
                 * Jangan hanya menggunakan generation_history.id.
                 *
                 * Pastikan generation tersebut benar-benar
                 * milik akun yang sedang dibuka.
                 */

                const {
                    data: updatedRows,
                    error
                } =
                    await client
                        .from(
                            "generation_history"
                        )
                        .update({
                            status:
                                "cancelled"
                        })
                        .eq(
                            "id",
                            generationId
                        )
                        .eq(
                            "user_id",
                            selectedUserId
                        )
                        .select(
                            "id,user_id,status"
                        );


                if (error) {
                    throw error;
                }


                /*
                 * Jika tidak ada row yang berubah,
                 * jangan menganggap Cancel berhasil.
                 *
                 * Ini juga melindungi dari kasus:
                 * - ID tidak ditemukan
                 * - generation bukan milik akun
                 * - row sudah berubah sebelum request selesai
                 */

                if (
                    !Array.isArray(updatedRows) ||
                    updatedRows.length === 0
                ) {

                    throw new Error(
                        "Generate tidak ditemukan atau bukan milik akun yang sedang dibuka."
                    );

                }


                /*
                 * Pastikan hasil update memang
                 * menunjuk ke akun yang sedang dibuka.
                 */

                const updatedRow =
                    updatedRows[0];


                if (
                    String(
                        updatedRow?.user_id
                    ) !==
                    String(
                        selectedUserId
                    )
                ) {

                    throw new Error(
                        "Validasi akun Generate gagal."
                    );

                }


                /*
                 * Update state lokal terlebih dahulu
                 * supaya UI langsung berubah.
                 */

                const activity =
                    this.getActivity();


                const historyItem =
                    activity.state.history
                        .find(
                            item =>
                                String(
                                    item?.id
                                ) ===
                                String(
                                    generationId
                                ) &&
                                String(
                                    item?.user_id ||
                                    item?.profile_id ||
                                    item?.owner_id
                                ) ===
                                String(
                                    selectedUserId
                                )
                        );


                if (historyItem) {

                    historyItem.status =
                        "cancelled";

                }


                /*
                 * Render ulang isi modal.
                 */

                this.render(
                    selectedUserId,
                    activity.state
                );


                /*
                 * Render Account Activity juga,
                 * sehingga lampu hijau pada akun
                 * langsung mati jika tidak ada
                 * generate aktif lainnya.
                 */

                activity.render();


            } catch (error) {

                console.error(
                    "[GENZ Dashboard Modal Cancel]",
                    error
                );


                if (button) {

                    button.disabled =
                        false;


                    button.textContent =
                        "Cancel Generate";

                }


                window.alert(
                    error?.message ||
                    "Gagal membatalkan Generate."
                );

            }

        },


        /* =====================================================
           CLOSE
        ===================================================== */

        close() {

            const modal =
                this.getElement(
                    "activityModal"
                );


            if (!modal) {
                return;
            }


            this.state.open =
                false;


            modal.classList.remove(
                "is-open"
            );


            modal.hidden =
                true;


            modal.setAttribute(
                "aria-hidden",
                "true"
            );


            document.body.classList.remove(
                "activity-modal-open"
            );


            this.state.selectedUserId =
                null;

        },


        /* =====================================================
           BACKDROP CLICK
        ===================================================== */

        handleBackdropClick(event) {

            const modal =
                this.getElement(
                    "activityModal"
                );


            if (!modal) {
                return;
            }


            const target =
                event.target;


            /*
             * Struktur modal:
             *
             * #activityModal
             *   └── .activity-modal-backdrop
             *       └── .activity-modal-panel
             *
             * Karena backdrop berada di dalam
             * #activityModal, event.target === modal
             * tidak pernah menjadi kondisi yang tepat
             * ketika backdrop diklik.
             */

            if (
                target &&
                target.classList &&
                target.classList.contains(
                    "activity-modal-backdrop"
                )
            ) {

                this.close();

                return;

            }


            /*
             * Dukungan tambahan apabila struktur
             * HTML nantinya menggunakan modal
             * sebagai backdrop langsung.
             */

            if (
                target === modal
            ) {

                this.close();

            }

        },


        /* =====================================================
           ESCAPE
        ===================================================== */

        handleKeydown(event) {

            if (
                event.key === "Escape" &&
                this.state.open
            ) {

                this.close();

            }

        },


        /* =====================================================
           INIT
        ===================================================== */

        init() {

            if (
                this.state.initialized
            ) {

                return;

            }


            const modal =
                this.getElement(
                    "activityModal"
                );


            if (!modal) {

                console.warn(
                    "[GENZ Dashboard Modal] #activityModal tidak ditemukan."
                );


                return;

            }


            /*
             * HARD SAFETY:
             * modal harus tersembunyi ketika
             * halaman pertama kali dibuka.
             */

            modal.hidden =
                true;


            modal.setAttribute(
                "aria-hidden",
                "true"
            );


            modal.classList.remove(
                "is-open"
            );


            const closeButton =
                this.getElement(
                    "activityModalClose"
                );


            if (closeButton) {

                closeButton.addEventListener(
                    "click",
                    () => {

                        this.close();

                    }
                );

            }


            modal.addEventListener(
                "click",
                event => {

                    this.handleBackdropClick(
                        event
                    );

                }
            );


            document.addEventListener(
                "keydown",
                event => {

                    this.handleKeydown(
                        event
                    );

                }
            );


            this.state.initialized =
                true;

        }

    };


    /* =========================================================
       GLOBAL API
    ========================================================= */

    window.GENZDashboardModal =
        GENZDashboardModal;


})();
