# GEN-Z.AI Social Auto Publisher — setup

The Social Publisher is an admin-only feature for generating one reference-guided image per scheduled run and publishing it to a Facebook **Page**. A successful Page post also gets a share link for a person to manually share to a personal profile; publishing directly to a personal profile is not supported by the official Pages API.

## How the flow works

Studio Medsos supports two publishing modes side-by-side:

### A. Foto Karakter AI (`character` mode)
1. An admin uploads a character reference. The original reference is stored in a private Supabase Storage bucket.
2. An admin uploads one or more outfits for that character, each with a name and an optional HTTPS order link. At the scheduled time, the Worker picks one active outfit at random (skipping outfits used by the latest posts while another option exists), selects a scene combination (location, camera angle, outfit name, situation, and lighting), and calls the configured image provider with the character reference plus the chosen outfit reference.
3. The caption is composed from the base template, the AI sentence, the outfit block (`✨ Outfit: <name>` + `🛍️ Order di sini: <link>`), an optional random Facebook song reference block if enabled, the external link, and hashtags.

### B. Kata-kata Mutiara + Musik Auto-Play (`quote` mode — Postingan Beranda Page / Reels / Cerita)
1. No character reference or outfit is required, and **zero AI image quota is consumed**. Users can upload custom audio tracks (`.mp3`, `.m4a`, `.aac`) or downloaded Facebook Reels/Story videos (`.mp4` — audio extracted automatically) up to 16 MB into the private Supabase Storage bucket `social-story-audio`, or use the **8 built-in 15-second AAC-LC instrumental tracks** (`assets/audio/story-music/*.m4a`) ready out of the box.
2. On manual preview or scheduled run, the Worker picks a quote theme (e.g., Senja & Ketenangan, Semangat & Perjuangan, Syukur & Keikhlasan, Kopi & Refleksi Malam, etc.) and generates an original Indonesian quote (`quoteText`) using the **QwenCloud LLM model** configured in **Admin Panel → SET Studio Medsos** (`quote_llm_model`, default `qwen-plus`, with 16 QwenCloud LLM models and per-model tier quota tracking just like the QwenCloud image model selector).
3. The system programmatically composites the quote in razor-sharp centered vector typography plus a bottom-right poster signature (`quote by: <Page Name>`, e.g., `quote by: Irisbela Naresha Aurelia`) over a **solid pure black (`#000000`) 9:16 canvas** (`lib/social-publisher/story-video.js` + `story-font-data.js` — zero calls to image generation APIs), muxes it with the randomly chosen song audio (skipping back-to-back repeats) into a `540×960` H.264 + AAC/MP3 `.mp4`, and publishes according to `quote_publish_target` with **zero caption clutter, links, or hashtags**:
   - **`feed` (Default — Postingan Beranda Page)**: Permanent Page timeline post via `POST https://graph-video.facebook.com/{version}/{page-id}/videos` (`published=true`, no `description`, duration up to **60 seconds** following the song length) so the quote card + music appears on the Page's main feed/posts tab and auto-plays on scroll.
   - **`reels` (Facebook Reels + Beranda Page)**: `POST /{page-id}/video_reels` (`start` → `rupload.facebook.com` → `finish` with `video_state=PUBLISHED`, duration up to **60 seconds**).
   - **`story` (Cerita / Story 24 Jam)**: `POST /{page-id}/video_stories` (`start` → `rupload.facebook.com` → `finish`, duration capped at **25 seconds**).
   - **`feed_story` (Postingan Beranda + Cerita sekaligus)**: Publishes up to **60 seconds** to `videos` (Beranda Page) and automatically trims to **≤25 seconds** for `video_stories` (Cerita 24 Jam).

Generated images are sent directly to the Facebook Page photos endpoint and are **not stored in Supabase Storage**. The run record stores the prompt, scene/quote metadata, selected outfit or song, caption, Facebook post ID, permalink, status, and any error.

Schedules are saved as UTC timestamps derived from the selected **Asia/Jakarta (WIB)** time. The Worker checks the queue once per minute and posts one generated image for each due schedule.

## One-time setup

### 1. Apply the Supabase migration

Run `supabase/social-auto-publisher.sql`, `supabase/social-autopublish-per-user.sql`, `supabase/social-schedule-autopublish-scene.sql`, `supabase/social-quote-music.sql`, and `supabase/social-reference-storage.sql` in the Supabase SQL Editor. Existing installations must also run `supabase/social-image-provider-constraint.sql` whenever saving an image/text provider fails with code `23514` ("violates check constraint ..._image_provider_check"/`..._text_provider_check`): it is idempotent and widens both provider check constraints to the full list (Gemini, Cloudflare, QwenCloud, Tencent, Puter — old databases may reject even `tencent`). `supabase/social-quote-music.sql` (also rolled into `supabase/social-auto-publisher.sql` for fresh installs) creates `public.social_facebook_songs`, makes `social_post_schedules.character_id` nullable when `post_mode = 'quote'`, and adds `post_mode`, `quote_theme`, `quote_visual_style`, `use_random_song`, `quote_text`, `song_id`, `song_title`, `song_artist`, and `song_facebook_url` columns idempotently. The schedule file adds `social_post_schedules.autopublish_enabled` plus the per-schedule image parameters (`scene_location`, `camera_angle`, `scene_situation`, `scene_lighting`, `scene_atmosphere`, `scene_condition`, `scene_details`, `negative_prompt`) and redefines `claim_due_social_post_schedules` so a schedule only fires when its own switch, the account switch, and the platform master switch are all on. The per-user file adds `social_publisher_user_settings.autopublish_enabled` and redefines `claim_due_social_post_schedules` so each account controls only its own autopost; it is safe to run repeatedly, and an account without a settings row is treated as autopublish **on** so existing schedules keep running. The first file creates server-only tables with RLS, including the `social_outfits` library and the `outfit_id`/`outfit_name`/`outfit_order_url` columns on `social_post_runs`; the script is idempotent, so running it again upgrades an existing deployment. The storage file creates a dedicated private Storage bucket named `social-character-references`, limited to JPEG, PNG, and WebP references up to 8 MB. The Worker uses the existing Supabase service-role configuration to read and write these objects server-side. Do not make the bucket public.

### 2. Configure Google Gemini image generation

Create an API key for the Gemini Developer API and add it as a Worker secret:

```sh
npx wrangler@4 secret put GEMINI_API_KEY
```

Atur secret ini jika memilih Google Gemini. Provider Cloudflare Workers AI dan QwenCloud tidak memerlukan `GEMINI_API_KEY`.

The Gemini provider calls **Nano Banana 2 Lite** (`gemini-3.1-flash-lite-image`) and sends the character reference plus the outfit photo, so identity is preserved. Two facts matter before choosing it:

- **There is no free tier for image output.** Google lists the free-tier image price as "Not available" for every Nano Banana model; a project with billing and prepaid balance is required (~$0.0336 per 1K image). A key from a project without billing answers `402 Payment Required`, which the provider now reports as "tidak tersedia di tier gratis … billing aktif dan saldo prepaid" instead of a bare HTTP error.
- **Google Flow / Gemini app usage is not a supported integration path.** Those surfaces are free for humans, but they have no API: reaching them from this Worker would mean automating the web UI with someone's Google session, which Google's terms prohibit, breaks on every UI change, cannot handle unattended scheduled posts, and puts the whole Google account at risk. This project therefore only talks to official APIs.

Free image generation stays on Cloudflare Workers AI (FLUX.2 klein 4B/9B, free daily Neuron allowance) — that is the default provider.

### 2b. Configure QwenCloud image generation (optional)

Create an API key on the QwenCloud platform and add it as a Worker secret:

```sh
npx wrangler@4 secret put QWENCLOUD_API_KEY
```

QwenCloud uses the image generation catalog for edited images (default `qwen-image-3.0-pro`; the dropdown in **Admin Panel → SET Studio Medsos** lists all sixteen image-generation models: `qwen-image-3.0-pro`, `qwen-image-3.0`, `qwen-image-2.1-pro`, `qwen-image-2.1-turbo`, `qwen-image-2.0-pro`, `qwen-mt-image-2.0`, `wan2.7-image-pro`, `wan2.7-image`, `wan2.6-image`, `wan2.5-i2i-preview`, `wan2.6-t2i`, `wan2.5-t2i-preview`, `wan2.2-t2i-plus`, `wan2.2-t2i-flash`, `z-image-turbo`, and `vidu/vidu-image_reference2image`). Tier limits are seeded from each model's free quota (for example 10 images for qwen-image-3.0-pro, 50 for the wan2.7/2.6/2.5 family, 100 for wan2.2-t2i/z-image-turbo) and can be overridden per model. Images are requested through the DashScope-compatible endpoint at `https://maas.qwencloudapi.com/api/v1` (overridable with `QWENCLOUD_BASE_URL`) using each model family's wire protocol: the qwen-image family calls the synchronous `multimodal-generation/generation` endpoint, while wan/z-image/vidu models start with the asynchronous `image-generation/generation` endpoint (`X-DashScope-Async: enable` plus task polling); when a model rejects one protocol with the DashScope "url error, please check url" endpoint-mismatch error, the other protocol is retried once automatically. Captions use `qwen3-vl-plus`. The character reference photo is sent as a Base64 data URL; when an outfit is selected its photo is included as a second input image so the outfit is followed, and without an outfit the model keeps the clothing shown in the reference photo. Output size follows the chosen aspect ratio (`1152*2048` for 9:16, `2048*1152` for 16:9). Per-model price and rate limits are shown in the dropdown notes; check QwenCloud model availability, pricing, and quotas for your account before use.

### 2c. Configure Tencent Cloud Hy Image (optional, paid)

**Status jujur (Oktober 2026): Tencent bukan jalur gratis untuk gambar.** Di console TokenHub (Singapore → Online Inference → Vision Models) kuota **New User Free Trial hanya muncul untuk enam model `hy-3d-*`** (3D: format, retopology, rigging, texture, component, uv). Semua model gambar — `hy-image-v3.5-preview`, `wand-vega-image-1.5-pro`, `seedream-image-v5.0-flash` — tampil tanpa billing method, artinya perlu **postpaid** dulu, dan klaim trial/aktivasi postpaid **membekukan $10** di akun. Jalur gratis tetap Cloudflare Workers AI (10.000 neuron/hari).

Karena itu provider ini disediakan untuk uji coba berbayar, bukan untuk produksi gratis.

```sh
npx wrangler@4 secret put TENCENT_TOKENHUB_KEY
```

**Menaruh secret tanpa terminal (HP):** Cloudflare dashboard → **Workers & Pages → genzai → Settings → Variables and Secrets → Add → type Secret**, nama `TENCENT_TOKENHUB_KEY`, tempel key, lalu **Deploy**. Optional variables: `TENCENT_IMAGE_MODEL` (default `hy-image-v3.5-preview`; isi `hy-image-v3` bila akun hanya punya Hy-Image-3.0) dan `TENCENT_IMAGE_ENDPOINT`.

**Menguji tanpa curl:** tombol **Tes Tencent** di provider card memanggil model sekali memakai foto contoh wajah sungguhan sebagai referensi, lalu menampilkan ukuran, KB, durasi, atau error aslinya. Satu klik = satu gambar berbayar.

Two wire protocols are supported, chosen by the model name:

| Model | Endpoint | Body | Size |
|---|---|---|---|
| `hy-image-v3.5-preview` (default) | `/v1/wand/hunyuan-image/v35-generation` | Chat/Messages: `messages[0].content = [text, image_url…]` | 1080×1920 (9:16) / 1920×1080 (16:9), max 4K |
| `hy-image-v3` | `/v1/wand/hunyuan-image/v3-generation` | `{prompt, images[], size, revise}` | 576×1024 / 1024×576 (area ≤ 1.048.576) |

### 2d. Configure Puter.js (optional, User-Pays)

**Status jujur: bukan gratis tanpa batas.** Provider Puter memanggil driver
`puter-image-generation` milik Puter dengan token akun **Anda sendiri**. Setiap
gambar memotong kuota/biaya akun Puter Anda (model *User-Pays*), bukan kredit
GEN-Z.AI. Jatah bulanan akun gratis kecil dan tidak dipublikasikan angkanya
(lihat sisa jatah di `puter.com/dashboard#usage`); saat habis, generate gagal
dengan `insufficient_funds` — tidak ada gambar pengganti.

Buat akun Puter (disarankan Gmail; sebagian domain email ditolak filter
validasi Puter), lalu di `puter.com/dashboard#account` klik **Create token** dan
simpan token sebagai secret Worker:

```sh
npx wrangler@4 secret put PUTER_AUTH_TOKEN
```

**Menaruh secret tanpa terminal (HP):** Cloudflare dashboard → **Workers & Pages →
genzai → Settings → Variables and Secrets → Add → type Secret**, nama
`PUTER_AUTH_TOKEN`, tempel token, lalu simpan/deploy.

Optional variable: `PUTER_IMAGE_MODEL` (default `gemini-3.1-flash-image`).
Foto karakter + outfit dikirim sebagai `input_images` sehingga wajah tetap
menjadi acuan; keluaran 9:16 / 16:9 kualitas 1K. Caption & kata-kata mutiara
**tidak** memakai Puter (tetap provider teks).

**Menguji tanpa curl:** tombol **Tes Puter (1 gambar kuota akun Anda)** membuat
satu gambar sungguhan dengan foto contoh sebagai referensi, lalu menampilkan
ukuran, KB, durasi, atau error aslinya. Satu klik = satu kuota akun Puter Anda.

### 2e. Configure Opus Labs — Product Ad Studio (optional, OpusClip Credits)

**Status jujur: memakai saldo kredit akun OpusClip Anda sendiri.** Provider Opus
menghubungkan Studio Medsos ke ekosistem gambar **Opus Labs / Product Ad Studio**
(`https://product-ad-studio.labs.opus.pro/`) lewat server **Managed Media MCP**
resmi Opus Labs (`https://labs.opus.pro/opus-video-tools/mcp`, Streamable HTTP
JSON-RPC 2.0 dengan OAuth WorkOS AuthKit). Setiap gambar memotong saldo kredit
akun OpusClip operator sendiri (bukan kredit GEN-Z.AI). Saat kredit habis
(`credit_admission_rejected` / `insufficient_credits`) atau akun belum memiliki
akses beta Opus Labs, generate gagal secara jujur tanpa gambar pengganti.

Simpan Bearer token OAuth Opus Labs sebagai secret Worker:

```sh
npx wrangler@4 secret put OPUS_AUTH_TOKEN
```

`OPUS_AUTH_TOKEN` menerima:
- Bearer token string hasil otorisasi MCP (`claude mcp login` / `codex mcp login` terhadap `https://labs.opus.pro/opus-video-tools/mcp`), atau
- objek JSON kredensial OAuth (`{ "access_token", "refresh_token", "client_id", "expires_at" }`) — Worker otomatis menukar `refresh_token` ke `https://focused-horizon-38.authkit.app/oauth2/token` sebelum kedaluwarsa. Alternatifnya, simpan `OPUS_REFRESH_TOKEN` dan `OPUS_CLIENT_ID` sebagai secret terpisah.

Variabel opsional:
- `OPUS_IMAGE_MODEL` (default `seedream-5.0-pro`)
- `OPUS_PROJECT_ID` (menggunakan proyek Opus Labs yang sudah ada alih-alih `create_project` baru)
- `OPUS_MCP_URL` (override URL server MCP Opus Labs)
- `OPUS_API_URL` (mode endpoint HTTP JSON langsung bila Anda memakai proxy/gateway Product Ad Studio sendiri)

Foto karakter + outfit didaftarkan ke proyek lewat `import_assets` (termasuk
unggah signed URL `awaiting_upload` + finalisasi `assetId`), dibuat lewat
`generate_keyframes` (9:16 / 16:9), dan dipantau via `get_status` tanpa pernah
mengirim ulang job `submission_unknown` yang berisiko memotong kredit dua kali.
Caption & kata-kata mutiara **tidak** memakai Opus (tetap provider teks).

**Menguji tanpa curl:** tombol **Tes Opus (1 gambar kredit akun Anda)** membuat
satu gambar 9:16 sungguhan dengan foto contoh sebagai referensi, lalu menampilkan
ukuran, KB, durasi, atau error aslinya. Satu klik = satu gambar kredit akun OpusClip Anda.

The v3.5 answer is an `image.chat.completion.chunk` frame sequence; the Worker reads `choices[0].delta.image.url`, accepting both a single JSON body and `data:`-prefixed SSE lines, and reports an `error` frame (for example `content_filter`) as a rejection with its `request_id` instead of an empty image. Both models accept the character reference photo (and the outfit photo when one is selected), so the face stays anchored to the upload instead of being invented. Result URLs live 12 hours and may reject anonymous access, so the Worker downloads them (retrying with the Bearer header on 401/403) and re-checks the bytes with the blank-image guard.

**What the free Tencent quota is actually good for: text.** TokenHub gives every language model a New User Free Trial of **1 million tokens** (claim it in Model Gallery, or the platform auto-claims on the first call), while every image model stays paid. So the Worker uses Tencent for the copy and Cloudflare for the picture:

| Task | Model | Why |
|---|---|---|
| Contextual caption | `deepseek-v4.1-flash` (`TENCENT_CAPTION_MODEL`) | Has **Image Understanding**, so it reads the generated photo instead of inventing a scene |
| Quote text ("Kata-kata Mutiara") | `hy3` (`TENCENT_QUOTE_MODEL`) | Hunyuan Hy3 writes more natural Indonesian than the small 11B Cloudflare model |

**Image and text are chosen separately.** The provider card has a second radio group, *Provider penulisan teks*, backed by the `text_provider` column (`auto` | `tencent` | `cloudflare` | `gemini` | `qwencloud`). This is what lets the free combination work: images stay on Cloudflare Workers AI (10,000 Neurons/day) while the caption and quote text come from the free Tencent TokenHub trial quota. `auto` picks Tencent whenever `TENCENT_TOKENHUB_KEY` exists and otherwise falls back to whichever provider is making the image, so nothing changes for accounts without a Tencent key.

If the chosen text provider fails, the caption drops to Workers AI (and then to no caption, so the post still uploads) and quote mode drops to the Workers AI text model before reporting an error. When the `text_provider` column has not been applied yet, saving still stores the image provider and the admin page says explicitly that the text choice was **not** saved instead of pretending it was.

Both calls go to the OpenAI-compatible `POST https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions` with the same `TENCENT_TOKENHUB_KEY`, a 25 s timeout, and the same honest error mapping (401 key, 403/402 trial exhausted or model not activated, 404 model not claimed — the message names `TENCENT_CAPTION_MODEL` / `TENCENT_QUOTE_MODEL` so the fix is obvious). Override either model with a Worker variable; `TENCENT_TEXT_ENDPOINT` points elsewhere.

If the Tencent text call fails for any reason, the caption falls back to the Workers AI vision model, then to the text model, and finally to an empty caption (the post still uploads). Quote mode falls back to the Workers AI text model and only fails when neither Tencent nor Cloudflare is available — with a message that says Tencent Hy Image alone only makes images. Nothing is silently reported as success.

The six `hy-3d-*` models with Free Trial billing are **3D asset** models (format, retopology, rigging, texture, component, UV). They do not produce feed-ready photos and are not wired into this publisher.

Admins can choose Gemini, Cloudflare Workers AI, QwenCloud, or Tencent Cloud for image generation in **Admin Panel → SET Studio Medsos** (Tencent leaves captions to Cloudflare as described above). Gemini uses `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) for images and `gemini-3.8-flash` through the Interactions API for captions; this requires `GEMINI_API_KEY`.

**Cloudflare keeps the character consistent with the reference photo.** The character image pipeline is identity-first and never falls back to text-to-image (which would invent a new face):

1. `@cf/black-forest-labs/flux-2-klein-4b` — the reference photo is sent as `input_image_0` and the selected outfit as `input_image_1` through a multipart request, with a prompt that instructs the model to preserve face, skin tone, hair, and body. This is a first-party Workers AI model billed in Neurons, so it works on the free plan at roughly 14–25 character images per day (about 670 Neurons per 1024×1024 edit within the 10,000/day allowance). Input images must be smaller than 512×512, so the Worker downscales them first (JPEG via `jpeg-js`, PNG via `pngjs`; both are re-encoded to JPEG at max 512 px). Oversized WebP references cannot be decoded in the Worker and are reported in the fallback note.
2. `pruna/p-image-try-on` — optional, used only when step 1 fails. Third-party model billed through AI Gateway Unified Billing with prepaid credits; not covered by the free Neuron allocation. When it fails with a billing error (`2021: Insufficient AI Gateway credits`) the provider remembers that for 6 hours and skips the call on the next runs, so an account without credits does not pay the extra latency on every generation. Set the Worker variable `CLOUDFLARE_DISABLE_TRYON=1` to skip it entirely, or `CLOUDFLARE_TRYON_FIRST=1` to try it before FLUX.2.
3. `@cf/black-forest-labs/flux-2-klein-9b` — identity fallback using the same multipart protocol as 4B (prompt, width, height, `input_image_0..3`). More expensive per image (1,363.64 Neurons per first MP) but keeps the face consistent when 4B is unavailable or out of capacity. During testing it once answered `3043: Internal server error` and **recovered on the next provider test run**, confirming that error was transient rather than a plan restriction. If it fails with a transient error the fallback is skipped for 30 minutes so a broken fallback does not add latency to every run, and the cooldown clears automatically as soon as it succeeds again.

The primary model (4B) is retried **once** after 700 ms when it fails with a transient error (`3040` out of capacity, `3043`, 5xx). Configuration errors (`3030` invalid input, `404` unknown model) are not retried because they will never succeed. The provider test reports `identity_single_point: true` when 4B works but the fallback does not — that means a capacity outage on 4B leaves no identity path at all. It also reports `test_reference_source` (`sample-photo` or `synthetic`): the identity checks use Cloudflare's public example portrait so a real face is exercised, and fall back to a synthetic gradient only when that download fails.

`@cf/stabilityai/stable-diffusion-xl-base-1.0` is **not** used as an identity fallback: it is text-to-image only and rejects image input with `3030: Model input is not valid: input tensor image is not present in the model` (verified on a free account, October 2026). It remains only as a background fallback for the quote path, where no character is involved.

If all three fail, the run fails with a message that lists each model error; no image is published. Pruna returns a presigned URL (`result.image`), FLUX.2 and FLUX.1 return Base64, SDXL may return raw bytes or a stream — `readCloudflareImageResult` handles all of these.

Quote ("Kata-kata Mutiara") backgrounds have no character, so they still use `@cf/black-forest-labs/flux-1-schnell` (`prompt` + `steps` only) with `@cf/stabilityai/stable-diffusion-xl-base-1.0` as fallback for the requested aspect ratio (576×1024 or 1024×576).

Captions use `@cf/meta/llama-3.2-11b-vision-instruct`, fall back to `@cf/meta/llama-3.1-8b-instruct-fp8` without the image, and are skipped when both fail so the post still uploads. Use the **Tes Cloudflare AI** button in the provider card to run each model once and see the raw per-model error: `identity` (FLUX.2 klein 4B with a synthetic reference), `identity9b` (FLUX.2 klein 9B fallback), `t2i` (FLUX.1 schnell), `sdxl` (SDXL text-to-image, quote path) and `tryon` (Pruna, optional). The response reports `identity_ready`, `identity_fallback_ready`, `identity_chain_ready`, `identity_single_point`, `t2i_ready`, `sdxl_ready`, `try_on_ready`, `try_on_cooldown_minutes` and `identity_fallback_cooldown_minutes`.

Every model result is validated before use: if the returned PNG/JPEG is valid by format but nearly empty (a 2 KB PNG for a 576×1024 frame — standard deviation of luminance ≈ 0), the step is treated as failed and the chain moves on instead of publishing a blank image. The check only decodes files whose bytes-per-pixel ratio is suspicious (< 0.08), so normal images cost nothing.

Measured on a free Workers account (October 2026), healthy run: FLUX.2 klein 4B `identity` OK in ~4.9 s (459 KB JPEG), FLUX.2 klein 9B `identity9b` OK in ~3.0 s (500 KB JPEG), FLUX.1 schnell `t2i` OK in ~2.3 s (698 KB JPEG), SDXL `sdxl` (text-to-image only) OK in ~2.3 s (926 KB PNG), Pruna `tryon` fails with `2021: Insufficient AI Gateway credits` (expected without AI Gateway credits).

### "Permintaan gagal (HTTP 503)" while generating

That message meant "the response was not the JSON our API always sends", so the cause was invisible. Two things changed:

- the admin pages now read the response as text, print the status with the most likely cause, and include a short snippet of the real body (`admin-control/assets/js/http-failure.js`);
- the API handler always returns a non-empty `error` string, even when the underlying error object had no message, and logs the full detail on the Worker side.

A 503 that arrives **within a couple of seconds** of clicking usually means the Worker was being redeployed or the edge rejected the request — wait about a minute and try again; nothing was generated or charged. A 503 after a long wait means the request ran out of time. GET requests are retried once automatically; `manual-generate` and publish are deliberately **not** retried automatically so a slow response can never create two posts or spend the image quota twice.

### Keeping the face recognizable

The character path always runs the reference-conditioned model (`@cf/black-forest-labs/flux-2-klein-4b`), never a text-to-image model — you can confirm this per post in the run record (`image_model`). If a result does not look like the reference, the usual cause is the reference itself: a full-body photo downscaled to 512 px leaves the face about 40 px wide, and the outfit photo (often a catalogue shot of a *different* model) competes for the same "person" slot.

Three things address that now:

- **The prompt names each image explicitly** — image 1 is the person, image 2 is only the clothing, and the model is told not to copy the face or body of the clothing model.
- **A face crop is sent as an extra reference.** When the reference is a full-body shape (height/width ≥ 1.25), the top-centre region is cropped and passed as an additional input image, so the face arrives at a much larger effective size. Square/portrait close-ups are left alone.
- **The crop comes from the 1024 px reference, not the 512 px one.** Cloudflare now downloads the character photo through Supabase image transformations at `maxSide: 1024`; the full-body reference is still downscaled to 512 for `input_image_0`, but the face is cropped from the sharper 1024 px copy and then scaled to at most 512 px. On a 900×1400 upload the face reference went from ~238 px wide (cropped from the 384×512 copy) to 486×512. Decoding is capped at 4 MP so a huge upload can never trigger Error 1102 — above that cap the crop silently falls back to the 512 px copy. The provider test row reports `face_crop.source` (`original` or `downscaled`) and `face_crop.source_size`.

Set the Worker variable `CLOUDFLARE_IDENTITY_FACE_CROP = "0"` to compare results without the extra reference; the provider test row reports `face_crop` so you can see which images were actually sent.

The most effective change is still the upload itself: **use an upper-body or close-up portrait as the character reference**. FLUX.2 klein 4B is a small distilled model — it keeps hairstyle, skin tone, and general facial structure, but it is not a face-swap engine.

### Picture quality on the free path

FLUX.2 [klein] 4B is a distilled, latency-optimised model: the free path produces a *photographic-looking* image, not a camera-accurate portrait. Two limits are structural, not bugs:

- the reference photo sent as the whole-body input is downscaled to **512 px** on the long side because FLUX.2 klein requires input images below 512×512, so fine facial detail is reduced before the model ever sees it (the face crop described above is the workaround).

Character frames are now rendered at **768×1344** (9:16) or **1344×768** (16:9) by default — about 1.03 MP instead of 0.59 MP, which roughly doubles the pixels available for the face and stops skin from looking like a smooth render. The prompt also carries photographic direction (50 mm lens, natural skin with pores and fine hair, catchlight in the eyes, slight sensor noise, explicitly *no* beauty filter or airbrush, and explicit "not a 3D render/CGI/cartoon") because diffusion models follow photography terms far better than the word "realistic" alone.

Cost of that default: FLUX.2 klein is billed per output megapixel, so 768×1344 uses roughly 1,100 of the 10,000 daily Neurons per image (~8–9 character images/day) versus ~670 at 576×1024 (~14/day). Switch back with a Worker variable:

```
CLOUDFLARE_IDENTITY_RES = "lite"    # 576x1024 / 1024x576
```

For a custom size use `CLOUDFLARE_IDENTITY_SIZE = "832x1472"` (format `<width>x<height>`, each side 256–2048); an unusable value is ignored. Whatever size is requested, a *size* rejection from the model falls back automatically to 576×1024 and adds a warning to the run output — other errors (capacity, invalid input tensor) are **not** retried at another size, so a configuration problem never burns a second call.

SDXL once returned a 2 KB PNG for the same 576×1024 frame (reported as `OK` before the content check existed) and returned 926 KB on the next run, so that was a transient model fault rather than a configuration problem. The blank-image guard keeps that class of output from ever being reported as success again. At roughly 1,100 Neurons per 768×1344 FLUX.2 klein edit (670 at `lite`), the 10,000 Neuron daily allowance covers about 8–9 character images per day; once it is exhausted the run degrades to SDXL img2img instead of failing, and resets at 00:00 UTC.

When Cloudflare is selected, neither image generation nor contextual caption generation requires `GEMINI_API_KEY`. This implementation generates **one** image per run to limit usage. If the free daily Neuron allowance is exhausted, `@cf/...` requests fail until the quota resets at 00:00 UTC; the API maps that to HTTP 429 so the UI can show it.

### 3. Configure the Meta app and OAuth

Create a Meta app with the **Manage everything on your Page** use case. Do not use an app whose only use case is **Authenticate and request data from users with Facebook Login**: Meta marks those use cases incompatible, so Page permissions cannot be enabled on that app. Keep the old app until the replacement is verified.

In **Manage everything on your Page → Permissions and features**, keep the required `business_management` and `pages_show_list` permissions, and add `pages_read_engagement` and `pages_manage_posts`. Remove `pages_manage_metadata` and `pages_manage_engagement` if they are preselected: this publisher creates posts but does not manage Page settings, webhooks, or comments. The authorizing person must be able to perform the Page's `CREATE_CONTENT` task. Meta may require App Review / advanced access before the app can serve users beyond its own app roles.

This use case may add **Facebook Login for Business** automatically. Create a login configuration using a **User access token** (not a Business Integration System User token), select the Page assets and permissions the publisher needs, and copy its Configuration ID. The Worker uses that configuration to start OAuth without a runtime scope list. In **Facebook Login for Business → Settings**, add this exact redirect URI and validate it (replace it only if the production hostname changes):

```text
https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback
```

Keep `META_REDIRECT_URI` as a non-secret Worker variable in `wrangler.toml`. Store the replacement app credentials and login Configuration ID as Worker secrets; do not put secret values in browser code, source control, or chat:

```sh
npx wrangler@4 secret put META_APP_ID
npx wrangler@4 secret put META_APP_SECRET
npx wrangler@4 secret put META_LOGIN_CONFIG_ID
npx wrangler@4 secret put SOCIAL_TOKEN_ENCRYPTION_KEY
```

When switching to the replacement app, update `META_APP_ID` and `META_APP_SECRET` and set `META_LOGIN_CONFIG_ID` in the `genzai` Production environment. Keep the existing `SOCIAL_TOKEN_ENCRYPTION_KEY`; do not rotate it. `META_REDIRECT_URI` must exactly match the callback above.

Only if `SOCIAL_TOKEN_ENCRYPTION_KEY` has never been configured, generate a 32-byte key encoded as Base64, for example:

```sh
openssl rand -base64 32
```

Do not rotate the existing key while switching Meta apps. Page access tokens are encrypted with AES-GCM before being stored in Supabase; rotating the key makes previously stored tokens unreadable and requires reconnecting each Page.

### 3b. Data Deletion Request callback (required to publish the Meta app)

Meta requires a reachable **Data Deletion Request Callback URL** before an app can
be switched to Live mode. The Worker already exposes one; the endpoint verifies
Meta's `signed_request` with `META_APP_SECRET`, deletes the data the app received
from Facebook for the matching GEN-Z.AI account, and answers with a public status
page plus a confirmation code.

Apply the migration first (`supabase/social-auto-publisher.sql` creates
`social_facebook_identities` and `social_data_deletion_requests`), then enter this
URL in **Meta App Dashboard → App settings → Basic → Data Deletion Request URL**
(also shown as **Data deletion instructions URL** in some app versions):

```text
https://genzai.genzai-f37.workers.dev/api/facebook-data-deletion
```

The same handler is also mounted at `/api/data-deletion` in case the dashboard
field rejects a long path. Only `META_APP_SECRET` is required; it is already
configured as a Worker secret for OAuth.

What the endpoint returns:

- `POST` with the form field `signed_request` → `200 {"url": "...", "confirmation_code": "..."}`.
  Anything else (bad signature, missing `user_id`) returns `400`, and a missing
  `META_APP_SECRET` or missing table returns `503`. Meta only accepts this JSON
  shape, so do not change it.
- `GET ?code=<confirmation_code>` → public HTML status page (pending / completed /
  failed, number of removed rows, timestamps in WIB).
- `GET` without `code` → public instructions page that shows the callback URL.

Optionally set a contact channel shown on those public pages. These are
non-secret values, so add them to the existing `[vars]` block in `wrangler.toml`
and deploy:

```toml
[vars]
PRIVACY_CONTACT_EMAIL = "privacy@example.com"
# or: PRIVACY_CONTACT_URL = "https://example.com/privacy"
```

The page falls back to `PRIVACY_CONTACT_URL`, then to the in-app `/live-chat/`
support page, so leaving both unset is fine.

Deletion covers rows the app created from Facebook data: post runs, schedules,
Page connections, pending OAuth states, and the Facebook identity mapping. The
GEN-Z.AI account, saved characters, outfits, credits, and subscription are kept —
the person deletes their GEN-Z.AI account separately from the app.

### 3c. Basic app fields required by Meta

Before an app can be published, Meta's **App settings → Basic** also requires a
privacy policy URL, terms of service URL, and an app icon. Both pages ship in this
repository and are copied to `dist/` by the build script:

```text
Privacy policy URL:    https://genzai.genzai-f37.workers.dev/privacy/
Terms of service URL:  https://genzai.genzai-f37.workers.dev/terms/
App icon:              assets/genzai-app-icon-1024.png
```

The icon is a 1024×1024 PNG (about 23 KB, well under Meta's 5 MB limit) rendered
from `assets/genzai-app-icon.svg`, so it matches the site favicon and the PWA
manifest. Upload the file when Meta asks for the icon; the dashboard lets you
crop it to a square before saving.

Edit `privacy/index.html` or `terms/index.html` when the data practices change —
for example when a new AI provider is added — and keep the
`Berlaku <date>` chip and the `Versi` chip in sync with the change.

### 4. Confirm Worker configuration and deploy

The Worker reads reference images through the existing Supabase service-role configuration; no Cloudflare R2 binding or R2 subscription is required. `wrangler.toml` retains the one-minute Cron Trigger. Deploy the Worker after both Supabase SQL files have been applied:

```sh
npm run build
npx wrangler@4 deploy
```

Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` Worker configuration is required. The platform-wide master switch starts **off**. The queue will not publish until an admin connects a Page, creates an enabled schedule, and turns on autopublish for that account.

### Cloudflare Workers Builds preview command

The `dist/` directory is generated, not committed. For Workers Builds, keep Production configured with build command `node scripts/build-cloudflare-pages.mjs` and deploy command `npx wrangler deploy`. In **Previews Base**, use `npm run preview` as the Preview command; that script builds `dist/` before running `npx wrangler preview`. The package `postinstall` hook also detects Cloudflare Workers Builds on non-`main` branches and builds `dist/` before the Preview command, so branch previews remain resilient when the dashboard omits its optional Build command. To avoid duplicate work, the Previews Base Build command can be left empty. This affects branch previews only, not the Production deploy command.

### Connecting from a phone

The OAuth flow is a normal full-page redirect, so it works on phones as well as on
desktop — it is not desktop-only. Two phone-specific things break it:

- **In-app browsers.** Meta refuses to render the permission dialog inside embedded
  WebViews (Facebook, Instagram, Messenger, WhatsApp, TikTok, LINE, and similar).
  Opening the Studio link from inside those apps means the consent block never
  appears. Open the page in Chrome or Safari, sign in there, and press
  **Hubungkan Facebook** from that browser.
- **Splitting the flow across browsers.** The OAuth `state` cookie is bound to the
  browser that started the flow, so copying only the Facebook URL into another
  browser fails with `oauth_error=state`. Always start over from the Studio page in
  the browser that will finish the flow.

The Studio panel now detects in-app browsers and shows a warning with a
**Salin tautan halaman ini** button, and every connect attempt also reveals a manual
**Buka halaman izin Facebook** link in case the automatic redirect is blocked.

## Admin use

Open **Admin Control → Social Auto Publisher**:

1. Click **Hubungkan Facebook** and authorize the Pages you administer.
2. Upload a licensed/authorized reference photo; confirm the character is an adult or fictional non-child.
3. Open **Outfit & link order**, choose the character, then upload outfits with a name, photo, optional notes, and an HTTPS order link. Repeat for every look you want the random picker to use.
4. Create an interval schedule (`OWNER`, `ADMIN`, and `USER` roles may not post faster than once per hour; maximum 168 hours), choose its first run time in WIB, and write a caption template. Supported caption fields: `{name}`, `{location}`, `{outfit}`, `{situation}`, `{lighting}`, `{angle}`, `{atmosphere}`, `{condition}`. `{outfit}` resolves to the outfit that was randomly selected for that post. `USER` accounts may keep at most **2** schedule blocks; `ADMIN` and `OWNER` are unlimited.
5. Fill the optional image parameters on the schedule block: location, camera angle, activity, atmosphere, weather/condition, lighting, extra detail, and an extra negative prompt. Empty selections fall back automatically — location, activity, atmosphere, condition, and lighting are randomised, an empty camera angle becomes **medium shot**, and the built-in negative prompt (blur, watermark, text, broken anatomy, plastic skin) is always sent. Set the per-schedule **Autopost untuk jadwal ini** checkbox; turning it off stops only that block.
6. Turn on the schedule, then activate autopublish **for your own account** (`Aktifkan autopublish saya`) once every configuration check is ready. This switch is per account: pausing it never stops other accounts. Only `ADMIN`/`OWNER` see the separate **Master switch**, which stops autopost for every account and is reserved for maintenance or incidents.
7. Review run status and use **Bagikan ke profil pribadi** to confirm sharing manually when desired.

### "Error 1102: Worker exceeded resource limits" when generating

This is the Worker running out of CPU/memory, not a network problem. The cause was the image pipeline: the reference photo (928 KB in a real account) and the outfit photo (752 KB) were both **decoded inside the Worker** with `jpeg-js`/`pngjs`. Decoding two multi-megapixel photos allocates tens of megabytes each (RGBA plus JPEG component buffers), which is enough to break the 128 MB isolate limit — and because the outfit is picked at random, the same click could succeed one minute and fail the next.

Two changes remove the pressure:

- **Supabase downscales first.** References and outfit photos are now requested through Supabase image transformations (`/storage/v1/render/image/sign/…?width=512&height=512&resize=contain`), so the Worker receives an image that is already ≤512 px and `prepareReferenceImage` returns it untouched — no decode, no re-encode, almost no memory. If Image Transformations are unavailable on the project (the render endpoint answers 4xx), the code logs it and falls back to the previous download-then-decode path, so nothing breaks.
- **Decoding is bounded.** The fallback path now passes `maxResolutionInMP: 24` and `maxMemoryUsageInMB: 64` to `jpeg-js` and refuses PNGs above 24 MP before decoding, so an oversized photo produces a readable message instead of killing the request.

If 1102 still appears after this, the remaining lever is the model call itself (see `CLOUDFLARE_IDENTITY_SIZE`) rather than the image preparation.

### Runs stuck in "generating"

A manual preview deliberately stays `generating` until you publish or discard it, and its image bytes live **only in the browser tab** — nothing is uploaded at preview time. Refreshing the page therefore removes the preview and its "Buang pratinjau" button, so the history row used to hang forever. Scheduled runs could hang the same way when the cron invocation died mid-flight (for example during a deploy).

Three things now keep that from happening:

- **Every history row that is still running shows a `Batalkan` button.** It calls the `cancel-run` action, which only touches a run you own that is still `generating`, and marks it `failed` with a clear reason.
- **The cron sweeps abandoned runs every minute.** Autopost runs past the 30-minute resume window (`claim_stuck_social_post_runs` only revives younger runs) are marked failed, as are queued autopost runs of the same age. Manual runs are split by state: one that never got a caption means generation died mid-flight and is closed after **15 minutes**, while a preview that already has a caption is genuinely waiting for you and gets **6 hours**. Autopost sweeping uses `started_at`, so a run that was just resumed is never killed while it is working.
- **The page tells you when a preview is orphaned** — after a refresh, the run list shows a notice pointing at the cancellable row instead of silently leaving it there.

A manual run that already has a caption is labelled **pratinjau siap** rather than `generating`, because nothing is running any more: the image is waiting for you to publish or discard it.

### Autopost interval by role

Scheduling speed is enforced on the server, not just in the browser. The limits live
in `SOCIAL_SCHEDULE_INTERVAL_POLICY` (`lib/social-publisher/utils.js`):

| Role | Minimum interval | Maximum interval | Max schedule blocks |
| --- | --- | --- | --- |
| `OWNER` | 1 hour | 168 hours | unlimited |
| `ADMIN` | 1 hour | 168 hours | unlimited |
| `USER` | 1 hour | 168 hours | 2 |

`save-schedule` rejects anything below the role minimum (HTTP 400), rejects roles
outside the list (HTTP 403), and rejects a new block above the role's schedule limit
(HTTP 409). The dashboard returns the active policy as
`schedulePolicy`, so the form renders the right `min`/`max` and help text for the
signed-in role. Changing a role's minimum later only requires editing that map.

### Outfit library and order links

- Each character can store up to **30 outfits**. Every outfit keeps its photo in the private `social-character-references` bucket under `social-outfit/<user-id>/`.
- One **active** outfit is picked at random whenever a post is generated. Outfits used by the latest runs are skipped while another active outfit is available, so consecutive posts do not repeat the same wardrobe.
- The outfit photo is used as the try-on reference for Cloudflare P-Image Try-On and as a second reference image for Gemini and QwenCloud, so the fabric, color, cut, and pattern stay close to the real product.
- The outfit name and order link are appended to the caption before the external link and hashtags. Only HTTPS order links are accepted; a non-HTTPS link is dropped instead of being published.
- Runs store `outfit_id`, `outfit_name`, and `outfit_order_url` snapshots, so the history still explains what was published after an outfit is edited or deleted.
- Characters without any outfit keep the clothing shown in their reference photo; there is no separate default-garment upload any more.

A revoked/expired token, missing Meta permission, provider outage, or API error is recorded as a failed run. Reconnect the Page or fix the configuration before expecting later runs to succeed. Generated identity resemblance is not exact; use only images you have the rights and consent to use, and periodically check the posted content.

### "Fitur Tidak Tersedia" / "Feature unavailable: Facebook Login is currently unavailable for this app"

This is the other Meta-side block. It is rendered by `facebook.com` **before** the
OAuth redirect, so the Worker never receives a request, the callback never runs, and
no `oauth_error` is recorded — the panel stays on "Hubungkan Facebook" with no
message. The full Meta text is:

> Fitur Tidak Tersedia — Login Facebook saat ini tidak tersedia untuk aplikasi ini,
> karena kami sedang memperbarui detail tambahan untuk aplikasi ini. Silakan coba
> lagi nanti.

That wording means **Meta is withholding the app's Facebook Login product from users
who have no role in the app**, i.e. the app has not finished the requirements that
unlock login for everyone.

Meta states this requirement explicitly for this product: *"advanced access to the
`public_profile` permission is required for Facebook Login for Business apps before
they go live"* — without it, only accounts with an app role can complete the dialog,
even when the app shows as published. Fix it in the Meta App Dashboard, in this order.

Where the menus live in the current dashboard (Indonesian UI in parentheses):

| What the older guides call it | Current App Dashboard path |
| --- | --- |
| Alerts / Required actions | **Tindakan yang Diperlukan** (`Required actions`) in the left menu, plus red banners on the app tile in `/apps` |
| App Review → Permissions and Features | On use-case apps the permission list lives in **Kasus penggunaan** (`Use cases`) → **Kelola segala sesuatu di Halaman Anda** → *Sesuaikan* (`Customize`); older deep links such as `/app-review/permissions/` now redirect to the app picker, so always open the app first and click through the left sidebar |
| App Review submission | **Tinjauan** → **App Review** → *Edit* / *Buat pengajuan* |
| Business Verification | Meta Business Suite → **Keamanan dan kesesuaian** (`Security and compliance`) → **Pusat keamanan** (`Security Center`) → card *Verifikasi bisnis* → **Mulai verifikasi**; direct link `business.facebook.com/settings/security_center` |
| App Mode / publish | **Terbitkan** (`Publish`) → status *Diterbitkan* |
| App roles | **Peran aplikasi** (`App roles`) → **Roles** |
| Login configuration | Product **Facebook Login for Business** → **Konfigurasi** (`Configurations`) |

1. **Raise the permissions to Advanced Access**: open the app card, then **Kasus
   penggunaan** → **Kelola Halaman** (the *Manage everything on your Page* use case)
   → **Izin dan fitur**. The table lists every permission with three relevant
   columns:

   - **API Calls** — how many successful calls the app made in the last 30 days.
     App Review requires at least one per permission inside that window, so a `—`
     means the request will be rejected until the app actually calls it.
   - **Status** — *Siap untuk pengujian* / *Ready for testing* is Standard access
     (only app roles can use it, which is exactly the "Fitur Tidak Tersedia" block);
     *Siap untuk dipublikasikan* / *Ready to publish* is Advanced access.
   - **Tindakan** (a dropdown) — choose **Minta akses lanjutan** / *Increase access*
     to move a permission to Advanced. Rows that are not part of the use case show
     **+ Tambahkan ke Tinjauan Aplikasi** instead.

   For Studio Medsos request Advanced Access for exactly these, and nothing else:
   `public_profile`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   and `business_management`. `public_profile` is mandatory for **Facebook Login for
   Business** apps before anyone without an app role can log in. Do **not** add
   `pages_manage_engagement`, `pages_manage_metadata`, `pages_read_user_content`,
   `Page Mentions`, `Live Video API`, `email` or `Business Asset User Profile Access`
   — the publisher does not use them, and requesting unused permissions is a common
   rejection trigger (Meta rejects the whole submission, it does not silently grant
   fewer permissions).
   Clicking **Minta akses lanjutan** does not submit anything yet: it queues the
   permission in **Tinjauan → Tinjauan Aplikasi** (`App Review → App Review`), which
   then reads **Tidak dikirim / Permintaan baru** with one row per queued permission
   and a **Berikutnya** button. That wizard is where the actual submission happens:

   **Berikutnya** opens **Kirim untuk Tinjauan Aplikasi** (`Submit for App Review`), a
   five-section checklist. Each section folds open; the footer shows
   *"Anda harus menyelesaikan semua langkah-langkah sebelum dapat mengajukan untuk
   ditinjau"* and the **Kirim untuk ditinjau** button stays disabled until every circle
   turns into a green check.

   1. **Verifikasi** (`Verification`) — *Hubungkan portofolio bisnis yang terverifikasi*
      (`Link a verified business portfolio`). It is not a form: it is a table of one
      row per app, showing the app, the linked portfolio and that portfolio's state.
      For this project it reads **Genzai Dev · Tidak lengkap** (`Incomplete`) with an
      orange dot while the portfolio verification is still under review, and turns into
      **Terverifikasi** (`Verified`) once Meta approves it. Only a portfolio with **full
      control** by the signed-in person can complete this step.

      - **Selesaikan Verifikasi** (`Complete verification`) jumps into the same request
        held in `business.facebook.com/settings/security_center`; if it says
        *Pengajuan menunggu persetujuan* there is nothing to fill in — wait, then
        reopen this page. A decision takes up to 14 business days from the submission
        date.
      - **Hapus** (`Remove`) unlinks the app from the portfolio. Never press it while
        verification is pending: the app would lose the business that is being
        verified, and the request would have to start over.
      - Progress is auto-saved (**Disimpan otomatis**), so the other four sections can be
        completed while this one stays orange; only the final **Kirim untuk ditinjau**
        waits for the green check.
   2. **Pengaturan aplikasi** (`App settings`) — usually already green. If it is not,
      the missing fields are in **Pengaturan → Dasar**: 1024×1024 icon, category,
      `https://genzai.genzai-f37.workers.dev/privacy/`, and
      `https://genzai.genzai-f37.workers.dev/terms/`.
   3. **Penggunaan diizinkan** (`Allowed usage`) — one row per queued permission
      (`public_profile`, `pages_show_list`, `pages_read_engagement`,
      `pages_manage_posts`, `business_management`). For each: paste the use-case
      description, attach the screencast where the permission needs one, and tick the
      allowed-usage checkbox. This is also where the *Deskripsi penggunaan* text lives,
      so there is no separate "usage descriptions" step any more.
   4. **Penanganan data** (`Data handling`) — a questionnaire, not a form. Answers used
      for this project:

      | Question (`processor-0`, `responsible-1/-2`, `requests-3/-4`) | Answer |
      | --- | --- |
      | Do you have data processors / service providers with access to Meta Data Platform data? | **Ya**, and name them: **Supabase Inc.** (Postgres + private storage holding the encrypted Page tokens, characters and outfits) and **Cloudflare, Inc.** (Worker runtime and asset hosting). AI providers only receive generated images/prompts, never the Meta token. |
      | Who is responsible for all Data Platform data Meta shares with you? | The legal entity behind the **Genzai Dev** business portfolio — written exactly as it appears in Business Info (or the owner's legal name while the entity is unregistered) |
      | Country of that person/entity | **Indonesia** |
      | Disclosed personal data to public authorities for national-security requests in the last 12 months? | **Tidak** |
      | Which policies/processes exist for such requests? | Tick only what is real: **Kebijakan minimalisasi data** is defensible (only Page id/name/token are kept). Without written review and challenge procedures, also tick **Bukan semuanya** rather than over-claiming. |

      Each processor is added in its own modal with three required fields
      (`processor-2`, `-2a`, `-2b`); **Simpan** stays disabled until all three are set:

      | Processor | Nama | Kategori layanan (`-2a`) | Negara pemrosesan (`-2b`) |
      | --- | --- | --- | --- |
      | Supabase | `Supabase Inc.` | Data storage / cloud database & file storage | United States **plus** the project's actual Supabase region — read it in Supabase → Project Settings → Infrastructure (commonly Singapore `ap-southeast-1` or US East) |
      | Cloudflare | `Cloudflare, Inc.` | Cloud hosting / CDN & serverless compute | United States, plus any edge location option the list offers (Cloudflare runs on a global anycast network) |

      Add the second processor afterwards with the same **Tambah** button. Do not list
      AI providers here: they never receive Meta-derived identifiers, only the images
      and prompts generated for the user.

      Scope answers to the data Meta actually hands over (Page tokens, Page ids/names,
      connected account name) — generated images and captions are the user's own
      content and do not change the answers.
   5. **Petunjuk peninjau** (`Reviewer instructions`) — carries a **Perlu tinjauan Anda**
      badge until it is opened once. Fields, in order:

      - `instructions-web-2` — the click path: log in at
        `https://genzai.genzai-f37.workers.dev/`, open **Studio Medsos** in the sidebar,
        click **Hubungkan Facebook**, approve the consent dialog, pick the Page, then
        **Buat posting manual → Buat & bersihkan pratinjau → Terbitkan ke Facebook
        Page**. State the UI language (Indonesian) and translate the buttons, because
        reviewers cannot read the flow otherwise.
      - `fblogin-web-1` — **Ya** (Facebook Login for Business is the only login used for
        the Page connection).
      - `accesscode-web-1` — a **dedicated demo account**, never the developer's own:
        email + password for an account that (a) holds a **Tester** role so the consent
        dialog can still show the in-review permissions while they are still Standard
        access, (b) has an active `studio_medsos_access` row so no payment gate appears,
        and (c) has enough credit balance to generate one image. The password must stay
        valid for a full year, so disable any 2FA prompt on that account.
      - `accesscode-web-2` — not applicable: web app only, no store download or in-app
        purchase, all features reachable at the URL above. Say that explicitly instead
        of leaving a wrong answer.
      - `geo-web-5` — leave empty unless a real restriction exists; the site is
        reachable worldwide. Never write "refund" here: this field asks about geographic
        limits, not billing policy.
      - `documents-web-1` — optional: attach the same screencast you uploaded per
        permission so the reviewer has one canonical recording.

      Meta states it tests with **its own accounts**, so do not paste a personal
      password — a purpose-made demo login is the accepted approach for a gated app.

   When all five show a green check, **Kirim untuk ditinjau** becomes clickable →
   accept the Platform Onboarding Terms. Status moves from *Tidak dikirim* to *Dalam
   peninjauan*; Meta's banner currently quotes **20 days** for most submissions, and
   resubmitting restarts the clock.

   Each permission opens its own modal (**Beritahukan Alasan Anda Meminta <permission>**)
   with exactly three inputs plus a checkbox:

   - **Reason text area** — one paragraph describing the feature, why this permission
     is the minimum, and what the user sees. Write it in **English** even though the
     dashboard is Indonesian; Meta's screen-recording guide recommends an English UI
     for reviewers.
   - **Screen recording upload** (drag-drop / *Unggah File*) — mp4 or mov, 1080p,
     normal speed, no jump cuts, under ~100 MB. The same recording may be reused for
     `pages_show_list`, `pages_read_engagement` and `pages_manage_posts`, but each
     permission must be visibly exercised inside it.
   - **API test calls row** — its presence varies per permission and per app, so never
     assume it: `pages_manage_posts` and `pages_read_engagement` showed it for this
     project while `pages_show_list` did not. When it is present it must read
     **Selesai** (`Complete`); it turns green only after at least one successful call in
     the last 30 days and can take up to 24 hours to register. A spinner or *Belum*
     blocks submission.
   - **Allowed-usage checkbox** — tick *"Jika disetujui, saya setuju bahwa data …
     akan digunakan sesuai dengan penggunaan diizinkan"*.

   The one permission whose description must be written differently is
   `business_management`: Meta's permission reference says that when a permission is
   requested **as a dependency of a main permission** — `pages_show_list` in this case —
   the description must name that main permission explicitly. Say it is a dependency,
   that only portfolio membership is read to decide which Pages are eligible, and that
   no ad account, credit line, catalogue or billing object is created, claimed or
   modified. Do not describe business-asset management, because the app does not do any.

   Finish with **Simpan**; closing with **Batal** discards the text and re-uploading.
   Repeat for `public_profile`, `pages_show_list`, `pages_read_engagement` and
   `business_management`.

   A screencast that satisfies all three Page permissions in one recording is enough
   when they are submitted together: open Studio Medsos → **Hubungkan Facebook** →
   approve the consent dialog listing the permissions → pick Page **BELA** →
   **Periksa izin** → fill character/outfit/caption → **Buat & bersihkan pratinjau**
   → **Terbitkan ke Facebook Page** → show the post on Facebook. Do not cut the
   consent dialog out of the video.

   Permissions queued as **Permintaan baru** stay unsubmitted until the wizard is
   finished; the trash icon removes one from the *submission* only, not from the app
   (that needs **Kasus penggunaan**).

2. **Tindakan yang Diperlukan**: clear a pending **Data Use Checkup** (it recurs
   annually) and any red banner on the app tile. A pending checkup alone produces
   exactly this screen. *Empty page = this is not the cause.*
3. **Business Verification** lives in Meta Business Suite, **not** in the developer
   dashboard. Open `business.facebook.com/settings/security_center` (or left menu →
   **Keamanan dan kesesuaian** → **Pusat keamanan**) and click **Mulai verifikasi** on
   the *Verifikasi bisnis* card. Since May 2023 every new request for Advanced Access
   needs a verified business, so step 1 cannot be granted without it. The
   `facebook-domain-verification` meta tag in `index.html` belongs to this flow.
   If the button is missing, greyed out, or says **Tidak memenuhi syarat**
   (`Ineligible for verification`): fill every field in **Info bisnis** (legal name,
   registered address, business phone, website that loads over HTTPS), enable 2FA,
   and make sure the portfolio owns at least one asset. The app is only attached to
   the portfolio when it was created *for* that business — otherwise attach it via
   **Akun → Aplikasi** before retrying. Never verify an empty portfolio: Meta hides
   the button, which is why it looks like a bug. If it still says *not eligible*,
   do not block on it: request Advanced Access anyway (step 1) — Meta answers either
   with an approval or with an explicit "business verification required" prompt, and
   only then is the portfolio verification actually needed.
   On the *Verifikasi Bisnis* card, pick the use case **Aplikasi memerlukan akses ke
   izin di Meta untuk Developer** (`App requires access to permissions on Meta for
   developers`). Once submitted the card shows **Pengajuan menunggu persetujuan**
   (`Submission pending review`) with a start date and a *Lanjutkan* button; that
   state means nothing is left to do but wait — a decision takes up to 14 business
   days and arrives by email/notification. Do not resubmit while it is pending.
   The *Action needed* rows above it are hardening recommendations, not verification
   blockers, and they do **not** influence the pending review:

   - *1 pengguna dengan domain email publik* (`1 user with a public email domain`) is
     triggered by the **domain** of the email only — `gmail.com`, `yahoo.com`, etc. —
     not by the person's name or by any suspicion that the account is fake. Meta's
     heuristic is that free-mail accounts are easier to take over than a company domain,
     so it recommends keeping only corporate-domain users in a portfolio. A solo owner
     using their own Gmail is the normal case for a small business and is safe to leave
     as-is.
   - *1 pengguna without passkey enabled* + *0 dari 1 orang harus mengaktifkan
     autentikasi dua faktor* are the same idea: stronger auth for portfolio members.
   - Never click **Ambil tindakan** → remove on the only admin. Removing the last
     full-control user locks the portfolio (and the app attached to it) out of
     management. If the goal is to clear the warning, add a second admin first — ideally
     one on the business domain — and enable 2FA / a passkey for the existing account.

   Every other control on the Security Center page, and what to answer for this project:

   | Control | Answer |
   | --- | --- |
   | *Autentikasi Dua Faktor → Siapa yang diharuskan…?* | Keep **Hanya admin**; switch to **Semua orang** once a second member exists. Turn 2FA on for the owner via **Kelola Pengaturan Pribadi Saya**. |
   | *Passkey Management → Who's required to turn on Passkeys?* | **Admin**, but only after the owner has actually registered a passkey — the requirement blocks sign-in for whoever has none. Optional; skip until 2FA is on. |
   | *Tambah admin lainnya* | Optional. Add a corporate-domain admin so a lockout is recoverable. |
   | *Peer Approval → Keamanan domain / Keamanan akun iklan* | Leave unmanaged. Both govern ad delivery; this app runs no ads. |
   | *Label kampanye (tanda)* | Leave **Default**. Ad-campaign label only. |
   | *Verifikasi Bisnis → Pilih kasus penggunaan verifikasi Anda* | Already correct: **Aplikasi memerlukan akses ke izin di Meta untuk Developer**. Do not change it, and do not press **Lanjutkan** while the card reads *Pengajuan menunggu persetujuan*. |
4. **App settings → Basic**: Category, App Domains (`genzai.genzai-f37.workers.dev`),
   Privacy Policy URL, and Data Deletion Instructions URL must be filled in. Meta
   hides login while app details are considered incomplete.
5. **Facebook Login for Business → Configurations**: `META_LOGIN_CONFIG_ID` must point
   at an existing configuration of the **User access token** type that contains
   `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` plus the
   target Page assets. A deleted or empty configuration also shows this screen
   because `startOAuth` sends `config_id` without a scope list.
6. **Terbitkan** (`Publish`) once steps 1–5 are green.

While waiting, an account added as **App roles → Roles → Tester** (then accepting the
invitation and signing out/in of Facebook) can normally still complete the dialog,
which is enough to smoke-test the publisher end to end.

"Updating additional details" is also occasionally a transient Meta-side restriction
with nothing to fix in the dashboard; those cases clear on their own within ~24 hours,
so retry the same button before reworking the configuration.

### Business verification without a registered company

Meta verifies the **business portfolio**, not the app, and it accepts a **sole
proprietor** (usaha perorangan) — a PT/CV is not required. What the form actually asks
for is proof that a real, identifiable business exists and that the applicant may
represent it. Three routes, cheapest first:

| Route | What to submit | Cost / time | Notes |
| --- | --- | --- | --- |
| **NIB usaha perorangan** (recommended) | NIB PDF from OSS, plus KTP, plus NPWP | Free, issued the same day | Register at `oss.go.id` → *Daftar* → business type **Usaha Perorangan** (not PT), enter NIK, pick a KBLI such as `62019` (aplikasi/programming), use the home address as the business address. The NIB carries a legal business name and address, which is exactly what Meta cross-checks. |
| **Surat Keterangan Usaha / IUMK** | SKU or Izin Usaha Mikro Kecil from the kelurahan, plus KTP | Free/cheap, 1–3 days | Accepted by Meta in many Indonesian cases; weaker than a NIB because it has no registration number. |
| **No legal document at all** | KTP + recent bank statement or utility bill in the same name/address | Free | Works only when the verification flow lets you pick *business type = individual / perorangan*. If the form insists on a registration number, this route stalls. |

Rules that decide whether the submission passes, regardless of route:

- The legal name, address and phone typed into **Info bisnis** must match the document
  **exactly** — a mismatch is the most common rejection and Meta will not tell you
  which field failed.
- The website field must load over HTTPS. `genzai.genzai-f37.workers.dev` loads fine
  but is a subdomain of Cloudflare's `workers.dev`; for **domain** verification Meta
  expects a domain you own. A cheap `.id`/`.com` domain pointed at the same Worker
  removes that doubt and is also the better look for a product.
- Free-mail addresses (`@gmail.com`) are accepted for the *owner*, but not as a domain
  verification method — verify by SMS/phone code instead.
- If the pending request is rejected, that is not permanent: fix the document and
  resubmit. Do **not** resubmit while it is still *Pengajuan menunggu persetujuan*.

**If verification is impossible right now**, the app still ships: every account added
as **Peran aplikasi → Roles → Tester** can complete Facebook Login and publish, because
app roles bypass the Standard/Access-Advanced gate. That is how this publisher was
validated end to end. Treat it as a stopgap, not a production model: roles are meant
for development and testing, the tester must accept an invitation and sign out/in, and
Meta can change or audit role-based access. Open public signup needs the verified
portfolio.

### "Aplikasi tidak aktif" / "App not active" on Facebook

Facebook shows this page **before** our callback runs, so the dashboard receives no
`oauth_error` code. It means the Meta app is still in **Development mode** and the
signed-in Facebook account is not part of the app's roles:

1. Open **Meta App Dashboard → App roles → Roles** and add that Facebook account as
   **Tester** (or **Developer**). Accept the invitation from the account itself, then
   sign out of Facebook and sign in again before retrying.
2. Confirm the account administers the target Page and holds the `CREATE_CONTENT`
   task. Otherwise the connection succeeds with zero Pages.
3. Check that the Facebook Login for Business configuration contains
   `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`, and that
   `META_LOGIN_CONFIG_ID` points at that configuration.
4. Keep `META_REDIRECT_URI` byte-identical to the Meta *Valid OAuth Redirect URIs*
   entry (`https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback`).
5. To let accounts outside the app roles connect, pass App Review for the Page
   permissions and switch the app to **Live mode**.

The Social Publisher panel now renders this checklist under **1. Hubungkan Facebook
Page** and opens it automatically when the callback reports `denied`, `pages`,
`no_pages`, or `exchange`.

Studio Medsos access is separate from Facebook: a newly registered account still
needs an active `studio_medsos_access` row (Admin Panel → **SET Studio Medsos**)
before the API accepts any Social Publisher action, including `oauth-start`.

### Page permission check and "(#200) Permissions error"

Every publish first calls the Graph API to confirm that the stored Page token can still read the Page and that the authorizing account holds the `CREATE_CONTENT` task. The photo is only uploaded when that check passes, so a missing permission no longer fails mid-upload and cannot produce a duplicate post. A failing check records a specific message on the run instead of a generic HTTP error:

- `token_invalid` (code 190): the Page token was revoked or expired. Click **Hubungkan Facebook** again.
- `permission_denied` (code 200/10): the Meta app was not granted `pages_manage_posts` (or `pages_read_engagement`/`pages_show_list`) for that Page. Fix the app's use case, permissions and App Review access, then reconnect the Page.
- `missing_page_role`: the signed-in person lacks `CREATE_CONTENT` on the Page. Ask the Page admin to grant content access, then reconnect.

Use **Periksa izin** on a connected Page in **Admin Control → Social Auto Publisher** to re-read this state directly from Facebook at any time. The dashboard shows the last check time and marks Pages that are not ready. The OAuth callback also inspects the granted permissions per Page (`debug_token` → `granular_scopes`) so a Page is flagged as needing permission right after connecting instead of after the first failed post.

When Facebook returns a 5xx response or the connection drops after the upload request was sent, the run is reported as unsafe to retry: check the Page on Facebook first, because the post may already exist. In that case the panel message says the post may already be published, and the **Bagikan ke profil pribadi** link will only appear for runs recorded as posted.
