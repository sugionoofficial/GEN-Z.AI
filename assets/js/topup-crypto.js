(function (root, factory) {
    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    if (root && typeof root === "object") {
        root.GENZ_TOPUP_CRYPTO = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const CRYPTO_COINS = Object.freeze([
        Object.freeze({
            key: "usdt",
            symbol: "USDT",
            label: "USDT (Tether)",
            shortName: "USDT",
            networksHint: "BEP-20 / TRC-20 / Polygon",
            placeholder: "Contoh: 3.5",
            decimals: 6
        }),
        Object.freeze({
            key: "trx",
            symbol: "TRX",
            label: "TRX (TRON)",
            shortName: "TRX",
            networksHint: "TRON (TRC-20)",
            placeholder: "Contoh: 22",
            decimals: 6
        }),
        Object.freeze({
            key: "btc",
            symbol: "BTC",
            label: "BTC (Bitcoin)",
            shortName: "BTC",
            networksHint: "Bitcoin (BTC)",
            placeholder: "Contoh: 0.00005",
            decimals: 8
        }),
        Object.freeze({
            key: "pol",
            symbol: "POL",
            label: "POL (Polygon)",
            shortName: "POL",
            networksHint: "Polygon POS",
            placeholder: "Contoh: 8.5",
            decimals: 6
        }),
        Object.freeze({
            key: "bnb",
            symbol: "BNB",
            label: "BNB (Smart Chain)",
            shortName: "BNB",
            networksHint: "BNB Smart Chain (BEP-20)",
            placeholder: "Contoh: 0.0055",
            decimals: 8
        })
    ]);

    const CRYPTO_COIN_MAP = Object.freeze(
        CRYPTO_COINS.reduce(function (acc, item) {
            acc[item.key] = item;
            return acc;
        }, {})
    );

    const FIAT_METHODS = Object.freeze([
        Object.freeze({
            key: "bca",
            title: "BCA",
            shortLabel: "BCA",
            type: "bank",
            network: "Bank Transfer"
        }),
        Object.freeze({
            key: "dana",
            title: "DANA",
            shortLabel: "DANA",
            type: "ewallet",
            network: "E-Wallet"
        }),
        Object.freeze({
            key: "seabank",
            title: "SeaBank",
            shortLabel: "SeaBank",
            type: "bank",
            network: "Bank Transfer"
        }),
        Object.freeze({
            key: "qris",
            title: "QRIS",
            shortLabel: "QRIS",
            type: "qris",
            network: "QRIS Nasional"
        })
    ]);

    const CRYPTO_METHODS = Object.freeze([
        Object.freeze({
            key: "usdt_bep20",
            coinKey: "usdt",
            symbol: "USDT",
            title: "USDT (BNB Smart Chain)",
            shortLabel: "USDT • BEP-20",
            badgeLabel: "USDT (BEP-20)",
            network: "BNB Smart Chain (BEP-20)",
            addressFamily: "evm",
            addressPlaceholder: "0x... (Alamat Wallet BEP-20 / BSC)",
            type: "crypto"
        }),
        Object.freeze({
            key: "usdt_trc20",
            coinKey: "usdt",
            symbol: "USDT",
            title: "USDT (TRON TRC-20)",
            shortLabel: "USDT • TRC-20",
            badgeLabel: "USDT (TRC-20)",
            network: "TRON (TRC-20)",
            addressFamily: "tron",
            addressPlaceholder: "T... (Alamat Wallet TRON TRC-20)",
            type: "crypto"
        }),
        Object.freeze({
            key: "usdt_polygon",
            coinKey: "usdt",
            symbol: "USDT",
            title: "USDT (Polygon)",
            shortLabel: "USDT • Polygon",
            badgeLabel: "USDT (Polygon)",
            network: "Polygon POS",
            addressFamily: "evm",
            addressPlaceholder: "0x... (Alamat Wallet Polygon POS)",
            type: "crypto"
        }),
        Object.freeze({
            key: "trx",
            coinKey: "trx",
            symbol: "TRX",
            title: "TRX (TRON)",
            shortLabel: "TRX • TRC-20",
            badgeLabel: "TRX (TRC-20)",
            network: "TRON (TRC-20)",
            addressFamily: "tron",
            addressPlaceholder: "T... (Alamat Wallet TRX / TRON)",
            type: "crypto"
        }),
        Object.freeze({
            key: "btc",
            coinKey: "btc",
            symbol: "BTC",
            title: "BTC (Bitcoin)",
            shortLabel: "BTC • Bitcoin",
            badgeLabel: "BTC (Bitcoin)",
            network: "Bitcoin (BTC)",
            addressFamily: "btc",
            addressPlaceholder: "bc1... / 1... / 3... (Alamat Wallet Bitcoin)",
            type: "crypto"
        }),
        Object.freeze({
            key: "pol",
            coinKey: "pol",
            symbol: "POL",
            title: "POL (Polygon)",
            shortLabel: "POL • Polygon",
            badgeLabel: "POL (Polygon)",
            network: "Polygon POS",
            addressFamily: "evm",
            addressPlaceholder: "0x... (Alamat Wallet Polygon POS)",
            type: "crypto"
        }),
        Object.freeze({
            key: "bnb",
            coinKey: "bnb",
            symbol: "BNB",
            title: "BNB (Smart Chain)",
            shortLabel: "BNB • BEP-20",
            badgeLabel: "BNB (BEP-20)",
            network: "BNB Smart Chain (BEP-20)",
            addressFamily: "evm",
            addressPlaceholder: "0x... (Alamat Wallet BNB Smart Chain BEP-20)",
            type: "crypto"
        })
    ]);

    const CRYPTO_METHOD_MAP = Object.freeze(
        CRYPTO_METHODS.reduce(function (acc, item) {
            acc[item.key] = item;
            return acc;
        }, {})
    );

    const FIAT_METHOD_MAP = Object.freeze(
        FIAT_METHODS.reduce(function (acc, item) {
            acc[item.key] = item;
            return acc;
        }, {})
    );

    const ALL_METHOD_KEYS = Object.freeze(
        FIAT_METHODS.map(function (m) {
            return m.key;
        }).concat(
            CRYPTO_METHODS.map(function (m) {
                return m.key;
            })
        )
    );

    function normalizeMethodKey(rawKey) {
        return String(rawKey || "")
            .trim()
            .toLowerCase();
    }

    function isCryptoMethod(methodKey) {
        const key = normalizeMethodKey(methodKey);
        return Boolean(CRYPTO_METHOD_MAP[key]);
    }

    function getCryptoMethodMeta(methodKey) {
        const key = normalizeMethodKey(methodKey);
        return CRYPTO_METHOD_MAP[key] || null;
    }

    function getFiatMethodMeta(methodKey) {
        const key = normalizeMethodKey(methodKey);
        return FIAT_METHOD_MAP[key] || null;
    }

    function getCoinMeta(coinKey) {
        const key = String(coinKey || "")
            .trim()
            .toLowerCase();
        return CRYPTO_COIN_MAP[key] || null;
    }

    function parseCryptoAmount(raw) {
        if (raw === null || raw === undefined) {
            return null;
        }

        if (typeof raw === "number") {
            if (!Number.isFinite(raw) || raw <= 0) {
                return NaN;
            }
            return Number(raw.toFixed(8));
        }

        const trimmed = String(raw).trim();

        if (!trimmed) {
            return null;
        }

        const normalized = trimmed.replace(/,/g, ".");

        if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
            if (/^\d+(\.\d+)?$/.test(normalized)) {
                const parsedLong = Number(normalized);
                if (!Number.isFinite(parsedLong) || parsedLong <= 0) {
                    return NaN;
                }
                const rounded = Number(parsedLong.toFixed(8));
                return rounded > 0 ? rounded : NaN;
            }
            return NaN;
        }

        const parsed = Number(normalized);

        if (!Number.isFinite(parsed) || parsed <= 0) {
            return NaN;
        }

        return Number(parsed.toFixed(8));
    }

    function formatCryptoAmount(value, maxDecimals) {
        const limit =
            Number.isInteger(maxDecimals) && maxDecimals >= 0 && maxDecimals <= 8
                ? maxDecimals
                : 8;

        const num =
            typeof value === "number"
                ? value
                : parseCryptoAmount(value);

        if (num === null || !Number.isFinite(num) || num <= 0) {
            return "";
        }

        const fixed = num.toFixed(limit);
        return fixed.replace(/\.?0+$/, "");
    }

    function formatCryptoPriceWithSymbol(value, symbol) {
        const formatted = formatCryptoAmount(value, 8);
        if (!formatted) {
            return "";
        }
        const cleanSymbol = String(symbol || "").trim().toUpperCase();
        return cleanSymbol ? formatted + " " + cleanSymbol : formatted;
    }

    function normalizeCryptoPrices(rawPrices) {
        let source = rawPrices;

        if (typeof source === "string") {
            const trimmed = source.trim();
            if (!trimmed) {
                return {};
            }
            try {
                source = JSON.parse(trimmed);
            } catch (_err) {
                return {};
            }
        }

        if (!source || typeof source !== "object" || Array.isArray(source)) {
            return {};
        }

        const result = {};

        CRYPTO_COINS.forEach(function (coin) {
            const candidate =
                source[coin.key] !== undefined
                    ? source[coin.key]
                    : source[coin.symbol];

            const parsed = parseCryptoAmount(candidate);
            if (parsed !== null && Number.isFinite(parsed) && parsed > 0) {
                result[coin.key] = parsed;
            }
        });

        return result;
    }

    function hasAnyCryptoPrice(rawPrices) {
        const normalized = normalizeCryptoPrices(rawPrices);
        return Object.keys(normalized).length > 0;
    }

    function getPackageCryptoBadges(pkg) {
        if (!pkg || pkg.crypto_enabled !== true) {
            return [];
        }

        const prices = normalizeCryptoPrices(pkg.crypto_prices);
        const badges = [];

        CRYPTO_COINS.forEach(function (coin) {
            const amount = prices[coin.key];
            if (Number.isFinite(amount) && amount > 0) {
                badges.push({
                    coinKey: coin.key,
                    symbol: coin.symbol,
                    amount: amount,
                    formatted: formatCryptoPriceWithSymbol(amount, coin.symbol)
                });
            }
        });

        return badges;
    }

    function validateWalletAddress(methodKey, rawAddress) {
        const meta = getCryptoMethodMeta(methodKey);
        const address = String(rawAddress || "").trim();

        if (!meta) {
            return {
                valid: Boolean(address),
                address: address,
                error: address ? "" : "Nomor tujuan pembayaran wajib diisi."
            };
        }

        if (!address) {
            return {
                valid: false,
                address: "",
                error: "Alamat wallet untuk " + meta.title + " wajib diisi."
            };
        }

        if (/\s/.test(address)) {
            return {
                valid: false,
                address: address,
                error:
                    "Alamat wallet " +
                    meta.title +
                    " tidak boleh mengandung spasi."
            };
        }

        if (meta.addressFamily === "evm") {
            if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
                return {
                    valid: false,
                    address: address,
                    error:
                        "Alamat wallet " +
                        meta.title +
                        " harus berformat EVM 0x... (42 karakter hex)."
                };
            }
            return { valid: true, address: address, error: "" };
        }

        if (meta.addressFamily === "tron") {
            if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
                return {
                    valid: false,
                    address: address,
                    error:
                        "Alamat wallet " +
                        meta.title +
                        " harus berformat TRON T... (34 karakter Base58)."
                };
            }
            return { valid: true, address: address, error: "" };
        }

        if (meta.addressFamily === "btc") {
            const isBech32 = /^bc1[ac-hj-np-z02-9]{11,71}$/i.test(address);
            const isLegacyOrP2sh = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(
                address
            );
            if (!isBech32 && !isLegacyOrP2sh) {
                return {
                    valid: false,
                    address: address,
                    error:
                        "Alamat wallet Bitcoin (BTC) harus diawali bc1, 1, atau 3 yang valid."
                };
            }
            return { valid: true, address: address, error: "" };
        }

        return { valid: true, address: address, error: "" };
    }

    function formatPaymentMethodLabel(methodKey, paymentRow) {
        const key = normalizeMethodKey(methodKey);
        const fiat = getFiatMethodMeta(key);
        if (fiat) {
            return fiat.title;
        }

        const crypto = getCryptoMethodMeta(key);
        if (crypto) {
            return crypto.badgeLabel;
        }

        if (paymentRow && paymentRow.crypto_symbol) {
            const sym = String(paymentRow.crypto_symbol).toUpperCase();
            const net = String(paymentRow.crypto_network || "").trim();
            return net ? sym + " (" + net + ")" : sym;
        }

        return key ? key.toUpperCase() : "-";
    }

    function formatPaymentCryptoSummary(paymentRow) {
        if (!paymentRow || typeof paymentRow !== "object") {
            return "";
        }

        const meta = getCryptoMethodMeta(paymentRow.payment_method);
        const symbol = String(
            paymentRow.crypto_symbol || (meta ? meta.symbol : "") || ""
        )
            .trim()
            .toUpperCase();
        const network = String(
            paymentRow.crypto_network || (meta ? meta.network : "") || ""
        ).trim();
        const amount = parseCryptoAmount(paymentRow.crypto_amount);

        if (!symbol && !meta) {
            return "";
        }

        const amountText =
            amount !== null && Number.isFinite(amount) && amount > 0
                ? formatCryptoPriceWithSymbol(amount, symbol || "CRYPTO")
                : symbol || (meta ? meta.badgeLabel : "");

        if (network && amountText) {
            return amountText + " • " + network;
        }

        return amountText || network;
    }

    function resolveAvailableMethodsForPackage(rawMethods, selectedPkg) {
        const list = Array.isArray(rawMethods) ? rawMethods : [];
        const pkgCryptoEnabled = Boolean(
            selectedPkg && selectedPkg.crypto_enabled === true
        );
        const pkgPrices = pkgCryptoEnabled
            ? normalizeCryptoPrices(selectedPkg.crypto_prices)
            : {};

        const methodIndex = {};
        list.forEach(function (row) {
            if (!row || typeof row !== "object") {
                return;
            }
            const key = normalizeMethodKey(row.method);
            if (key) {
                methodIndex[key] = row;
            }
        });

        const resolved = [];

        ALL_METHOD_KEYS.forEach(function (methodKey) {
            const row = methodIndex[methodKey];
            if (!row || row.is_active !== true) {
                return;
            }

            const cryptoMeta = getCryptoMethodMeta(methodKey);
            if (!cryptoMeta) {
                const fiatMeta = getFiatMethodMeta(methodKey);
                const accountNumber = String(row.account_number || "").trim();
                const qrImageUrl = String(row.qr_image_url || "").trim();

                if (methodKey === "qris" && !qrImageUrl) {
                    return;
                }
                if (methodKey !== "qris" && !accountNumber) {
                    return;
                }

                resolved.push({
                    method: methodKey,
                    display_name:
                        String(row.display_name || "").trim() ||
                        (fiatMeta ? fiatMeta.title : methodKey.toUpperCase()),
                    account_number: accountNumber,
                    account_name: String(row.account_name || "").trim(),
                    qr_image_url: qrImageUrl,
                    network:
                        String(row.network || "").trim() ||
                        (fiatMeta ? fiatMeta.network : ""),
                    asset_symbol: "IDR",
                    is_active: true,
                    is_crypto: false,
                    coin_key: null,
                    crypto_amount: null,
                    crypto_formatted: ""
                });
                return;
            }

            if (!pkgCryptoEnabled) {
                return;
            }

            const walletAddress = String(row.account_number || "").trim();
            if (!walletAddress) {
                return;
            }

            const coinAmount = pkgPrices[cryptoMeta.coinKey];
            if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
                return;
            }

            resolved.push({
                method: methodKey,
                display_name:
                    String(row.display_name || "").trim() || cryptoMeta.title,
                short_label: cryptoMeta.shortLabel,
                badge_label: cryptoMeta.badgeLabel,
                account_number: walletAddress,
                account_name: String(row.account_name || "").trim(),
                qr_image_url: String(row.qr_image_url || "").trim(),
                network:
                    String(row.network || "").trim() || cryptoMeta.network,
                asset_symbol: cryptoMeta.symbol,
                is_active: true,
                is_crypto: true,
                coin_key: cryptoMeta.coinKey,
                crypto_amount: coinAmount,
                crypto_formatted: formatCryptoPriceWithSymbol(
                    coinAmount,
                    cryptoMeta.symbol
                )
            });
        });

        return resolved;
    }

    return Object.freeze({
        CRYPTO_COINS: CRYPTO_COINS,
        FIAT_METHODS: FIAT_METHODS,
        CRYPTO_METHODS: CRYPTO_METHODS,
        ALL_METHOD_KEYS: ALL_METHOD_KEYS,
        normalizeMethodKey: normalizeMethodKey,
        isCryptoMethod: isCryptoMethod,
        getCryptoMethodMeta: getCryptoMethodMeta,
        getFiatMethodMeta: getFiatMethodMeta,
        getCoinMeta: getCoinMeta,
        parseCryptoAmount: parseCryptoAmount,
        formatCryptoAmount: formatCryptoAmount,
        formatCryptoPriceWithSymbol: formatCryptoPriceWithSymbol,
        normalizeCryptoPrices: normalizeCryptoPrices,
        hasAnyCryptoPrice: hasAnyCryptoPrice,
        getPackageCryptoBadges: getPackageCryptoBadges,
        validateWalletAddress: validateWalletAddress,
        formatPaymentMethodLabel: formatPaymentMethodLabel,
        formatPaymentCryptoSummary: formatPaymentCryptoSummary,
        resolveAvailableMethodsForPackage: resolveAvailableMethodsForPackage
    });
});
