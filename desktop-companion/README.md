# STUDIO FLOW Companion (Windows)

The Windows companion hosts the GEN-Z.AI workspace and opens a visible Google Flow window inside the app. It uses the Flow page's visible controls—never a private Flow endpoint. After the subscription check, **Kirim Generate via Flow** prepares the prompt, selected model/options, and (after a native consent dialog) staged reference images. It then shows a second native confirmation explaining that Google Flow credits/limits apply. Only after confirmation does it click the visible Flow Generate button.

The companion keeps the generated output visible in its Flow window. When you click Flow's **Download** for an image/video, the companion intercepts that download and uploads it through the authenticated GEN-Z.AI API to a private, per-user Supabase bucket. The Studio Flow history then displays an image/video preview. Downloads over 50 MB, unsupported formats, or unrecognized Flow controls are not submitted/imported; the UI reports the issue and leaves the Flow window open for manual recovery.

Google sign-in happens in the companion's own persistent Chromium partition; passwords, cookies, browser profile files, and private Flow APIs are never read or exported. The web page only sees a narrow origin-checked bridge. Selected references are copied to an app-owned temporary folder after consent and removed after 24 hours. Downloaded outputs that fail upload are kept locally for recovery and cleaned after 24 hours.

## Run from source on Windows

1. Install Node.js 22 or newer.
2. Open PowerShell in this folder and run:
   ```powershell
   npm ci
   npm test
   npm start
   ```
3. Sign in to GEN-Z.AI in the main companion window and sign in to Google Flow in the Flow window that opens.
4. Select prompt/references/options in Studio Flow and click **Kirim Generate via Flow**. Review the visible Flow task and confirm the credit-use dialog. When results appear, use Flow's Download control; the app imports completed downloads into the private STUDIO FLOW history.

## Build Windows installer and portable executable

```powershell
npm ci
npm test
npm run dist:win
```

Outputs are written to `release/`. The `Build STUDIO FLOW Companion` GitHub Actions workflow packages installer and portable builds for pull requests and main-branch changes; download its artifact from the workflow run. Builds are unsigned; sign them with GEN-Z.AI's production code-signing identity before public distribution. Windows SmartScreen may warn about unsigned builds.

## Security and limitations

- The Studio page uses Electron context isolation, sandboxing, and disabled Node integration. Only `getStatus`, `stageReferences`, `handoffTask`, and the result notification are exposed.
- IPC is accepted only from the exact production GEN-Z.AI origin. Flow runs in a separate sandboxed BrowserWindow with no preload or Node access.
- Automation interacts with visible DOM controls and file inputs. If the current Flow UI cannot be recognized, the companion does not click Generate and reports which visible step needs attention.
- User confirmation precedes staging references and every Flow generation. Google Flow determines final credits/limits.
- Flow result downloads are capped at 50 MB and limited to JPEG, PNG, WEBP, MP4, and WEBM. They are stored in the private bucket under the authenticated owner's ID; the API returns short-lived signed preview URLs.
- No Flow credentials/cookies are read or exported. There is no loopback server, no private Flow endpoint, and no automatic clicking of result Download buttons.
