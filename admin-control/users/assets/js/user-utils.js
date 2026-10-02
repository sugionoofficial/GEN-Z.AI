//utils.js?v=321.1
/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - UTILS
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-utils.js

   Fungsi:
   - HTML escaping
   - Format angka
   - Class role
   - Class status
   - Message handler
========================================================= */


/* =========================================================
   ESCAPE HTML
   ---------------------------------------------------------
   Mencegah data user yang berasal dari database
   langsung menjadi HTML.
========================================================= */

export function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   FORMAT NUMBER
========================================================= */

export function formatNumber(
    value
) {

    return Number(
        value || 0
    ).toLocaleString(
        "id-ID"
    );

}


/* =========================================================
   ROLE CLASS
========================================================= */

export function getRoleClass(
    role
) {

    return String(
        role ||
        "USER"
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   STATUS CLASS
========================================================= */

export function getStatusClass(
    status
) {

    return String(
        status ||
        "active"
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   SHOW MESSAGE
========================================================= */

export function showMessage(
    text,
    type = "success"
) {

    const message =
        document.getElementById(
            "message"
        );


    if (!message) {

        return;

    }


    message.textContent =
        String(
            text || ""
        );


    message.className =
        "message " +
        String(
            type || "success"
        );


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


/* =========================================================
   CLEAR MESSAGE
========================================================= */

export function clearMessage() {

    const message =
        document.getElementById(
            "message"
        );


    if (!message) {

        return;

    }


    message.textContent =
        "";


    message.className =
        "message";

}
