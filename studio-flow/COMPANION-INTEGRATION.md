# STUDIO FLOW Windows companion

## Integrated flow

`desktop-companion/` contains the Windows Electron app. It embeds the Studio Flow workspace and loads Google Flow in a separate, hidden sandboxed window inside the companion for background task handling. After the Studio Medsos access check succeeds, the **Kirim Generate via Flow** button sends the selected task to the companion's narrow bridge.

The companion uses visible Flow DOM controls in its hidden window to fill the prompt, model, aspect ratio, video mode/duration, and output count. Selected references are copied to a generated-name temporary directory silently as part of the user-submitted task, then supplied through Flow's visible file input. If any required control or upload slot cannot be identified, the companion stops before Generate and opens the Flow window for recovery. During a successful task, the Flow window remains hidden in the background. It does not silently guess or call private Google endpoints.

The Generate button is clicked in the hidden Flow window immediately after the user submits the task from STUDIO FLOW. Google Flow credits/limits still apply. No extra confirmation dialogs or routine Flow window popups interrupt the task; the Flow window is shown only if sign-in or manual recovery is required.

## Returning results to Studio Flow

The user clicks Google Flow's visible **Download** control for each completed output. Electron captures that download from its Flow session and sends the file through an authenticated GEN-Z.AI API route. The API verifies the current user, validates media type/signature and the 50 MB limit, writes to the private `studio-flow-results` bucket under that user's path, and records the object key in their history row. History reads create short-lived signed URLs so the Studio Flow page can display image/video previews without public storage links. A task is marked complete after its requested number of outputs is imported.

This means results do return to the Studio Flow history, but the download click remains a visible user action; the companion never clicks Download on the user's behalf. If Flow UI controls change, automation stops rather than sending a guessed task. Unsupported formats or files over 50 MB remain in the Flow UI and are not imported.

## Data/security boundary

- Google authentication occurs in the companion's persistent Flow browser partition. The app never reads or exports passwords, cookies, or browser profile files.
- Flow operates through the visible website and user-visible controls. No private Flow API or undocumented network endpoint is used.
- The Studio webpage has no Node or local-network access. The preload exposes only a small, origin-checked API; Flow itself is a separate sandboxed BrowserWindow with no preload.
- Submitting a task from STUDIO FLOW authorizes staging its selected references; local copies are cleaned after 24 hours. Generated downloads are uploaded only after the user invokes Download; failed-upload local copies are also cleaned after 24 hours.
- Supabase result storage is private and RLS-scoped by the authenticated owner's UUID. The API independently filters every history row by that UUID.

## In-app updates

The installed NSIS version checks the stable GitHub Releases feed at startup and every six hours. When a release is available, STUDIO FLOW shows a top banner; clicking **Perbarui sekarang** downloads it, reports progress, then restarts the companion to apply it. Portable executables do not auto-update. Installs from before version 0.2.0 need one final manual install to gain the updater; after that, new tagged releases install in-app. Maintainers bump `desktop-companion/package.json` for each shipped version, and the main-branch companion workflow publishes the matching versioned release after packaging.

## Build/run

See `desktop-companion/README.md`. Windows installer and portable builds are produced by `.github/workflows/studio-flow-companion.yml` for pull requests and main-branch changes. Builds are unsigned until GEN-Z.AI code signing is configured.
