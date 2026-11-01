/* =========================================================
   GEN-Z.AI — OPUSCLIP MOTION UI REMOTION TEMPLATES CATALOG
   ---------------------------------------------------------
   File:
     provider/opusclip/motion-ui-templates.js

   100% browser-safe ES module (TANPA impor `node:*` / `lib/**`).
   Berisi 6 template Motion UI terinspirasi langsung dari
   `opus-pro/opusclip-video-tools` (Tovo SaaS, Website Builder,
   Kinetic Manifesto, Brand App Spotlight, Bento Metrics Campaign,
   Diagonal Product Carousel), lengkap dengan validasi properti,
   resolusi aspek rasio, dan fungsi kurva spring ala Remotion.
========================================================= */

export const MOTION_UI_ASPECT_CONFIGS = Object.freeze({
    "16:9": { width: 1920, height: 1080, label: "Landscape 16:9 (1920×1080)" },
    "9:16": { width: 1080, height: 1920, label: "Shorts/Reels 9:16 (1080×1920)" },
    "1:1": { width: 1080, height: 1080, label: "Square 1:1 (1080×1080)" }
});

export const MOTION_UI_SUPPORTED_DURATIONS = Object.freeze([8, 10, 15]);

export const MOTION_UI_TEMPLATES = Object.freeze([
    {
        id: "tovo-saas-launch",
        name: "Tovo SaaS Launch Card",
        category: "Product Launch",
        inspiration: "opusclip-video-tools / templates/tovo",
        description: "Animasi peluncuran produk SaaS bergaya glassmorphism dengan mockup dashboard mengambang, badge rilis, dan transisi spring halus.",
        defaultAccent: "#22c55e",
        defaultSecondary: "#06b6d4",
        defaults: {
            brandName: "GEN-Z.AI STUDIO",
            badgeText: "NEW RELEASE 2.0",
            headline: "Ubah Ide Menjadi Video Viral Dalam Hitungan Detik",
            subheadline: "Otomatisasi AI Clipping, Dubbing Lintas Bahasa, dan Motion UI dalam satu alur kerja terpadu.",
            ctaText: "Mulai Sekarang →",
            metric1Label: "Kecepatan Render",
            metric1Value: "10× Lebih Cepat",
            metric2Label: "Skor Retensi",
            metric2Value: "98.4%",
            metric3Label: "Bahasa AI",
            metric3Value: "30+ Bahasa"
        }
    },
    {
        id: "website-builder-showcase",
        name: "Website & UI Builder Showcase",
        category: "UI Walkthrough",
        inspiration: "opusclip-video-tools / templates/website-builder",
        description: "Frame browser modern dengan kursor interaktif, blok komponen tersusun bertahap, dan highlight fitur utama produk web Anda.",
        defaultAccent: "#6366f1",
        defaultSecondary: "#ec4899",
        defaults: {
            brandName: "NEXUS BUILDER",
            badgeText: "INTERACTIVE UI DEMO",
            headline: "Desain Antarmuka Kelas Dunia Tanpa Hambatan Teknis",
            subheadline: "Komponen presisi, animasi responsif 60fps, dan publikasi instan ke seluruh kanal digital.",
            ctaText: "Coba Live Demo",
            metric1Label: "Lighthouse",
            metric1Value: "100 / 100",
            metric2Label: "Waktu Setup",
            metric2Value: "< 2 Menit",
            metric3Label: "Konversi",
            metric3Value: "+240%"
        }
    },
    {
        id: "brand-manifesto-kinetic",
        name: "Kinetic Brand Manifesto",
        category: "Kinetic Typography",
        inspiration: "opusclip-video-tools / templates/template-manifesto",
        description: "Tipografi kinetik kontras tinggi dengan ritme kata per adegan, garis aksen elektrik, dan penutup logo yang kuat.",
        defaultAccent: "#f59e0b",
        defaultSecondary: "#ef4444",
        defaults: {
            brandName: "VISIONARY LABS",
            badgeText: "BRAND MANIFESTO",
            headline: "Kreator Masa Depan Tidak Menunggu Inspirasi — Mereka Menciptakannya",
            subheadline: "Setiap frame dirancang untuk menghentikan scroll dalam 3 detik pertama.",
            ctaText: "Bergabung Bersama Kami",
            metric1Label: "Hook 3 Detik",
            metric1Value: "Maksimal",
            metric2Label: "Gaya Visual",
            metric2Value: "Bold Kinetic",
            metric3Label: "Resolusi",
            metric3Value: "Full HD 60fps"
        }
    },
    {
        id: "mobile-app-spotlight",
        name: "PF Brand App Spotlight",
        category: "Mobile App",
        inspiration: "opusclip-video-tools / remakes/opus-5.5/pf-brand-app",
        description: "Sorotan aplikasi mobile dengan bingkai smartphone dinamis, notifikasi melayang, dan kartu statistik pertumbuhan.",
        defaultAccent: "#10b981",
        defaultSecondary: "#3b82f6",
        defaults: {
            brandName: "PULSE MOBILE",
            badgeText: "AVAILABLE ON iOS & WEB",
            headline: "Kendali Penuh Studio Konten Langsung Dari Genggaman HP",
            subheadline: "Pantau performa klip, jadwalkan posting multi-platform, dan kelola kredit kapan pun.",
            ctaText: "Buka Aplikasi",
            metric1Label: "Rating Pengguna",
            metric1Value: "4.9 ★",
            metric2Label: "Uptime Cloud",
            metric2Value: "99.99%",
            metric3Label: "Sinkronisasi",
            metric3Value: "Real-Time"
        }
    },
    {
        id: "campaign-metrics-bento",
        name: "Bento Metrics & Growth Campaign",
        category: "Data & Analytics",
        inspiration: "opusclip-video-tools / remakes/opus-5.5/pf-camera-campaign",
        description: "Tata letak Bento Grid sinematik yang menampilkan angka pencapaian, grafik bar bertumbuh, dan pesan kampanye utama.",
        defaultAccent: "#a855f7",
        defaultSecondary: "#22d3ee",
        defaults: {
            brandName: "GROWTH ENGINE",
            badgeText: "Q4 IMPACT REPORT",
            headline: "Pertumbuhan Eksponensial Dengan Strategi Video Berbasis Data",
            subheadline: "Gabungkan analitik virality score dengan distribusi otomatis ke YouTube, TikTok, dan Reels.",
            ctaText: "Lihat Studi Kasus",
            metric1Label: "Total Tayangan",
            metric1Value: "12.8 Juta+",
            metric2Label: "Engagement",
            metric2Value: "4.7× Lipat",
            metric3Label: "ROI Kampanye",
            metric3Value: "+380%"
        }
    },
    {
        id: "diagonal-product-carousel",
        name: "Diagonal Showcase Carousel",
        category: "E-Commerce & Portfolio",
        inspiration: "opusclip-video-tools / remakes/opus-5.5/pf-carousel-diagonal",
        description: "Kartu showcase bergerak miring secara sinematik dengan pencahayaan gradien neon dan callout penawaran spesial.",
        defaultAccent: "#ec4899",
        defaultSecondary: "#8b5cf6",
        defaults: {
            brandName: "AURA CREATIVE",
            badgeText: "FEATURED COLLECTION",
            headline: "Presentasikan Karya & Produk Premium Dengan Gerakan Memukau",
            subheadline: "Transisi diagonal halus yang menonjolkan identitas visual brand secara elegan.",
            ctaText: "Jelajahi Katalog",
            metric1Label: "Koleksi Aktif",
            metric1Value: "50+ Desain",
            metric2Label: "Format",
            metric2Value: "9:16 · 16:9 · 1:1",
            metric3Label: "Kualitas",
            metric3Value: "Studio Grade"
        }
    }
]);

export function getMotionUiTemplateById(templateId) {
    const clean = String(templateId || "").trim();
    return MOTION_UI_TEMPLATES.find(item => item.id === clean) || null;
}

function sanitizeHexColor(value, fallback) {
    const clean = String(value || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toLowerCase();
    return fallback;
}

function clampText(value, fallback, maxLen = 140) {
    const clean = String(value ?? "").trim();
    const chosen = clean || fallback || "";
    return chosen.slice(0, maxLen);
}

export function normalizeMotionUiJobInput(raw = {}) {
    const template = getMotionUiTemplateById(raw.templateId || raw.template_id);
    if (!template) {
        const err = new Error("Template Motion UI tidak ditemukan.");
        err.status = 400;
        throw err;
    }

    const aspectRatio = String(raw.aspectRatio || raw.aspect_ratio || "16:9").trim();
    const aspectCfg = MOTION_UI_ASPECT_CONFIGS[aspectRatio];
    if (!aspectCfg) {
        const err = new Error("Rasio aspek Motion UI harus '16:9', '9:16', atau '1:1'.");
        err.status = 400;
        throw err;
    }

    const reqDur = Number(raw.durationSec ?? raw.duration_sec ?? 10);
    const durationSec = MOTION_UI_SUPPORTED_DURATIONS.includes(reqDur) ? reqDur : 10;

    const rawProps = raw.props && typeof raw.props === "object" ? raw.props : raw;
    const d = template.defaults;

    const props = {
        brandName: clampText(rawProps.brandName, d.brandName, 48),
        badgeText: clampText(rawProps.badgeText, d.badgeText, 40),
        headline: clampText(rawProps.headline, d.headline, 120),
        subheadline: clampText(rawProps.subheadline, d.subheadline, 180),
        ctaText: clampText(rawProps.ctaText, d.ctaText, 36),
        accentColor: sanitizeHexColor(rawProps.accentColor, template.defaultAccent),
        secondaryColor: sanitizeHexColor(rawProps.secondaryColor, template.defaultSecondary),
        themeMode: rawProps.themeMode === "light" ? "light" : "dark",
        metrics: [
            {
                label: clampText(rawProps.metric1Label, d.metric1Label, 28),
                value: clampText(rawProps.metric1Value, d.metric1Value, 28)
            },
            {
                label: clampText(rawProps.metric2Label, d.metric2Label, 28),
                value: clampText(rawProps.metric2Value, d.metric2Value, 28)
            },
            {
                label: clampText(rawProps.metric3Label, d.metric3Label, 28),
                value: clampText(rawProps.metric3Value, d.metric3Value, 28)
            }
        ]
    };

    return {
        templateId: template.id,
        templateName: template.name,
        aspectRatio,
        width: aspectCfg.width,
        height: aspectCfg.height,
        durationSec,
        fps: 30,
        props
    };
}

export function springProgress(frame, fps = 30, delayFrames = 0, stiffness = 0.14) {
    const t = Math.max(0, (frame - delayFrames) / Math.max(1, fps));
    if (t <= 0) return 0;
    const omega = 9 * Math.max(0.05, stiffness) * 6;
    const damping = 0.78;
    const value = 1 - Math.exp(-damping * omega * t) * Math.cos(omega * 0.55 * t);
    return Math.max(0, Math.min(1.06, value));
}
