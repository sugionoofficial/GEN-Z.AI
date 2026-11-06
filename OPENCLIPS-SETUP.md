# OpenClips Setup — GEN-Z.AI

Integrasi ini menghubungkan empat model Marketplace OpenClips ke registry, Admin, kredit, History, dan polling GEN-Z.AI. Semua operasi OpenClips dilakukan melalui **MCP Streamable HTTP** di `https://mcp.openclips.ai` (fallback resmi: `https://mcp.openclips.ai/mcp`). Generation tidak dikirim langsung dari GEN-Z.AI ke `api.openclips.ai`; route OpenAPI dipanggil melalui tool MCP `call_api` bila diperlukan.

## 1. Database

Jalankan berurutan pada project Supabase production:

1. `supabase/openclips-oauth-tokens.sql`
2. `supabase/openclips-provider-models.sql`

SQL bersifat idempoten. Seed model mempertahankan credit dan status yang telah diubah admin. Tidak ada credential yang disertakan dalam SQL.

Tabel `public.openclips_oauth_tokens` adalah vault refresh token rotating. Tabel ini terpisah dari vault Opus, menggunakan RLS tanpa akses browser, dan hanya dapat diakses service role. Isi token dienkripsi AES-256-GCM oleh Worker sebelum disimpan.

## 2. Credential melalui OAuth browser (disarankan)

1. Pastikan Worker dan kedua route berikut telah dideploy:
   - `/api/openclips-oauth-login`
   - `/api/openclips-oauth-callback`
2. Buka `/api/openclips-oauth-login` pada origin production GEN-Z.AI.
3. Pilih **Lanjut login ke OpenClips**, lalu izinkan akses pada halaman resmi OpenClips.
4. Setelah callback berhasil, salin seluruh JSON credential.
5. Buka **Admin → Providers → OpenClips**, tempel JSON pada field credential/API key, lalu simpan.

Flow memakai discovery OAuth resmi, Dynamic Client Registration, authorization code, PKCE S256, state HMAC, dan verifikasi token ke MCP. Callback tidak menyimpan atau mencetak token ke log; admin memilih sendiri credential yang akan disimpan melalui form provider yang sudah terenkripsi.

Untuk slot secret tambahan, gunakan `/api/openclips-oauth-login?slot=2`, `?slot=3`, dan seterusnya. Slot 1 memakai `OPENCLIPS_AUTH_TOKEN`; slot 2 memakai `OPENCLIPS_AUTH_TOKEN_2`, dan seterusnya.

Credential mentah berupa API key/Bearer token juga diterima. Jangan memakai credential contoh atau token palsu untuk verifikasi live.

## 3. Environment Worker

Credential dapat disimpan di Admin Providers atau environment. Jika keduanya tersedia, keduanya digabung menjadi pool dengan deduplikasi; credential database dibaca lebih dahulu.

Nama credential yang dikenali:

- Tunggal: `OPENCLIPS_AUTH_TOKEN`, `OPENCLIPS_ACCESS_TOKEN`, `OPENCLIPS_API_KEY`, `OPENCLIPS_TOKEN`, `OPENCLIPS_KEY`, atau `OPENCLIPS_SECRET`.
- Pool JSON/newline/comma: bentuk jamak seperti `OPENCLIPS_AUTH_TOKENS`, `OPENCLIPS_API_KEYS`, atau `OPENCLIPS_KEY_POOL`.
- Slot bernomor: misalnya `OPENCLIPS_AUTH_TOKEN_2` atau `OPENCLIPS_API_KEY_2`.

Konfigurasi pendukung:

```dotenv
# Pilih salah satu credential; jangan isi nilai contoh ini di production.
OPENCLIPS_AUTH_TOKEN=<api-key-bearer-atau-json-oauth>

# Wajib bila akun memiliki beberapa workspace dan pilihan tidak disimpan di JSON.
OPENCLIPS_WORKSPACE_ID=<workspace-integer-id>

# Opsional; default https://mcp.openclips.ai.
OPENCLIPS_MCP_URL=https://mcp.openclips.ai

# Opsional tetapi disarankan: secret acak khusus state OAuth.
OPENCLIPS_LOGIN_STATE_SECRET=<random-long-secret>
```

Untuk JSON OAuth per slot, pasangan berikut juga dikenali dengan suffix yang sama, misalnya `_2`:

- `OPENCLIPS_REFRESH_TOKEN_2`
- `OPENCLIPS_CLIENT_ID_2`
- `OPENCLIPS_CLIENT_SECRET_2`
- `OPENCLIPS_TOKEN_ENDPOINT_2`
- `OPENCLIPS_RESOURCE_2`
- `OPENCLIPS_SCOPE_2`
- `OPENCLIPS_MCP_URL_2`
- `OPENCLIPS_WORKSPACE_ID_2`

`PROVIDER_CREDENTIAL_ENCRYPTION_KEY` yang sudah ada dipakai untuk credential provider, state OAuth (bila secret khusus tidak diisi), dan derivasi kunci vault. Service role tetap wajib untuk akses vault. `OPENCLIPS_DISABLE_SUPABASE_VAULT=1` hanya untuk test/lokal; jangan aktifkan di production karena rotasi lintas isolate memerlukan vault persisten.

## 4. Model yang terdaftar

| GEN-Z.AI model ID | Model upstream | Media | Kontrak adapter |
|---|---|---|---|
| `openclips-seedance-2.5` | `seedance-2.5` | Video | 4–30 detik (integer), 480p/720p/1080p, maksimal 30 gambar, MP4/MOV |
| `openclips-seedance-2.0` | `seedance-2.0` | Video | 4–15 detik (integer), 480p/720p/1080p, maksimal 30 gambar |
| `openclips-seedream-5.0-pro` | `seedream-5.0-pro` | Gambar | Maksimal 10 gambar referensi, 1K/1.5K/2K, PNG/JPEG |
| `openclips-seedream-5.0-flash` | `seedream-5.0-flash` | Gambar | Maksimal 10 gambar referensi, 1K/1.5K/2K, PNG/JPEG |

Rasio Seedance yang dibuka: `9:16`, `16:9`, `1:1`, `4:3`, `3:4`, `21:9`. Rasio Seedream: `1:1`, `9:16`, `16:9`. Seedance 2.0 memiliki opsi 4K upstream, tetapi belum dibuka karena credit engine GEN-Z.AI saat ini hanya memiliki tariff 480p/720p/1080p.

Nilai `credit_*` pada seed adalah harga jual internal GEN-Z.AI yang dapat diedit admin, bukan tarif upstream OpenClips. Sebelum dispatch, adapter selalu meminta `preview_cost` dengan body yang sama persis seperti body generation. Jika saldo upstream tidak cukup, generation tidak dikirim; bila ada credential pool, credential berikutnya dapat dicoba.

## 5. Alur generation dan polling

Urutan create adalah:

1. MCP `initialize` + `notifications/initialized`.
2. `tools/list` dengan pagination.
3. `list_my_workspaces` dan pemilihan workspace.
4. `marketplace_models` untuk membaca kontrak live bila tool tersedia.
5. `preview_cost` melalui MCP `call_api`.
6. `generate_marketplace_proxy`, atau route Marketplace yang sama melalui MCP `call_api`.
7. Simpan task ID `openclips:v1:<workspace>:<creative>:<key-slot>`.

Polling memakai `get_creative`, atau read route creative melalui MCP `call_api`. ID workspace/creative dikonversi kembali ke integer sesuai JSON Schema tool. URL hasil hanya dianggap terminal pada status sukses; URL yang muncul ketika masih processing tidak dibocorkan sebagai hasil selesai. Status `success` tanpa URL media tetap diperlakukan sebagai processing sampai URL benar-benar tersedia.

Mapper argumen membaca schema dari `tools/list`, termasuk `$ref`, `allOf`, `oneOf`/`anyOf`, constraint `const`/`enum`, alias field, dan tipe numerik. Karena schema live belum dapat diverifikasi tanpa credential, verifikasi `tools/list` dengan credential nyata tetap merupakan langkah go-live wajib.

## 6. Test dan build

```bash
node --test tests/openclips-*.test.mjs
npm test
npm run build
```

Test OpenClips memakai MCP/API palsu dan tidak memerlukan credential production. Cakupannya meliputi schema mapping, numeric ID, OAuth PKCE/discovery/callback, refresh rotation, AES-GCM vault, credential pool, preview-before-generate, body preview/generate yang identik, insufficient balance, auth tool error, status processing/success, registry API/Admin, dan Worker routes.

## 7. Checklist go-live dengan credential nyata

- [ ] SQL vault dan model sudah diterapkan; empat model aktif dan credit internal sudah direview admin.
- [ ] `/api/openclips-oauth-login` menyelesaikan OAuth dan callback tanpa token pada log.
- [ ] `tools/list` live cocok dengan mapper; root atau `/mcp` yang aktif sudah terkonfirmasi.
- [ ] Workspace tunggal terpilih, atau `OPENCLIPS_WORKSPACE_ID` sudah diisi untuk akun multi-workspace.
- [ ] Preview dan submit berhasil dengan body identik untuk satu image dan satu video berbiaya kecil.
- [ ] Polling berubah dari queued/processing menjadi success dan History menerima URL hasil.
- [ ] Refresh token rotating tetap dapat dipakai pada request berikutnya dan vault berisi ciphertext, bukan token plaintext.
- [ ] Skenario saldo upstream kurang berhenti sebelum generation atau berotasi ke credential berikutnya sesuai konfigurasi pool.

Tanpa credential OpenClips yang sah, test live OAuth, generation, biaya upstream, dan polling tidak dapat dinyatakan berhasil hanya dari unit test.
