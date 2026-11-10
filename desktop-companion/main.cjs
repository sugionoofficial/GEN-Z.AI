'use strict';

const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const path = require('node:path');
const { applyVisibleTask, clickVisibleGenerate, setVisibleFileInput } = require('./flow-ui-automation.cjs');
const { validateTask } = require('./task-validator.cjs');
const { removeExpiredStagingDirectories, stageReferences } = require('./reference-stager.cjs');

const STUDIO_URL = 'https://genzai.genzai-f37.workers.dev/studio-flow/index.html';
const STUDIO_ORIGIN = new URL(STUDIO_URL).origin;
const FLOW_URL = 'https://flow.google.com/';
const FLOW_PARTITION = 'persist:studio-flow-google';
const GOOGLE_UI_HOSTS = new Set(['flow.google.com', 'accounts.google.com', 'myaccount.google.com', 'www.google.com']);
let mainWindow;
let flowWindow;
let flowLoadPromise = null;
let referenceRoot;
let outputRoot;
let activeFlowJob = null;
let outputImportChain = Promise.resolve();
let flowDownloadListenerInstalled = false;
let updateState = { state: 'idle' };
let updateCheckTimer = null;
const stagedDirectories = new Map();

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

function notifyStudioPage(message) {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('studio-flow:output-imported', message);
    }
}

function setUpdateState(state, details = {}) {
    updateState = { state, ...details };
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('studio-flow:update-state', updateState);
    }
}

function configureAutoUpdates() {
    if (process.platform !== 'win32' || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.on('checking-for-update', () => setUpdateState('checking'));
    autoUpdater.on('update-available', info => setUpdateState('available', {
        version: String(info?.version || '').slice(0, 40)
    }));
    autoUpdater.on('update-not-available', () => setUpdateState('idle'));
    autoUpdater.on('download-progress', progress => setUpdateState('downloading', {
        version: updateState.version || '',
        percent: Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0)))
    }));
    autoUpdater.on('update-downloaded', info => {
        setUpdateState('installing', { version: String(info?.version || updateState.version || '').slice(0, 40) });
        setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
    });
    autoUpdater.on('error', error => {
        const message = String(error?.message || 'Pembaruan Companion gagal.').slice(0, 220);
        console.warn('[STUDIO FLOW Companion] Auto-update error:', message);
        if (updateState.state === 'downloading') setUpdateState('error', { version: updateState.version || '', message });
        else setUpdateState('idle');
    });

    const check = () => autoUpdater.checkForUpdates().catch(error => {
        console.warn('[STUDIO FLOW Companion] Update check failed:', String(error?.message || 'unknown error').slice(0, 220));
        if (updateState.state === 'checking') setUpdateState('idle');
    });
    setTimeout(check, 5000).unref();
    updateCheckTimer = setInterval(check, 6 * 60 * 60 * 1000);
    updateCheckTimer.unref();
}

async function downloadCompanionUpdate() {
    if (process.platform !== 'win32' || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) {
        throw new Error('Pembaruan otomatis tersedia untuk aplikasi Windows yang dipasang melalui installer.');
    }
    if (updateState.state !== 'available' && updateState.state !== 'error') {
        throw new Error('Belum ada pembaruan yang siap diunduh.');
    }
    setUpdateState('downloading', { version: updateState.version || '', percent: 0 });
    try {
        await autoUpdater.downloadUpdate();
        return { accepted: true };
    } catch (error) {
        const message = String(error?.message || 'Pembaruan Companion gagal diunduh.').slice(0, 220);
        setUpdateState('error', { version: updateState.version || '', message });
        throw new Error(message);
    }
}

function flowDownloadMime(item) {
    const mime = String(item.getMimeType?.() || '').split(';')[0].trim().toLowerCase();
    const byMime = new Map([
        ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
        ['video/mp4', 'mp4'], ['video/webm', 'webm']
    ]);
    if (byMime.has(mime)) return { mime, extension: byMime.get(mime) };
    const extension = path.extname(item.getFilename?.() || '').toLowerCase();
    const byExtension = new Map([
        ['.jpg', ['image/jpeg', 'jpg']], ['.jpeg', ['image/jpeg', 'jpg']],
        ['.png', ['image/png', 'png']], ['.webp', ['image/webp', 'webp']],
        ['.mp4', ['video/mp4', 'mp4']], ['.webm', ['video/webm', 'webm']]
    ]);
    const detected = byExtension.get(extension);
    return detected ? { mime: detected[0], extension: detected[1] } : null;
}

async function importFlowDownload(filePath, mime, job) {
    try {
        const details = await fs.stat(filePath);
        if (!details.size || details.size > 50 * 1024 * 1024) throw new Error('File hasil lebih besar dari batas 50 MB.');
        const bytes = await fs.readFile(filePath);
        const endpoint = `${STUDIO_ORIGIN}/api/social-publisher?action=studio-flow-save-result&history_id=${encodeURIComponent(job.historyId)}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${job.accessToken}`, 'Content-Type': mime },
            body: bytes
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Hasil gagal dikembalikan (${response.status}).`);
        job.remaining -= 1;
        notifyStudioPage({
            success: true,
            historyId: job.historyId,
            count: data.item?.outputs?.length || job.outputCount - job.remaining,
            done: job.remaining <= 0,
            message: 'Hasil Google Flow sudah disimpan ke Riwayat STUDIO FLOW.'
        });
        await fs.rm(filePath, { force: true });
        if (activeFlowJob === job && job.remaining <= 0) {
            clearTimeout(job.expiryTimer);
            activeFlowJob = null;
        }
    } catch (error) {
        notifyStudioPage({
            success: false,
            historyId: job.historyId,
            fileSavedLocally: true,
            message: `${error.message || 'Hasil belum dapat disimpan ke riwayat.'} File tetap disimpan sementara di komputer ini.`
        });
        const choice = await dialog.showMessageBox(mainWindow || undefined, {
            type: 'warning',
            title: 'Hasil Flow belum masuk ke riwayat',
            message: 'Upload hasil ke STUDIO FLOW gagal. File lokal tidak dihapus dan akan dibersihkan otomatis setelah 24 jam.',
            detail: filePath,
            buttons: ['Tutup', 'Tampilkan file lokal'],
            defaultId: 1,
            cancelId: 0,
            noLink: true
        });
        if (choice.response === 1) shell.showItemInFolder(filePath);
    }
}

function installFlowDownloadListener(flowSession) {
    if (flowDownloadListenerInstalled) return;
    flowDownloadListenerInstalled = true;
    flowSession.on('will-download', (_event, item, sourceContents) => {
        const job = activeFlowJob;
        if (!job || sourceContents !== flowWindow?.webContents) return;
        const detected = flowDownloadMime(item);
        if (!detected) return;
        const taskDirectory = path.join(outputRoot, job.historyId);
        fsSync.mkdirSync(taskDirectory, { recursive: true });
        const filePath = path.join(taskDirectory, `${crypto.randomUUID()}.${detected.extension}`);
        item.setSavePath(filePath);
        item.once('done', (_downloadEvent, state) => {
            if (state !== 'completed') {
                notifyStudioPage({ success: false, historyId: job.historyId, message: 'Unduhan hasil Flow dibatalkan atau gagal.' });
                return;
            }
            outputImportChain = outputImportChain.then(() => importFlowDownload(filePath, detected.mime, job));
        });
    });
}

function isAllowedFlowNavigation(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && GOOGLE_UI_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

function createFlowWindow() {
    if (flowWindow && !flowWindow.isDestroyed()) {
        flowWindow.show();
        flowWindow.focus();
        return flowWindow;
    }
    const flowSession = session.fromPartition(FLOW_PARTITION);
    installFlowDownloadListener(flowSession);
    flowSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    flowWindow = new BrowserWindow({
        parent: mainWindow || undefined,
        width: 1380,
        height: 900,
        minWidth: 980,
        minHeight: 680,
        title: 'Google Flow · STUDIO FLOW Companion',
        backgroundColor: '#080b12',
        autoHideMenuBar: true,
        webPreferences: {
            session: flowSession,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });
    flowWindow.webContents.setWindowOpenHandler(({ url }) => ({ action: isAllowedFlowNavigation(url) ? 'allow' : 'deny' }));
    flowWindow.webContents.on('will-navigate', (event, targetUrl) => {
        if (!isAllowedFlowNavigation(targetUrl)) event.preventDefault();
    });
    flowWindow.on('closed', () => { flowWindow = null; flowLoadPromise = null; });
    flowLoadPromise = flowWindow.loadURL(FLOW_URL);
    return flowWindow;
}

async function ensureFlowReady() {
    const window = createFlowWindow();
    if (flowLoadPromise) await flowLoadPromise;
    if (window.webContents.isLoadingMainFrame()) {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Google Flow masih dimuat. Coba lagi sebentar.')), 30_000);
            window.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(); });
            window.webContents.once('did-fail-load', (_event, code, description) => { clearTimeout(timeout); reject(new Error(`Google Flow gagal dimuat (${code}): ${description}`)); });
        });
    }
    await new Promise(resolve => setTimeout(resolve, 2200));
    return window;
}

function wireNavigationSecurity(window) {
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (isFlowUrl(url)) {
            createFlowWindow();
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, targetUrl) => {
        let targetOrigin = '';
        try { targetOrigin = new URL(targetUrl).origin; } catch {}
        if (targetOrigin === STUDIO_ORIGIN) return;
        event.preventDefault();
        if (isFlowUrl(targetUrl)) createFlowWindow();
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
            protocolVersion: 2,
            mode: 'visible-flow-ui-automation'
        };
    });
    ipcMain.handle('studio-flow:get-update-state', event => {
        assertTrustedSender(event);
        return updateState;
    });
    ipcMain.handle('studio-flow:download-update', async event => {
        assertTrustedSender(event);
        return downloadCompanionUpdate();
    });

    referenceRoot = path.join(app.getPath('userData'), 'flow-reference-staging');
    outputRoot = path.join(app.getPath('userData'), 'flow-output-imports');
    fsSync.mkdirSync(outputRoot, { recursive: true });
    const cleanStaging = () => Promise.all([
        removeExpiredStagingDirectories(referenceRoot).catch(() => 0),
        removeExpiredStagingDirectories(outputRoot).catch(() => 0)
    ]);
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
            message: 'Companion akan menyalin gambar terpilih ke folder sementara lokal lalu mengunggahkannya melalui kontrol Flow yang terlihat.',
            detail: 'File hanya dipakai untuk task ini dan dihapus otomatis setelah 24 jam. Companion tidak mengirim gambar ke GEN-Z.AI atau membaca cookie Google.',
            buttons: ['Batal', 'Izinkan unggah referensi'],
            defaultId: 1,
            cancelId: 0,
            noLink: true
        });
        if (confirmation.response !== 1) return { accepted: false, cancelled: true };

        const staged = await stageReferences(references, referenceRoot);
        const stagingId = path.basename(staged.directory);
        stagedDirectories.set(stagingId, staged.directory);
        return { accepted: true, count: staged.count, stagingId };
    });

    ipcMain.handle('studio-flow:handoff-task', async (event, payload, stagingId = '', authContext = {}) => {
        assertTrustedSender(event);
        const task = validateTask(payload);
        const historyId = String(authContext?.historyId || '');
        const accessToken = String(authContext?.accessToken || '');
        if (!/^[0-9a-f-]{36}$/i.test(historyId) || accessToken.length < 20 || accessToken.length > 8192) {
            throw new Error('Sesi akun atau ID riwayat tidak valid. Muat ulang halaman lalu coba lagi.');
        }
        if (activeFlowJob) {
            return { accepted: false, busy: true, message: 'Task sebelumnya masih aktif. Unduh hasilnya dari jendela Flow atau tunggu sampai sesi task lama berakhir.' };
        }
        const stagedDirectory = stagingId ? stagedDirectories.get(String(stagingId)) : '';
        if (task.referenceCount > 0 && !stagedDirectory) {
            throw new Error('Folder referensi companion tidak tersedia. Pilih ulang referensi dan coba lagi.');
        }
        if (stagedDirectory && (await fs.readdir(stagedDirectory)).length !== task.referenceCount) {
            throw new Error('Jumlah file referensi tidak cocok dengan pilihan task.');
        }

        const flow = await ensureFlowReady();
        if (flow.isMinimized()) flow.restore();
        flow.show();
        flow.focus();

        const formStatus = await applyVisibleTask(flow.webContents, task);
        if (formStatus.needsLogin) {
            return {
                accepted: false,
                needsLogin: true,
                message: 'Login ke akun Google di jendela Flow dalam companion, lalu klik Siapkan di Google Flow lagi.'
            };
        }
        if (!formStatus.ok) {
            return {
                accepted: false,
                needsManualReview: true,
                missing: formStatus.missing || [],
                message: 'Companion tidak mengenali semua kontrol Flow. Jendela Flow tetap terbuka; lengkapi pengaturan yang ditandai secara manual.'
            };
        }

        if (stagedDirectory) {
            const referencePaths = await fs.readdir(stagedDirectory);
            const paths = referencePaths.map(name => path.join(stagedDirectory, name));
            const uploadStatus = await setVisibleFileInput(flow.webContents, paths);
            if (!uploadStatus.ok) {
                return {
                    accepted: false,
                    needsManualReview: true,
                    missing: [uploadStatus.reason],
                    message: 'Prompt dan opsi sudah disiapkan, tetapi referensi belum terpasang. Tambahkan file di jendela Flow sebelum Generate.'
                };
            }
        }

        const confirmation = await dialog.showMessageBox(flow, {
            type: 'warning',
            title: 'Konfirmasi penggunaan kredit Google Flow',
            message: `Kirim task ${task.mediaType === 'image' ? 'gambar' : 'video'} ke Flow sekarang?`,
            detail: `${task.model} · ${task.ratio} · ${task.outputCount} output${task.mediaType === 'video' ? ` · ${task.duration} detik` : ''}. Google Flow akan menggunakan kredit/kuota akun Anda; biaya final ditentukan Flow. Periksa prompt dan pengaturan yang terlihat sebelum menyetujui.`,
            buttons: ['Batal', 'Generate di Flow'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
        });
        if (confirmation.response !== 1) return { accepted: false, cancelled: true, message: 'Generate dibatalkan; task tetap terlihat di jendela Flow.' };

        const job = { historyId, accessToken, remaining: task.outputCount, outputCount: task.outputCount };
        job.expiryTimer = setTimeout(() => {
            if (activeFlowJob !== job) return;
            activeFlowJob = null;
            notifyStudioPage({ success: false, historyId, message: 'Waktu pengembalian hasil habis. Hasil tetap tersedia di jendela Flow; unduh lagi setelah task baru dibuat jika diperlukan.' });
        }, 45 * 60 * 1000);
        job.expiryTimer.unref();
        activeFlowJob = job;
        const generated = await clickVisibleGenerate(flow.webContents);
        if (!generated.clicked) {
            clearTimeout(job.expiryTimer);
            if (activeFlowJob === job) activeFlowJob = null;
            return { accepted: false, needsManualReview: true, message: generated.reason || 'Tombol Generate Flow belum ditemukan.' };
        }
        if (stagingId) stagedDirectories.delete(String(stagingId));
        return {
            accepted: true,
            protocolVersion: 2,
            generationSubmitted: true,
            mode: 'visible-flow-ui-automation',
            message: 'Task dikirim ke tombol Generate di UI Google Flow yang terlihat dalam companion. Setelah hasil siap, klik Download pada hasil di jendela itu; companion akan mengimpor file ke Riwayat STUDIO FLOW.'
        };
    });

    createWindow();
    configureAutoUpdates();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
