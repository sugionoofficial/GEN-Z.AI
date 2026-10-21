# GEN-Z.AI Social Auto Publisher — setup

The Social Publisher is an admin-only feature for generating one reference-guided image per scheduled run and publishing it to a Facebook **Page**. A successful Page post also gets a share link for a person to manually share to a personal profile; publishing directly to a personal profile is not supported by the official Pages API.

## How the flow works

1. An admin uploads a character reference. The original reference is stored in a private Supabase Storage bucket.
2. An admin uploads one or more outfits for that character, each with a name and an optional HTTPS order link. At the scheduled time, the Worker picks one active outfit at random (skipping outfits used by the latest posts while another option exists), selects a scene combination (location, camera angle, outfit name, situation, and lighting), and calls the configured image provider with the character reference plus the chosen outfit reference.
3. The caption is composed from the base template, the AI sentence, the outfit block (`✨ Outfit: <name>` + `🛍️ Order di sini: <link>`), the external link, and hashtags. The generated image bytes are sent directly to the Facebook Page photos endpoint. Generated images are **not stored in Supabase Storage**.
4. The run record stores the prompt, scene, caption, Facebook post ID, permalink, status, and any error. The personal-profile share button opens Facebook's share flow for a person to confirm manually.

Schedules are saved as UTC timestamps derived from the selected **Asia/Jakarta (WIB)** time. The Worker checks the queue once per minute and posts one generated image for each due schedule.

## One-time setup

### 1. Apply the Supabase migration

Run `supabase/social-auto-publisher.sql` and `supabase/social-reference-storage.sql` in the Supabase SQL Editor. The first file creates server-only tables with RLS, including the `social_outfits` library and the `outfit_id`/`outfit_name`/`outfit_order_url` columns on `social_post_runs`; the script is idempotent, so running it again upgrades an existing deployment. The second file creates a dedicated private Storage bucket named `social-character-references`, limited to JPEG, PNG, and WebP references up to 8 MB. The Worker uses the existing Supabase service-role configuration to read and write these objects server-side. Do not make the bucket public.

### 2. Configure Google Gemini image generation

Create an API key for the Gemini Developer API and add it as a Worker secret:

```sh
npx wrangler@4 secret put GEMINI_API_KEY
```

Atur secret ini jika memilih Google Gemini. Provider Cloudflare Workers AI dan QwenCloud tidak memerlukan `GEMINI_API_KEY`.

### 2b. Configure QwenCloud image generation (optional)

Create an API key on the QwenCloud platform and add it as a Worker secret:

```sh
npx wrangler@4 secret put QWENCLOUD_API_KEY
```

QwenCloud uses the image generation catalog for edited images (default `qwen-image-3.0-pro`; the dropdown in **Admin Panel → SET Studio Medsos** lists all sixteen image-generation models: `qwen-image-3.0-pro`, `qwen-image-3.0`, `qwen-image-2.1-pro`, `qwen-image-2.1-turbo`, `qwen-image-2.0-pro`, `qwen-mt-image-2.0`, `wan2.7-image-pro`, `wan2.7-image`, `wan2.6-image`, `wan2.5-i2i-preview`, `wan2.6-t2i`, `wan2.5-t2i-preview`, `wan2.2-t2i-plus`, `wan2.2-t2i-flash`, `z-image-turbo`, and `vidu/vidu-image_reference2image`). Tier limits are seeded from each model's free quota (for example 10 images for qwen-image-3.0-pro, 50 for the wan2.7/2.6/2.5 family, 100 for wan2.2-t2i/z-image-turbo) and can be overridden per model. Images are requested through the DashScope-compatible endpoint at `https://maas.qwencloudapi.com/api/v1` (overridable with `QWENCLOUD_BASE_URL`) using each model family's wire protocol: the qwen-image family calls the synchronous `multimodal-generation/generation` endpoint, while wan/z-image/vidu models start with the asynchronous `image-generation/generation` endpoint (`X-DashScope-Async: enable` plus task polling); when a model rejects one protocol with the DashScope "url error, please check url" endpoint-mismatch error, the other protocol is retried once automatically. Captions use `qwen3-vl-plus`. The character reference photo is sent as a Base64 data URL; when the character has a garment photo it is included as a second input image so the outfit is followed, but unlike the Cloudflare provider the garment stays optional. Output size follows the chosen aspect ratio (`1152*2048` for 9:16, `2048*1152` for 16:9). Per-model price and rate limits are shown in the dropdown notes; check QwenCloud model availability, pricing, and quotas for your account before use.

Admins can choose Gemini, Cloudflare Workers AI, or QwenCloud for both image generation and contextual captions in **Admin Panel → SET Studio Medsos**. Gemini uses `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) for images and `gemini-3.8-flash` through the Interactions API for captions; this requires `GEMINI_API_KEY`. Cloudflare uses the `AI` binding, `pruna/p-image-try-on` with `person_image` and `garment_images` for virtual try-on, and `@cf/meta/llama-3.2-11b-vision-instruct` to caption the result. Upload a garment image for each character in **Social Publisher → Karakter tersimpan**; the short-lived signed URLs for the private Supabase photos are sent to Workers AI/Pruna for processing. The Llama model requires acceptance of Meta's license and acceptable use policy by making the documented initial `"agree"` request once per account. Check partner-model availability, terms, pricing, and quotas for your Cloudflare account. The binding is configured in `wrangler.toml`; apply the updated `supabase/social-auto-publisher.sql` migration to add the garment reference fields.

Workers AI free allocations, partner model access, and prices vary by account and may change. Check [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [Llama 3.2 Vision pricing and requirements](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/) before use. Gemini access and quotas depend on the configured Google API key; see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). A provider reporting a zero quota is unavailable to that account's current tier; retries will not resolve that restriction.

When Cloudflare is selected, neither image generation nor contextual caption generation requires `GEMINI_API_KEY`. This implementation generates **one** image per run to limit usage.

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

### 4. Confirm Worker configuration and deploy

The Worker reads reference images through the existing Supabase service-role configuration; no Cloudflare R2 binding or R2 subscription is required. `wrangler.toml` retains the one-minute Cron Trigger. Deploy the Worker after both Supabase SQL files have been applied:

```sh
npm run build
npx wrangler@4 deploy
```

Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` Worker configuration is required. The global autopublish switch starts **off**. The queue will not publish until an admin connects a Page, creates an enabled schedule, and turns on autopublish.

### Cloudflare Workers Builds preview command

The `dist/` directory is generated, not committed. For Workers Builds, keep Production configured with build command `node scripts/build-cloudflare-pages.mjs` and deploy command `npx wrangler deploy`. In **Previews Base**, use `npm run preview` as the Preview command; that script builds `dist/` before running `npx wrangler preview`. The package `postinstall` hook also detects Cloudflare Workers Builds on non-`main` branches and builds `dist/` before the Preview command, so branch previews remain resilient when the dashboard omits its optional Build command. To avoid duplicate work, the Previews Base Build command can be left empty. This affects branch previews only, not the Production deploy command.

## Admin use

Open **Admin Control → Social Auto Publisher**:

1. Click **Hubungkan Facebook** and authorize the Pages you administer.
2. Upload a licensed/authorized reference photo; confirm the character is an adult or fictional non-child.
3. Open **Outfit & link order**, choose the character, then upload outfits with a name, photo, optional notes, and an HTTPS order link. Repeat for every look you want the random picker to use.
4. Create an interval schedule (`OWNER`, `ADMIN`, and `USER` roles may not post faster than once per hour; maximum 168 hours), choose its first run time in WIB, and write a caption template. Supported caption fields: `{name}`, `{location}`, `{outfit}`, `{situation}`, `{lighting}`, `{angle}`. `{outfit}` resolves to the outfit that was randomly selected for that post.
5. Turn on the schedule, then activate global autopublish after all configuration checks are ready.
6. Review run status and use **Bagikan ke profil pribadi** to confirm sharing manually when desired.

### Autopost interval by role

Scheduling speed is enforced on the server, not just in the browser. The limits live
in `SOCIAL_SCHEDULE_INTERVAL_POLICY` (`lib/social-publisher/utils.js`):

| Role | Minimum interval | Maximum interval |
| --- | --- | --- |
| `OWNER` | 1 hour | 168 hours |
| `ADMIN` | 1 hour | 168 hours |
| `USER` | 1 hour | 168 hours |

`save-schedule` rejects anything below the role minimum (HTTP 400) and rejects roles
outside the list (HTTP 403). The dashboard returns the active policy as
`schedulePolicy`, so the form renders the right `min`/`max` and help text for the
signed-in role. Changing a role's minimum later only requires editing that map.

### Outfit library and order links

- Each character can store up to **30 outfits**. Every outfit keeps its photo in the private `social-character-references` bucket under `social-outfit/<user-id>/`.
- One **active** outfit is picked at random whenever a post is generated. Outfits used by the latest runs are skipped while another active outfit is available, so consecutive posts do not repeat the same wardrobe.
- The outfit photo is used as the try-on reference for Cloudflare P-Image Try-On and as a second reference image for Gemini and QwenCloud, so the fabric, color, cut, and pattern stay close to the real product.
- The outfit name and order link are appended to the caption before the external link and hashtags. Only HTTPS order links are accepted; a non-HTTPS link is dropped instead of being published.
- Runs store `outfit_id`, `outfit_name`, and `outfit_order_url` snapshots, so the history still explains what was published after an outfit is edited or deleted.
- Characters without any outfit fall back to the legacy single garment upload, and to prompt-only wardrobe direction when no garment exists at all.

A revoked/expired token, missing Meta permission, provider outage, or API error is recorded as a failed run. Reconnect the Page or fix the configuration before expecting later runs to succeed. Generated identity resemblance is not exact; use only images you have the rights and consent to use, and periodically check the posted content.

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
