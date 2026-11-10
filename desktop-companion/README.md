# STUDIO FLOW Companion (Windows)

The Electron desktop companion provides the Studio Flow webpage a narrow, origin-checked bridge. It does **not** automate Google Flow or use undocumented APIs. After the Studio Medsos subscription check succeeds, clicking **Siapkan di Google Flow**:

1. Copies the prompt to the clipboard.
2. If references are selected, asks for native Windows confirmation, stages copies under the app's private user-data folder, and opens that folder in Explorer. The user uploads those copies to Flow.
3. Opens `https://flow.google.com/` in the default browser. The user pastes the prompt, checks the model/options, and presses Generate there.
4. Stores a per-user history entry marked as a manual handoff—not a completed generation.

Generated media is not captured or imported back automatically. Google passwords, cookies, and browser profiles are never read. The companion never uploads selected references. Temporary copies are deleted after 24 hours.

## Run from source on Windows

1. Install Node.js 22 or newer.
2. Open PowerShell in this folder and run:
   ```powershell
   npm ci
   npm test
   npm start
   ```
3. Sign in to GEN-Z.AI inside the companion window. Sign in to the Google account used for Flow in your default browser.
4. Open Studio Flow from navigation, set the prompt/references/options, then choose **Siapkan di Google Flow**. Approve local reference staging, upload the staged images in Flow, paste the prompt, review settings, and generate there.

## Build Windows installer and portable executable

```powershell
npm ci
npm test
npm run dist:win
```

Outputs are written to `release/`. The `Build STUDIO FLOW Companion` GitHub Actions workflow also packages installer and portable builds for pull requests and main-branch changes; download its unsigned artifact from the workflow run. Sign builds with GEN-Z.AI's production code-signing identity before public distribution. Windows SmartScreen may warn about unsigned builds.

## Security boundary

- The remote page runs with context isolation and sandbox enabled; Node integration is disabled.
- Only `getStatus`, `stageReferences`, and schema-validated `handoffTask` cross the preload boundary.
- Every IPC call is rejected unless it originates from the exact configured GEN-Z.AI production origin.
- The page has no arbitrary filesystem API. Only user-selected image bytes can be staged to generated filenames inside the app's fixed temporary folder after a native confirmation dialog.
- Image type/signature, 12 MB per-file size, and eight-file count are checked. Temporary files are cleaned after 24 hours.
- Browser permissions are denied. There is no loopback server. Google credentials/cookies and generated media are not accessed.
- External navigation is restricted to Google Flow.
