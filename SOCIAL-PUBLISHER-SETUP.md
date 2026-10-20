# GEN-Z.AI Social Auto Publisher — setup

The Social Publisher is an admin-only feature for generating one reference-guided image per scheduled run and publishing it to a Facebook **Page**. A successful Page post also gets a share link for a person to manually share to a personal profile; publishing directly to a personal profile is not supported by the official Pages API.

## How the flow works

1. An admin uploads a character reference. The original reference is stored in a private Supabase Storage bucket.
2. At the scheduled time, the Worker selects a scene combination (location, camera angle, outfit, situation, and lighting), avoids recently used combinations, and calls Gemini Nano Banana 2 Lite with the reference image.
3. The generated image bytes are sent directly to the Facebook Page photos endpoint. Generated images are **not stored in Supabase Storage**.
4. The run record stores the prompt, scene, caption, Facebook post ID, permalink, status, and any error. The personal-profile share button opens Facebook's share flow for a person to confirm manually.

Schedules are saved as UTC timestamps derived from the selected **Asia/Jakarta (WIB)** time. The Worker checks the queue once per minute and posts one generated image for each due schedule.

## One-time setup

### 1. Apply the Supabase migration

Run `supabase/social-auto-publisher.sql` and `supabase/social-reference-storage.sql` in the Supabase SQL Editor. The first file creates server-only tables with RLS; the second creates a dedicated private Storage bucket named `social-character-references`, limited to JPEG, PNG, and WebP references up to 8 MB. The Worker uses the existing Supabase service-role configuration to read and write these objects server-side. Do not make the bucket public.

### 2. Configure Google Gemini image generation

Create an API key for the Gemini Developer API and add it as a Worker secret:

```sh
npx wrangler@4 secret put GEMINI_API_KEY
```

Atur secret ini jika memilih Google Gemini. Provider Cloudflare Workers AI tidak memerlukan `GEMINI_API_KEY`.

Admins can choose Gemini or Cloudflare Workers AI for both image generation and contextual captions in **Admin Panel → SET Studio Medsos**. Gemini uses `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) for images and `gemini-3.8-flash` through the Interactions API for captions; this requires `GEMINI_API_KEY`. Cloudflare uses the `AI` binding, `@cf/black-forest-labs/flux-2-klein-4b` for image editing, and `@cf/meta/llama-3.2-11b-vision-instruct` to caption the generated image. Cloudflare's Llama model requires acceptance of Meta's license and acceptable use policy by making the documented initial `"agree"` request once per account. FLUX is a Cloudflare partner model; verify account availability, pricing, and quotas before use. The binding is configured in `wrangler.toml`; apply the updated `supabase/social-auto-publisher.sql` migration to add the provider setting.

Workers AI free allocations, partner model access, and prices vary by account and may change. Check [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [FLUX.2 Klein 4B model details](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/), and [Llama 3.2 Vision pricing and requirements](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/) before use. Gemini access and quotas depend on the configured Google API key; see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). A provider reporting a zero quota is unavailable to that account's current tier; retries will not resolve that restriction.

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
3. Create an interval schedule (1–168 hours), choose its first run time in WIB, and write a caption template. Supported caption fields: `{name}`, `{location}`, `{outfit}`, `{situation}`, `{lighting}`, `{angle}`.
4. Turn on the schedule, then activate global autopublish after all configuration checks are ready.
5. Review run status and use **Bagikan ke profil pribadi** to confirm sharing manually when desired.

A revoked/expired token, missing Meta permission, provider outage, or API error is recorded as a failed run. Reconnect the Page or fix the configuration before expecting later runs to succeed. Generated identity resemblance is not exact; use only images you have the rights and consent to use, and periodically check the posted content.
