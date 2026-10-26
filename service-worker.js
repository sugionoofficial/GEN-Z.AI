/* =========================================================
   SERVICE WORKER GEN-Z.AI
   ---------------------------------------------------------
   Tujuan utama: halaman HTML SELALU diperbarui dari jaringan
   setiap kali dinavigasi, sehingga setelah deploy baru,
   refresh biasa langsung menampilkan desain terbaru — bukan
   halaman basi dari cache browser/WebView.

   Triknya: permintaan HTML dikirim ulang dengan
   `cache: "no-cache"` yang MEMAKSA browser menanyakan ulang
   ke server (cache lama hanya boleh dipakai jika server
   bilang isinya masih sama).

   Aset (gambar/CSS/JS) dan API tidak disentuh — diteruskan
   apa adanya. Tidak ada HTML yang disimpan di Cache API,
   supaya tidak ada lagi halaman lama yang "nempel".
   ========================================================= */

self.addEventListener("install", (event) => {
    // Aktif segera tanpa menunggu tab lama ditutup.
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    // Langsung mengendalikan halaman yang sudah terbuka.
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;

    if (request.method !== "GET") return;

    const accept = request.headers.get("accept") || "";
    const isHtmlNavigation =
        request.mode === "navigate" || accept.includes("text/html");

    if (!isHtmlNavigation) return;

    event.respondWith(
        fetch(new Request(request, { cache: "no-cache" })).catch(() => {
            // Jaringan benar-benar tidak tersedia: laporkan apa adanya,
            // JANGAN menyajikan halaman basi dari cache.
            return new Response(
                "Offline: halaman tidak dapat dimuat. Periksa koneksi internet Anda.",
                {
                    status: 503,
                    headers: { "Content-Type": "text/plain; charset=utf-8" },
                }
            );
        })
    );
});
