'use strict';

const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const { validateTask } = require('./task-validator.cjs');
const { removeExpiredStagingDirectories, stageReferences } = require('./reference-stager.cjs');

const STUDIO_URL = 'https://genzai.genzai-f37.workers.dev/studio-flow/index.html';
const STUDIO_ORIGIN = new URL(STUDIO_URL).origin;
const FLOW_URL = 'https://flow.google.com/';
let mainWindow;

function isFlowUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === 'flow.google.com';
    } catch {
        return false;
    }
}

function assertTrustedSender(event) {
    const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || '';
    let origin = '';
    try { origin = new URL(senderUrl).origin; } catch {}
    if (origin !== STUDIO_ORIGIN) {
        throw new Error('Permintaan ditolak: sumber halaman tidak dikenal.');
    }
}

function wireNavigationSecurity(window) {
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (isFlowUrl(url)) {
            void shell.openExternal(FLOW_URL);
        }
        return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, targetUrl) => {
        let targetOrigin = '';
        try { targetOrigin = new URL(targetUrl).origin; } catch {}
        if (targetOrigin === STUDIO_ORIGIN) return;
        event.preventDefault();
        if (isFlowUrl(targetUrl)) void shell.openExternal(FLOW_URL);
    });

    window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 980,
        minHeight: 680,
        title: 'GEN-Z.AI STUDIO FLOW Companion',
        backgroundColor: '#080b12',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });

    wireNavigationSecurity(mainWindow);
    mainWindow.loadURL(STUDIO_URL);
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    app.setAppUserModelId('ai.genz.studioflow.companion');

    ipcMain.handle('studio-flow:get-status', (event) => {
        assertTrustedSender(event);
        return {
            connected: true,
            protocolVersion: 1,
            mode: 'manual-flow-handoff'
        };
    });

    const referenceRoot = path.join(app.getPath('userData'), 'flow-reference-staging');
    const cleanStaging = () => removeExpiredStagingDirectories(referenceRoot).catch(() => {});
    void cleanStaging();
    const stagingCleanupTimer = setInterval(cleanStaging, 60 * 60 * 1000);
    stagingCleanupTimer.unref();

    ipcMain.handle('studio-flow:stage-references', async (event, references) => {
        assertTrustedSender(event);
        if (!Array.isArray(references) || references.length < 1 || references.length > 8) {
            throw new Error('Pilih antara satu dan delapan referensi.');
        }
        const confirmation = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: 'Siapkan referensi untuk Google Flow',
            message: 'Companion akan menyalin gambar terpilih ke folder sementara lokal dan membukanya di File Explorer.',
            detail: 'Gambar tidak diunggah otomatis. Kamu akan memilih dan mengunggahnya sendiri di Google Flow. Salinan sementara dihapus otomatis setelah 24 jam.',
            buttons: ['Batal', 'Salin & buka folder'],
            defaultId: 1,
            cancelId: 0,
            noLink: true
        });
        if (confirmation.response !== 1) return { accepted: false, cancelled: true };

        const staged = await stageReferences(references, referenceRoot);
        const openError = await shell.openPath(staged.directory);
        if (openError) throw new Error('Folder referensi tersimpan tetapi File Explorer gagal dibuka.');
        return { accepted: true, count: staged.count };
    });

    ipcMain.handle('studio-flow:handoff-task', async (event, payload) => {
        assertTrustedSender(event);
        const task = validateTask(payload);

        // The handoff opens the supported public Flow website and copies only the
        // prompt. Google cookies, browser profiles, and private Flow endpoints are
        // never accessed; selected references are staged locally only via separate IPC.
        clipboard.writeText(task.prompt);
        await shell.openExternal(FLOW_URL);

        return {
            accepted: true,
            protocolVersion: 1,
            handoffOnly: true,
            promptCopied: true,
            referencesRequireManualUpload: task.referenceCount > 0,
            message: task.referenceCount > 0
                ? 'Google Flow dibuka dan prompt disalin. Folder sementara referensi juga terbuka; unggah gambar dari sana, periksa pengaturan, lalu tekan Generate di Flow.'
                : 'Google Flow dibuka dan prompt disalin. Tempel prompt, periksa pengaturan, lalu tekan Generate langsung di Flow.'
        };
    });

    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
