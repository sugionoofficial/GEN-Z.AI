import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import "../assets/js/topup-crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const TopupCrypto = globalThis.GENZ_TOPUP_CRYPTO;

function readRepoFile(relPath) {
    return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("TopupCrypto mendukung koin USDT, TRX, BTC, POL (Polygon), dan BNB Smart Chain", () => {
    const coinKeys = TopupCrypto.CRYPTO_COINS.map((c) => c.key);
    assert.deepEqual(coinKeys, ["usdt", "trx", "btc", "pol", "bnb"]);

    const cryptoMethodKeys = TopupCrypto.CRYPTO_METHODS.map((m) => m.key);
    assert.deepEqual(cryptoMethodKeys, [
        "usdt_bep20",
        "usdt_trc20",
        "usdt_polygon",
        "trx",
        "btc",
        "pol",
        "bnb"
    ]);

    assert.equal(TopupCrypto.isCryptoMethod("usdt_bep20"), true);
    assert.equal(TopupCrypto.isCryptoMethod("bnb"), true);
    assert.equal(TopupCrypto.isCryptoMethod("pol"), true);
    assert.equal(TopupCrypto.isCryptoMethod("bca"), false);
    assert.equal(TopupCrypto.isCryptoMethod("qris"), false);
});

test("parseCryptoAmount & formatCryptoAmount menangani titik/koma dan 8 desimal tanpa notasi ilmiah", () => {
    assert.equal(TopupCrypto.parseCryptoAmount("3.5"), 3.5);
    assert.equal(TopupCrypto.parseCryptoAmount("3,5"), 3.5);
    assert.equal(TopupCrypto.parseCryptoAmount("0,00005"), 0.00005);
    assert.equal(TopupCrypto.parseCryptoAmount("0.00000012"), 0.00000012);
    assert.equal(TopupCrypto.parseCryptoAmount("   "), null);
    assert.equal(TopupCrypto.parseCryptoAmount(""), null);

    assert.equal(Number.isNaN(TopupCrypto.parseCryptoAmount("0")), true);
    assert.equal(Number.isNaN(TopupCrypto.parseCryptoAmount("-5")), true);
    assert.equal(Number.isNaN(TopupCrypto.parseCryptoAmount("abc")), true);

    assert.equal(TopupCrypto.formatCryptoAmount(0.00005), "0.00005");
    assert.equal(TopupCrypto.formatCryptoAmount(3.5), "3.5");
    assert.equal(TopupCrypto.formatCryptoAmount(22), "22");
    assert.equal(
        TopupCrypto.formatCryptoPriceWithSymbol(0.00005, "btc"),
        "0.00005 BTC"
    );
});

test("normalizeCryptoPrices & getPackageCryptoBadges mendukung hybrid package Rupiah + Crypto", () => {
    const normalized = TopupCrypto.normalizeCryptoPrices({
        usdt: "3,25",
        trx: 22,
        btc: "0.00005",
        pol: "",
        bnb: "0.0055",
        unknown: 999
    });

    assert.deepEqual(normalized, {
        usdt: 3.25,
        trx: 22,
        btc: 0.00005,
        bnb: 0.0055
    });

    const disabledBadges = TopupCrypto.getPackageCryptoBadges({
        crypto_enabled: false,
        crypto_prices: normalized
    });
    assert.deepEqual(disabledBadges, []);

    const enabledBadges = TopupCrypto.getPackageCryptoBadges({
        crypto_enabled: true,
        crypto_prices: JSON.stringify(normalized)
    });
    assert.deepEqual(
        enabledBadges.map((b) => b.formatted),
        ["3.25 USDT", "22 TRX", "0.00005 BTC", "0.0055 BNB"]
    );
});

test("validateWalletAddress memvalidasi format EVM (0x), TRON (T), dan Bitcoin (bc1/1/3)", () => {
    const validEvm = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
    const validTron = "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";
    const validBtc = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

    assert.equal(
        TopupCrypto.validateWalletAddress("usdt_bep20", validEvm).valid,
        true
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("pol", validEvm).valid,
        true
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("bnb", validEvm).valid,
        true
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("trx", validTron).valid,
        true
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("usdt_trc20", validTron).valid,
        true
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("btc", validBtc).valid,
        true
    );

    assert.equal(
        TopupCrypto.validateWalletAddress("usdt_bep20", validTron).valid,
        false
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("trx", validEvm).valid,
        false
    );
    assert.equal(
        TopupCrypto.validateWalletAddress("btc", "0x1234").valid,
        false
    );
});

test("resolveAvailableMethodsForPackage menggabungkan Bank/QRIS + Crypto sesuai paket terpilih", () => {
    const activeRows = [
        {
            method: "bca",
            display_name: "BCA",
            account_number: "1234567890",
            account_name: "GENZ AI",
            is_active: true
        },
        {
            method: "qris",
            display_name: "QRIS",
            qr_image_url: "https://example.com/qris.png",
            is_active: true
        },
        {
            method: "usdt_bep20",
            display_name: "USDT (BNB Smart Chain)",
            account_number: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            account_name: "",
            is_active: true
        },
        {
            method: "trx",
            display_name: "TRX (TRON)",
            account_number: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
            account_name: "",
            is_active: true
        },
        {
            method: "bnb",
            display_name: "BNB (Smart Chain)",
            account_number: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            account_name: "",
            is_active: false
        }
    ];

    const idrOnlyMethods = TopupCrypto.resolveAvailableMethodsForPackage(
        activeRows,
        { crypto_enabled: false, crypto_prices: { usdt: 3.5, trx: 22 } }
    );
    assert.deepEqual(
        idrOnlyMethods.map((m) => m.method),
        ["bca", "qris"]
    );

    const hybridMethods = TopupCrypto.resolveAvailableMethodsForPackage(
        activeRows,
        {
            crypto_enabled: true,
            crypto_prices: { usdt: 3.5, bnb: 0.0055 }
        }
    );
    assert.deepEqual(
        hybridMethods.map((m) => m.method),
        ["bca", "qris", "usdt_bep20"]
    );
    assert.equal(hybridMethods[2].crypto_formatted, "3.5 USDT");
});

test("SQL schema & keempat halaman Top Up memuat integrasi Cryptocurrency end-to-end", () => {
    const sql = readRepoFile("supabase/topup-payment-methods.sql");
    assert.match(sql, /crypto_enabled\s+boolean/i);
    assert.match(sql, /crypto_prices\s+jsonb/i);
    for (const key of [
        "usdt_bep20",
        "usdt_trc20",
        "usdt_polygon",
        "trx",
        "btc",
        "pol",
        "bnb"
    ]) {
        assert.ok(sql.includes(`'${key}'`), `SQL harus memuat method ${key}`);
    }

    const adminTopupHtml = readRepoFile("admin-control/topup/index.html");
    assert.match(adminTopupHtml, /topup-crypto\.js/);
    assert.match(adminTopupHtml, /id="packageCryptoEnabled"/);
    assert.match(adminTopupHtml, /id="packageCryptoCoinsGrid"/);
    assert.match(adminTopupHtml, /saveSharedCryptoWalletsFromModal/);

    const paymentSettingsHtml = readRepoFile(
        "admin-control/topup/payment-settings.html"
    );
    assert.match(paymentSettingsHtml, /topup-crypto\.js/);
    assert.match(paymentSettingsHtml, /id="cryptoMethodCards"/);
    assert.match(paymentSettingsHtml, /id="saveAllCryptoBtn"/);

    const paymentReviewHtml = readRepoFile(
        "admin-control/topup/payment-review.html"
    );
    assert.match(paymentReviewHtml, /topup-crypto\.js/);
    assert.match(paymentReviewHtml, /crypto_amount/);
    assert.match(paymentReviewHtml, /tx_hash/);

    const userTopupHtml = readRepoFile("user/topup.html");
    assert.match(userTopupHtml, /topup-crypto\.js/);
    assert.match(userTopupHtml, /syncPaymentMethodOptions/);
    assert.match(userTopupHtml, /cryptoTxHashInput/);

    const landingHtml = readRepoFile("index.html");
    const paymentSectionMatch = landingHtml.match(
        /<section class="payment-methods"[\s\S]*?<\/section>/
    );
    assert.ok(paymentSectionMatch, "Landing page harus memiliki section .payment-methods");
    assert.match(paymentSectionMatch[0], /payment-brand-bca/);
    assert.match(paymentSectionMatch[0], /payment-brand-dana/);
    assert.match(paymentSectionMatch[0], /payment-brand-qris/);
    assert.match(paymentSectionMatch[0], /payment-brand-seabank/);
    assert.match(paymentSectionMatch[0], /payment-brand-crypto/);
    assert.match(paymentSectionMatch[0], /class="crypto-mark"[\s\S]*?<svg/);
    assert.match(paymentSectionMatch[0], /Crypto Currency/);
    assert.match(paymentSectionMatch[0], /USDT\s*•\s*TRX\s*•\s*BTC\s*•\s*POL\s*•\s*BNB/);
});

test("Seluruh inline script pada 4 halaman Top Up bebas dari syntax error", () => {
    const pages = [
        "admin-control/topup/index.html",
        "admin-control/topup/payment-settings.html",
        "admin-control/topup/payment-review.html",
        "user/topup.html"
    ];

    for (const relPath of pages) {
        const html = readRepoFile(relPath);
        const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        let inlineCount = 0;

        while ((match = scriptRegex.exec(html)) !== null) {
            inlineCount += 1;
            assert.doesNotThrow(() => {
                new vm.Script(match[1], { filename: relPath });
            }, `Inline script error pada ${relPath}`);
        }

        assert.ok(inlineCount >= 1, `${relPath} harus memiliki inline script`);
    }
});

test("Tabel riwayat Top Up tidak memakai pseudo-element tr::before yang menggeser kolom email ke kanan", () => {
    const rawCss = readRepoFile("admin-control/topup/assets/topup.css");
    const cssWithoutComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(
        cssWithoutComments,
        /\btr(?::hover|:active|:focus-within)?::(?:before|after)\b/,
        "tr::before / tr:hover::before pada tabel HTML membuat anonymous table-cell yang menggeser kolom ke kanan"
    );
    assert.match(
        cssWithoutComments,
        /\.table-wrap\s+tbody\s+tr:hover\s+td:first-child\s*\{[\s\S]*?inset\s+2px\s+0\s+0\s+#ff6a00/
    );
});


