package com.genzai.ai;

import android.Manifest;
import android.app.DownloadManager;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int WRITE_STORAGE_PERMISSION_REQUEST = 7301;
    private final List<PendingDownload> pendingDownloads = new ArrayList<>();
    private float pullStartX;
    private float pullStartY;
    private boolean pullStartedAtTop;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.setDownloadListener(
            (url, userAgent, contentDisposition, mimeType, contentLength) -> {
                Uri downloadUri = Uri.parse(url);
                String scheme = downloadUri.getScheme();
                if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                    Log.w("GENZ.AI", "Unsupported download URL scheme: " + scheme);
                    showDownloadMessage("Tautan unduhan ini tidak didukung.");
                    return;
                }

                String fileName = sanitizeFileName(
                    URLUtil.guessFileName(url, contentDisposition, mimeType)
                );
                PendingDownload download = new PendingDownload(
                    url,
                    userAgent,
                    mimeType,
                    fileName,
                    getRefererOrigin()
                );

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
                    return;
                }

                enqueueDownload(download);
            }
        );
        configurePullToRefresh(webView);
        hideSystemBars();
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
            showDownloadMessage("Izin penyimpanan diperlukan untuk mengunduh file.");
            return;
        }

        for (PendingDownload download : new ArrayList<>(pendingDownloads)) {
            enqueueDownload(download);
        }
        pendingDownloads.clear();
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

    private void configurePullToRefresh(WebView webView) {
        int touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        int refreshThreshold = Math.max(
            touchSlop * 4,
            (int) (96 * getResources().getDisplayMetrics().density)
        );
        webView.setOnTouchListener((view, event) -> {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    pullStartX = event.getX();
                    pullStartY = event.getY();
                    pullStartedAtTop = webView.getScrollY() == 0;
                    break;
                case MotionEvent.ACTION_UP:
                    float deltaY = event.getY() - pullStartY;
                    float deltaX = Math.abs(event.getX() - pullStartX);
                    if (
                        pullStartedAtTop &&
                        webView.getScrollY() == 0 &&
                        deltaY >= refreshThreshold &&
                        deltaX < deltaY / 2
                    ) {
                        webView.reload();
                    }
                    pullStartedAtTop = false;
                    break;
                case MotionEvent.ACTION_CANCEL:
                    pullStartedAtTop = false;
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
