# STUDIO FLOW Windows companion

## What works in this version

The Windows app source is in `desktop-companion/`. It opens the production STUDIO FLOW page in a sandboxed Electron window and exposes a tiny, origin-checked `contextBridge` API. In the app, the webpage detects that API and enables **Siapkan di Google Flow** after the existing Studio Medsos subscription check succeeds.

On click, the app:

1. Validates the task's media type, prompt, model, ratio, output count, and video settings against an allowlist.
2. If references were selected, asks for native Windows confirmation, copies the selected image bytes to a generated-name folder under the app's user-data directory, and opens that folder in Explorer. Copies older than 24 hours are cleaned at the next app start.
3. Copies the prompt to the Windows clipboard and opens `https://flow.google.com/` in the user's default browser.
4. Saves a per-user history entry marked as a manual handoff, not as a completed generation.

The user still uploads the staged images, checks the chosen model/settings, and presses Generate on Google Flow. Generated results are **not** captured or imported back into STUDIO FLOW yet. There is no supported direct Google Flow generation API established in this project, so the companion does not use private endpoints, cookies, profile files, or Chrome debugging automation.

## Build and run on Windows

1. Install Node.js 22 or newer.
2. In PowerShell, run:
   ```powershell
   cd desktop-companion
   npm ci
   npm test
   npm start
   ```
3. Sign in to GEN-Z.AI inside the companion window. Keep the default browser signed into the Google account used for Flow.
4. Open Studio Flow, configure the task, and click **Siapkan di Google Flow**. Approve reference staging if prompted, upload the staged files on Flow, paste the prompt, review options, then click Generate on Flow.

To make installer and portable builds:

```powershell
npm ci
npm test
npm run dist:win
```

Build outputs go to `desktop-companion/release/`. The app is unsigned in this source version; sign it with GEN-Z.AI's production code-signing identity before public distribution. Windows SmartScreen may warn about unsigned builds.

## Security boundary

- The remote page runs with context isolation and sandbox enabled; Node integration is off.
- The preload exposes only `getStatus`, `stageReferences`, and `handoffTask`. Every IPC method verifies the exact production site origin.
- Reference filenames are generated locally; content signatures, MIME types, 12 MB per-file size, and the eight-image limit are validated before writing.
- Reference bytes are copied only after a native confirmation. They are never uploaded by this companion and are removed after 24 hours.
- Google credentials, cookies, browser profiles, and generated media are not accessed.
- Browser permissions are denied. There is no loopback server, and external navigation is restricted to Google Flow.
