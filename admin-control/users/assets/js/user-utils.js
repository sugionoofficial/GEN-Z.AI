/* =========================================================
   GEN-Z.AI
   USER MANAGEMENT - UTILITIES
   ---------------------------------------------------------
   File:
   admin-control/users/assets/js/user-utils.js

   Fungsi:
   - HTML escaping
   - Number formatting
   - Role class
   - Status class
   - Message handling

   Tidak menangani:
   - Authentication
   - API request
   - User loading
   - User rendering
   - Modal action
========================================================= */


/* =========================================================
   ESCAPE HTML
========================================================= */

export function escapeHtml(value) {

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

export function formatNumber(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "id-ID"
    );

}


/* =========================================================
   ROLE CLASS
========================================================= */

export function getRoleClass(role) {

    return String(
        role || "USER"
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   STATUS CLASS
========================================================= */

export function getStatusClass(status) {

    return String(
        status || "active"
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
        text;


    message.className =
        "message " + type;


    window.scrollTo({

        top:
            0,

        behavior:
            "smooth"

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
