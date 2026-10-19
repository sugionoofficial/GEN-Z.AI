# GEN-Z.AI Social Auto Publisher — setup

The Social Publisher is an admin-only feature for generating one reference-guided image per scheduled run and publishing it to a Facebook **Page**. A successful Page post also gets a share link for a person to manually share to a personal profile; publishing directly to a personal profile is not supported by the official Pages API.

## How the flow works

1. An admin uploads a character reference. The original reference is stored privately in Cloudflare R2.
2. At the scheduled time, the Worker selects a scene combination (location, camera angle, outfit, situation, and lighting), avoids recently used combinations, and calls Gemini Nano Banana 2.1 with the reference image.
3. The generated image bytes are sent directly to the Facebook Page photos endpoint. Generated images are **not archived in R2**.
4. The run record stores the prompt, scene, caption, Facebook post ID, permalink, status, and any error. The personal-profile share button opens Facebook's share flow for a person to confirm manually.

Schedules are saved as UTC timestamps derived from the selected **Asia/Jakarta (WIB)** time. The Worker checks the queue once per minute and posts one generated image for each due schedule.

## One-time setup

### 1. Apply the Supabase migration

Run `supabase/social-auto-publisher.sql` in the Supabase SQL Editor. The tables are server-only: client roles are revoked and RLS is enabled. The Worker uses the existing Supabase service-role configuration.

### 2. Create the private R2 bucket

Create the bucket named in `wrangler.toml`:

```sh
npx wrangler@4 r2 bucket create genzai-social-references
```

The Worker binding is `SOCIAL_REFERENCE_BUCKET`. Keep the bucket private; the application reads reference objects only from server-side Worker code after checking the admin session.

### 3. Configure Google Gemini image generation

Create an API key for the Gemini Developer API and add it as a Worker secret:

```sh
npx wrangler@4 secret put GEMINI_API_KEY
```

The configured model is `gemini-nano-banana-2.1`. The API currently does not include a free image-output tier. At the listed Standard price, a 1K image is about US$0.0336 before input, retry, tax, or pricing changes. One image per day is roughly US$1.01 per 30-day month; four candidate images per day would be roughly US$4.03. This implementation generates **one** image per run to limit spend. See the current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).

### 4. Configure the Meta app and OAuth

Create/configure a Meta app with Facebook Login and the Pages API. In the Meta app settings, add this exact callback URL (replace it if using another production hostname):

```text
https://genzai.genzai-f37.workers.dev/api/social-publisher?action=oauth-callback
```

Add the necessary permissions for the managed Page, including `pages_show_list`, `pages_manage_read_engagement`, `pages_manage_posts`, and `pages_manage_metadata`. Meta may require App Review / advanced access before the app can serve users beyond its own app roles. The authorizing person must be able to perform the Page's `CREATE_CONTENT` task.

Store credentials as Worker secrets; do not place them in browser code or send them in chat:

```sh
npx wrangler@4 secret put META_APP_ID
npx wrangler@4 secret put META_APP_SECRET
npx wrangler@4 secret put META_REDIRECT_URI
npx wrangler@4 secret put SOCIAL_TOKEN_ENCRYPTION_KEY
```

Set `META_REDIRECT_URI` to the exact callback URL above. Generate a fresh 32-byte key encoded as Base64 for `SOCIAL_TOKEN_ENCRYPTION_KEY`, for example:

```sh
openssl rand -base64 32
```

Page access tokens are encrypted with AES-GCM before being stored in Supabase. If the encryption secret is rotated, reconnect the Facebook Page so the stored token can be encrypted with the new key.

### 5. Confirm Worker bindings and deploy

The repository's `wrangler.toml` contains the private R2 binding and one-minute Cron Trigger. Deploy the Worker after the R2 bucket exists and the migration is applied:

```sh
npm run build
npx wrangler@4 deploy
```

Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` Worker configuration is required. The global autopublish switch starts **off**. The queue will not publish until an admin connects a Page, creates an enabled schedule, and turns on autopublish.

## Admin use

Open **Admin Control → Social Auto Publisher**:

1. Click **Hubungkan Facebook** and authorize the Pages you administer.
2. Upload a licensed/authorized reference photo; confirm the character is an adult or fictional non-child.
3. Create an interval schedule (1–168 hours), choose its first run time in WIB, and write a caption template. Supported caption fields: `{name}`, `{location}`, `{outfit}`, `{situation}`, `{lighting}`, `{angle}`.
4. Turn on the schedule, then activate global autopublish after all configuration checks are ready.
5. Review run status and use **Bagikan ke profil pribadi** to confirm sharing manually when desired.

A revoked/expired token, missing Meta permission, provider outage, or API error is recorded as a failed run. Reconnect the Page or fix the configuration before expecting later runs to succeed. Generated identity resemblance is not exact; use only images you have the rights and consent to use, and periodically check the posted content.
