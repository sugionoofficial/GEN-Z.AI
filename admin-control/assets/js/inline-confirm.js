/* =========================================================
   GEN-Z.AI
   KONFIRMASI DI DALAM TOMBOL (TANPA BLOK MENGAMBANG)
   ---------------------------------------------------------
   File:
     admin-control/assets/js/inline-confirm.js

   Kenapa ada file ini?

   `window.confirm()` memunculkan blok dialog mengambang di
   tengah layar. Di HP blok itu menutupi konten dan memutus
   alur kerja. Sejak konfirmasi terbit Facebook Page diubah
   menjadi "klik tombol → tombol berubah jadi konfirmasi →
   klik lagi", perilaku yang sama dipakai untuk SEMUA aksi
   yang perlu konfirmasi di Studio Medsos.

   Cara kerja:
     klik 1 : tombol berubah hijau terang, teks "Konfirmasi …",
              aria-pressed="true", kedaluwarsa 9 detik
     klik 2 : tombol kembali ke label aslinya, aksi dijalankan
     batal  : klik di luar tombol, tekan Escape, atau biarkan
              9 detik — label kembali tanpa melakukan apa pun

   Helper ini sengaja berupa skrip klasik (bukan ES module)
   supaya bisa dipakai dua halaman sekaligus:
     - social-publisher.js      (module)
     - studio-medsos-set.js     (skrip klasik)
   Keduanya memakai `window.GENZInlineConfirm`.
========================================================= */

(function () {
    "use strict";


    /** Lama tombol menunggu klik kedua (sama dengan tombol terbit). */
    var ARM_TIMEOUT_MS = 9000;


    /** Class CSS yang membuat tombol berwarna hijau terang. */
    var ARMED_CLASS = "is-confirming";


    var DEFAULT_LABEL = "Konfirmasi";


    /** button -> { originalText, originalAriaLabel, originalTitle, timer } */
    var armedButtons = new Map();


    function isButtonLike(value) {
        return Boolean(
            value &&
            typeof value === "object" &&
            value.classList &&
            typeof value.classList.add === "function" &&
            typeof value.classList.remove === "function" &&
            typeof value.textContent === "string"
        );
    }


    function readAttribute(button, name) {
        return typeof button.getAttribute === "function"
            ? button.getAttribute(name)
            : null;
    }


    function writeAttribute(button, name, value) {
        if (!button) return;
        if (value === null || value === undefined) {
            button.removeAttribute?.(name);
            return;
        }
        button.setAttribute?.(name, value);
    }


    /**
     * Kembalikan tombol ke label aslinya dan hentikan timer.
     *
     * @returns {boolean} true bila tombol memang sedang menunggu konfirmasi.
     */
    function disarm(button) {
        var entry = armedButtons.get(button);
        if (!entry) return false;

        if (entry.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }
        armedButtons.delete(button);

        if (isButtonLike(button)) {
            button.textContent = entry.originalText;
            button.classList.remove(ARMED_CLASS);
            button.removeAttribute?.("aria-pressed");
            writeAttribute(button, "aria-label", entry.originalAriaLabel);
            writeAttribute(button, "title", entry.originalTitle);
        }

        return true;
    }


    /** Batalkan semua tombol yang sedang menunggu konfirmasi. */
    function disarmAll() {
        Array.from(armedButtons.keys()).forEach(function (button) {
            disarm(button);
        });
    }


    function isArmed(button) {
        return armedButtons.has(button);
    }


    /**
     * Minta konfirmasi lewat tombol yang sama.
     *
     * @param {HTMLElement} button tombol yang diklik user
     * @param {object} [options]
     * @param {string} [options.label] teks saat menunggu konfirmasi
     * @param {string} [options.ariaLabel]
     * @param {string} [options.title] penjelasan singkat (tooltip bawaan tombol)
     * @param {Function} [options.onArm] dipanggil setelah tombol "dipersenjatai"
     * @param {Function} [options.onExpire] dipanggil saat konfirmasi kedaluwarsa
     * @returns {boolean} true = lanjutkan aksi, false = baru klik pertama.
     *
     * Bila tombol tidak tersedia (mis. elemen sudah terhapus karena
     * re-render), fungsi mengembalikan true supaya aksi tidak diam-diam
     * gagal tanpa penjelasan.
     */
    function request(button, options) {
        var settings = options && typeof options === "object" ? options : {};

        if (!isButtonLike(button)) return true;

        if (armedButtons.has(button)) {
            disarm(button);
            return true;
        }

        disarmAll();

        var label = typeof settings.label === "string" && settings.label.trim()
            ? settings.label.trim()
            : DEFAULT_LABEL;

        var entry = {
            originalText: button.textContent,
            originalAriaLabel: readAttribute(button, "aria-label"),
            originalTitle: readAttribute(button, "title"),
            timer: null
        };

        button.textContent = label;
        button.classList.add(ARMED_CLASS);
        button.setAttribute?.("aria-pressed", "true");
        writeAttribute(
            button,
            "aria-label",
            typeof settings.ariaLabel === "string" && settings.ariaLabel.trim()
                ? settings.ariaLabel.trim()
                : label
        );
        writeAttribute(
            button,
            "title",
            typeof settings.title === "string" && settings.title.trim()
                ? settings.title.trim()
                : label
        );

        entry.timer = setTimeout(function () {
            disarm(button);
            if (typeof settings.onExpire === "function") {
                settings.onExpire(button);
            }
        }, ARM_TIMEOUT_MS);

        armedButtons.set(button, entry);

        if (typeof button.focus === "function") {
            button.focus();
        }

        if (typeof settings.onArm === "function") {
            settings.onArm(button);
        }

        return false;
    }


    /*
     * Klik di luar tombol yang menunggu konfirmasi = batal.
     * Listener dipasang di fase bubble supaya klik pada tombol
     * itu sendiri (yang baru saja dipersenjatai) tidak langsung
     * membatalkannya.
     */
    document.addEventListener("click", function (event) {
        if (!armedButtons.size) return;
        var target = event.target;

        Array.from(armedButtons.keys()).forEach(function (button) {
            if (target === button) return;
            if (typeof button.contains === "function" && button.contains(target)) return;
            disarm(button);
        });
    });


    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") disarmAll();
    });


    window.GENZInlineConfirm = Object.freeze({
        ARM_TIMEOUT_MS: ARM_TIMEOUT_MS,
        ARMED_CLASS: ARMED_CLASS,
        DEFAULT_LABEL: DEFAULT_LABEL,
        request: request,
        disarm: disarm,
        disarmAll: disarmAll,
        isArmed: isArmed
    });
})();
