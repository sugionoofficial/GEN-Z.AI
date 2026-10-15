package com.genzai.ai;

import android.Manifest;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {
    private static final int WRITE_STORAGE_PERMISSION_REQUEST = 7301;
    private final List<PendingDownload> pendingDownloads = new ArrayList<>();
    private final List<BlobDownload> pendingBlobDownloads = new ArrayList<>();
    private final ConcurrentHashMap<String, BlobDownload> blobDownloads =
        new ConcurrentHashMap<>();
    private float pullStartX;
    private float pullStartY;
    private boolean pullStartedAtTop;
    private boolean pullRefreshTriggered;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new AndroidDownloadBridge(), "GENZAndroidDownloads");
        webView.post(webView::reload);
        webView.setDownloadListener(
            (url, userAgent, contentDisposition, mimeType, contentLength) -> {
                handleUrlDownload(
                    url,
                    userAgent,
                    contentDisposition,
                    mimeType,
                    getRefererOrigin()
                );
            }
        );
        configurePullToRefresh(webView);
        hideSystemBars();
    }

    private void handleUrlDownload(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType,
        String referer
    ) {
        if (url == null || url.isEmpty()) {
            showDownloadMessage("Tautan unduhan tidak valid.");
            return;
        }

        Uri downloadUri = Uri.parse(url);
        String scheme = downloadUri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            Log.w("GENZ.AI", "Unsupported download URL scheme: " + scheme);
            showDownloadMessage("Tautan unduhan ini tidak didukung.");
            return;
        }

        String fileName = safeFileName(
            URLUtil.guessFileName(url, contentDisposition, mimeType)
        );
        PendingDownload download = new PendingDownload(
            url,
            userAgent,
            mimeType,
            fileName,
            referer
        );

        runOnUiThread(() -> {
            if (
                Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
                checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED
            ) {
                pendingDownloads.add(download);
                requestPermissions(
                    new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE },
                    WRITE_STORAGE_PERMISSION_REQUEST
                );
                showDownloadMessage("Izinkan akses penyimpanan untuk mengunduh file.");
                return;
            }
            enqueueDownload(download);
        });
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != WRITE_STORAGE_PERMISSION_REQUEST) return;

        if (
            grantResults.length == 0 ||
            grantResults[0] != PackageManager.PERMISSION_GRANTED
        ) {
            pendingDownloads.clear();
            for (BlobDownload download : pendingBlobDownloads) {
                discardBlobDownload(download);
            }
            pendingBlobDownloads.clear();
            showDownloadMessage("Izin penyimpanan diperlukan untuk mengunduh file.");
            return;
        }

        for (PendingDownload download : new ArrayList<>(pendingDownloads)) {
            enqueueDownload(download);
        }
        pendingDownloads.clear();

        for (BlobDownload download : new ArrayList<>(pendingBlobDownloads)) {
            publishBlobDownload(download);
        }
        pendingBlobDownloads.clear();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void enqueueDownload(PendingDownload download) {
        DownloadManager downloadManager =
            (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            Log.e("GENZ.AI", "Android DownloadManager is unavailable.");
            showDownloadMessage("Unduhan gagal dimulai. Silakan coba lagi.");
            return;
        }

        try {
            DownloadManager.Request request =
                new DownloadManager.Request(Uri.parse(download.url));
            request.setTitle(download.fileName);
            request.setDescription("Mengunduh file dari GEN-Z.AI");
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                download.fileName
            );

            if (download.mimeType != null && !download.mimeType.isEmpty()) {
                request.setMimeType(download.mimeType);
            }
            if (download.userAgent != null && !download.userAgent.isEmpty()) {
                request.addRequestHeader("User-Agent", download.userAgent);
            }

            String cookies = CookieManager.getInstance().getCookie(download.url);
            if (cookies != null && !cookies.isEmpty()) {
                request.addRequestHeader("Cookie", cookies);
            }
            if (download.referer != null && !download.referer.isEmpty()) {
                request.addRequestHeader("Referer", download.referer);
            }

            downloadManager.enqueue(request);
            showDownloadMessage("Unduhan dimulai. File akan tersimpan di folder Downloads.");
        } catch (RuntimeException error) {
            Log.e("GENZ.AI", "Unable to start file download.", error);
            showDownloadMessage("Unduhan gagal dimulai. Silakan coba lagi.");
        }
    }

    private void showDownloadMessage(String message) {
        runOnUiThread(() ->
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        );
    }

    private boolean publishBlobDownload(BlobDownload download) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                publishBlobToMediaStore(download);
            } else {
                File downloadsDirectory = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                );
                if (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs()) {
                    throw new IllegalStateException("Folder Downloads tidak dapat dibuat.");
                }
                File destination = new File(downloadsDirectory, download.fileName);
                copyFile(download.temporaryFile, destination);
            }

            discardBlobDownload(download);
            showDownloadMessage("File berhasil disimpan di folder Downloads.");
            return true;
        } catch (Exception error) {
            Log.e("GENZ.AI", "Unable to save downloaded file.", error);
            discardBlobDownload(download);
            showDownloadMessage("File gagal disimpan. Silakan coba unduh kembali.");
            return false;
        }
    }

    private void publishBlobToMediaStore(BlobDownload download) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, download.fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, download.mimeType);
        values.put(
            MediaStore.Downloads.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS + "/GEN-Z.AI"
        );
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri destination = getContentResolver().insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values
        );
        if (destination == null) {
            throw new IllegalStateException("Android tidak dapat membuat file unduhan.");
        }

        boolean completed = false;
        try {
            OutputStream output = getContentResolver().openOutputStream(destination);
            if (output == null) {
                throw new IllegalStateException("File unduhan tidak dapat dibuka.");
            }
            try (OutputStream fileOutput = output) {
                copyFile(download.temporaryFile, fileOutput);
            }

            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Downloads.IS_PENDING, 0);
            int updated = getContentResolver().update(destination, ready, null, null);
            if (updated == 0) {
                throw new IllegalStateException("File unduhan tidak dapat diterbitkan.");
            }
            completed = true;
        } finally {
            if (!completed) {
                getContentResolver().delete(destination, null, null);
            }
        }
    }

    private static void copyFile(File source, File destination) throws Exception {
        try (
            FileInputStream input = new FileInputStream(source);
            FileOutputStream output = new FileOutputStream(destination)
        ) {
            copyFile(input, output);
        }
    }

    private static void copyFile(File source, OutputStream output) throws Exception {
        try (FileInputStream input = new FileInputStream(source)) {
            copyFile(input, output);
        }
    }

    private static void copyFile(FileInputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        output.flush();
    }

    private void discardBlobDownload(BlobDownload download) {
        blobDownloads.remove(download.id);
        if (download.output != null) {
            try {
                download.output.close();
            } catch (Exception error) {
                Log.w("GENZ.AI", "Unable to close temporary download file.", error);
            }
            download.output = null;
        }
        if (download.temporaryFile.exists() && !download.temporaryFile.delete()) {
            Log.w("GENZ.AI", "Unable to remove temporary download file.");
        }
    }

    private static String safeFileName(String name) {
        String safeName = sanitizeFileName(name == null ? "" : name.trim());
        return safeName.isEmpty() ? "GEN-Z.AI-download" : safeName;
    }

    private final class AndroidDownloadBridge {
        @JavascriptInterface
        public void downloadUrl(
            String url,
            String fileName,
            String mimeType,
            String referer,
            String userAgent
        ) {
            String disposition = fileName == null || fileName.isEmpty()
                ? null
                : "attachment; filename=\"" + fileName.replace("\"", "") + "\"";
            handleUrlDownload(
                url,
                userAgent,
                disposition,
                mimeType,
                referer
            );
        }

        @JavascriptInterface
        public String beginBlobDownload(String fileName, String mimeType) {
            try {
                File directory = new File(getCacheDir(), "downloads");
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IllegalStateException("Folder sementara unduhan tidak dapat dibuat.");
                }

                String id = UUID.randomUUID().toString();
                File temporaryFile = new File(directory, id + ".part");
                BlobDownload download = new BlobDownload(
                    id,
                    safeFileName(fileName),
                    mimeType == null || mimeType.isEmpty()
                        ? "application/octet-stream"
                        : mimeType,
                    temporaryFile,
                    new FileOutputStream(temporaryFile)
                );
                blobDownloads.put(id, download);
                return id;
            } catch (Exception error) {
                Log.e("GENZ.AI", "Unable to prepare file download.", error);
                showDownloadMessage("Unduhan gagal disiapkan.");
                return "";
            }
        }

        @JavascriptInterface
        public boolean writeBlobChunk(String id, String base64Chunk) {
            BlobDownload download = blobDownloads.get(id);
            if (download == null || base64Chunk == null) return false;

            try {
                byte[] bytes = Base64.decode(base64Chunk, Base64.DEFAULT);
                synchronized (download) {
                    download.output.write(bytes);
                }
                return true;
            } catch (Exception error) {
                Log.e("GENZ.AI", "Unable to write downloaded file data.", error);
                discardBlobDownload(download);
                return false;
            }
        }

        @JavascriptInterface
        public boolean finishBlobDownload(String id) {
            BlobDownload download = blobDownloads.get(id);
            if (download == null) return false;

            try {
                synchronized (download) {
                    download.output.flush();
                    download.output.close();
                    download.output = null;
                }
                if (
                    Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
                    checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED
                ) {
                    runOnUiThread(() -> {
                        pendingBlobDownloads.add(download);
                        requestPermissions(
                            new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE },
                            WRITE_STORAGE_PERMISSION_REQUEST
                        );
                        showDownloadMessage("Izinkan akses penyimpanan untuk menyimpan file.");
                    });
                    return true;
                }
                return publishBlobDownload(download);
            } catch (Exception error) {
                Log.e("GENZ.AI", "Unable to finish downloaded file.", error);
                discardBlobDownload(download);
                showDownloadMessage("File gagal disimpan. Silakan coba unduh kembali.");
                return false;
            }
        }

        @JavascriptInterface
        public void cancelBlobDownload(String id) {
            BlobDownload download = blobDownloads.get(id);
            if (download != null) discardBlobDownload(download);
        }

        @JavascriptInterface
        public void notifyDownloadFailure() {
            showDownloadMessage("File gagal diunduh. Silakan coba kembali.");
        }
    }

    private static class BlobDownload {
        final String id;
        final String fileName;
        final String mimeType;
        final File temporaryFile;
        OutputStream output;

        BlobDownload(
            String id,
            String fileName,
            String mimeType,
            File temporaryFile,
            OutputStream output
        ) {
            this.id = id;
            this.fileName = fileName;
            this.mimeType = mimeType;
            this.temporaryFile = temporaryFile;
            this.output = output;
        }
    }

    private void configurePullToRefresh(WebView webView) {
        int touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        int refreshThreshold = Math.max(
            touchSlop * 3,
            (int) (56 * getResources().getDisplayMetrics().density)
        );
        webView.setOnTouchListener((view, event) -> {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    pullStartX = event.getX();
                    pullStartY = event.getY();
                    pullStartedAtTop =
                        webView.getScrollY() <= 0 &&
                        !webView.canScrollVertically(-1);
                    pullRefreshTriggered = false;
                    break;
                case MotionEvent.ACTION_MOVE:
                    float deltaY = event.getY() - pullStartY;
                    float deltaX = Math.abs(event.getX() - pullStartX);
                    if (
                        pullStartedAtTop &&
                        !pullRefreshTriggered &&
                        !webView.canScrollVertically(-1) &&
                        deltaY >= refreshThreshold &&
                        deltaX < deltaY / 2
                    ) {
                        pullRefreshTriggered = true;
                        webView.reload();
                        return true;
                    }
                    break;
                case MotionEvent.ACTION_UP:
                    pullStartedAtTop = false;
                    pullRefreshTriggered = false;
                    break;
                case MotionEvent.ACTION_CANCEL:
                    pullStartedAtTop = false;
                    pullRefreshTriggered = false;
                    break;
                default:
                    break;
            }
            return false;
        });
    }

    private String getRefererOrigin() {
        String pageUrl = getBridge().getWebView().getUrl();
        if (pageUrl == null) return null;

        Uri uri = Uri.parse(pageUrl);
        if (uri.getScheme() == null || uri.getAuthority() == null) return null;
        return uri.buildUpon().path("/").query(null).fragment(null).build().toString();
    }

    private static String sanitizeFileName(String fileName) {
        String safeName = fileName
            .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_")
            .trim();
        return safeName.isEmpty() ? "download" : safeName;
    }

    private static class PendingDownload {
        final String url;
        final String userAgent;
        final String mimeType;
        final String fileName;
        final String referer;

        PendingDownload(
            String url,
            String userAgent,
            String mimeType,
            String fileName,
            String referer
        ) {
            this.url = url;
            this.userAgent = userAgent;
            this.mimeType = mimeType;
            this.fileName = fileName;
            this.referer = referer;
        }
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                );
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
