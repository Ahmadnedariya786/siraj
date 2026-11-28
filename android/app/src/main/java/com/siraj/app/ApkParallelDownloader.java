package com.siraj.app;

import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * IDM-style 6-stream parallel HTTP Range APK downloader with:
 * - Multi-hop redirect resolution (301/302/303/307/308)
 * - 1 MB block partitioning across 6 concurrent threads into FileChannel / RandomAccessFile
 * - Per-chunk exponential backoff retry (up to 5 attempts) resuming from exact chunk offset
 * - Disk-persisted pause/resume via siraj-update-<sha>.apk.part & siraj-update-<sha>.meta.json
 * - Automatic multi-mirror failover if a mirror connects fails or averages < 120 KB/s for 10s
 * - Streaming SHA-256 verification and atomic rename on completion
 */
public final class ApkParallelDownloader {
    private static final String TAG = "ApkParallelDownloader";

    public static final int THREAD_COUNT = 6;
    public static final long BLOCK_SIZE_BYTES = 1024L * 1024L; // 1 MB blocks
    public static final long MIN_PARALLEL_BYTES = 2L * 1024L * 1024L; // 2 MB
    public static final int CONNECT_TIMEOUT_MS = 15_000;
    public static final int READ_TIMEOUT_MS = 20_000;
    public static final int MAX_CHUNK_RETRIES = 5;
    public static final int MAX_REDIRECTS = 8;
    public static final double SLOW_MIRROR_BPS = 120.0 * 1024.0;
    public static final long SLOW_MIRROR_WINDOW_MS = 10_000L;
    public static final long PROGRESS_THROTTLE_MS = 250L;
    public static final String USER_AGENT = "Siraj-Android-Updater/3.0";

    public interface Listener {
        void onProgress(
                String state,
                long downloadedBytes,
                long totalBytes,
                int percent,
                long speedBps,
                double speedMBps,
                int activeStreams,
                int etaSeconds,
                String activeMirror
        );

        void onCompleted(File apkFile, long totalBytes);

        void onPaused(long downloadedBytes, long totalBytes, int percent);

        void onError(String errorCode, long downloadedBytes, long totalBytes, boolean shouldFallbackToSystemDm);
    }

    static final class ChunkState {
        final int index;
        final long start;
        final long end;
        final AtomicLong downloaded;

        ChunkState(int index, long start, long end, long downloaded) {
            this.index = index;
            this.start = start;
            this.end = end;
            this.downloaded = new AtomicLong(Math.max(0L, Math.min(end - start + 1L, downloaded)));
        }

        long length() {
            return (end - start) + 1L;
        }

        boolean isComplete() {
            return downloaded.get() >= length();
        }
    }

    static final class ProbeResult {
        final String resolvedUrl;
        final long totalBytes;
        final boolean acceptRanges;

        ProbeResult(String resolvedUrl, long totalBytes, boolean acceptRanges) {
            this.resolvedUrl = resolvedUrl;
            this.totalBytes = totalBytes;
            this.acceptRanges = acceptRanges;
        }
    }

    private final File storageDir;
    private final List<String> mirrors;
    private final long expectedBytes;
    private final String releaseKey;
    private final String expectedSha256;
    private final Listener listener;

    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private final Set<HttpURLConnection> activeConnections = ConcurrentHashMap.newKeySet();
    private final Object metaWriteLock = new Object();

    private volatile List<ChunkState> activeChunks = Collections.emptyList();
    private volatile long activeTotalBytes = 0L;
    private volatile File activeMetaFile = null;
    private volatile File activePartFile = null;

    public ApkParallelDownloader(
            File storageDir,
            List<String> mirrors,
            long expectedBytes,
            String commitSha,
            String expectedSha256,
            Listener listener
    ) {
        this.storageDir = storageDir;
        this.mirrors = sanitizeMirrors(mirrors);
        this.expectedBytes = expectedBytes;
        this.releaseKey = buildReleaseKey(commitSha, this.mirrors.isEmpty() ? "" : this.mirrors.get(0));
        this.expectedSha256 = expectedSha256 != null ? expectedSha256.trim().toLowerCase(Locale.US) : "";
        this.listener = listener;
    }

    public static String buildReleaseKey(String commitSha, String primaryUrl) {
        if (commitSha != null) {
            String cleaned = commitSha.trim().toLowerCase(Locale.US).replaceAll("[^a-f0-9]", "");
            if (cleaned.length() >= 4) {
                return cleaned.substring(0, Math.min(7, cleaned.length()));
            }
        }
        int hash = primaryUrl != null ? primaryUrl.hashCode() : 0;
        return Integer.toHexString(hash & 0x0fffffff);
    }

    private static List<String> sanitizeMirrors(List<String> raw) {
        List<String> result = new ArrayList<>();
        if (raw != null) {
            for (String u : raw) {
                if (u != null) {
                    String trimmed = u.trim();
                    if ((trimmed.startsWith("https://") || trimmed.startsWith("http://")) && !result.contains(trimmed)) {
                        result.add(trimmed);
                    }
                }
            }
        }
        if (result.isEmpty()) {
            result.add("https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk");
        }
        return result;
    }

    public void cancel() {
        cancelled.set(true);
        for (HttpURLConnection conn : activeConnections) {
            try {
                conn.disconnect();
            } catch (Throwable ignored) {
                // Socket close guard
            }
        }
        activeConnections.clear();
        persistMetaSafe();

        long dl = sumDownloadedBytes();
        long tot = activeTotalBytes > 0 ? activeTotalBytes : Math.max(0L, expectedBytes);
        int pct = tot > 0 ? Math.min(99, (int) ((dl * 100L) / tot)) : 0;
        listener.onPaused(dl, tot, pct);
    }

    public void run() {
        if (!storageDir.exists()) {
            storageDir.mkdirs();
        }

        final String baseName = "siraj-update-" + releaseKey;
        final File finalApk = new File(storageDir, baseName + ".apk");
        final File partFile = new File(storageDir, baseName + ".apk.part");
        final File metaFile = new File(storageDir, baseName + ".meta.json");
        this.activePartFile = partFile;
        this.activeMetaFile = metaFile;

        cleanupOtherReleaseArtifacts(storageDir, baseName);

        // Fast-path: already downloaded & verified on disk from an earlier completed run
        if (finalApk.exists() && finalApk.length() > 15_000_000L) {
            if (verifyFileIntegrity(finalApk, expectedBytes, expectedSha256)) {
                listener.onCompleted(finalApk, finalApk.length());
                return;
            } else {
                try {
                    finalApk.delete();
                } catch (Throwable ignored) {
                    // Delete invalid cached apk
                }
            }
        }

        int mirrorIdx = 0;
        ProbeResult probe = null;
        while (mirrorIdx < mirrors.size() && !cancelled.get()) {
            probe = probeMirror(mirrors.get(mirrorIdx));
            if (probe != null && (probe.totalBytes > 0 || expectedBytes > 15_000_000L)) {
                break;
            }
            mirrorIdx++;
        }

        if (cancelled.get()) return;

        if (probe == null) {
            listener.onError("E_CONNECT_FAIL", 0L, Math.max(0L, expectedBytes), true);
            return;
        }

        final long totalBytes = probe.totalBytes > 0 ? probe.totalBytes : expectedBytes;
        this.activeTotalBytes = totalBytes;

        if (!probe.acceptRanges || totalBytes <= MIN_PARALLEL_BYTES) {
            runSingleStreamFallback(mirrors.get(Math.min(mirrorIdx, mirrors.size() - 1)), partFile, finalApk, totalBytes);
            return;
        }

        // Load saved resume progress OR pre-allocate contiguous 1MB chunks
        List<ChunkState> chunks;
        try {
            chunks = loadOrInitChunks(metaFile, partFile, totalBytes, releaseKey);
        } catch (IOException ioe) {
            Log.e(TAG, "Failed to prepare .part file", ioe);
            listener.onError("E_STORAGE", 0L, totalBytes, false);
            return;
        }
        this.activeChunks = chunks;

        long alreadyDownloaded = sumDownloadedBytes();
        int initPct = totalBytes > 0 ? Math.min(99, (int) ((alreadyDownloaded * 100L) / totalBytes)) : 0;
        listener.onProgress("downloading", alreadyDownloaded, totalBytes, initPct, 0L, 0.0, 0, -1, mirrors.get(mirrorIdx));

        final AtomicInteger currentMirrorIndex = new AtomicInteger(mirrorIdx);
        final AtomicBoolean mirrorSwitchRequested = new AtomicBoolean(false);
        final AtomicBoolean fatalFailure = new AtomicBoolean(false);
        final AtomicInteger activeStreams = new AtomicInteger(0);

        while (!cancelled.get() && !fatalFailure.get()) {
            final int activeMirrorIdx = currentMirrorIndex.get();
            final String activeMirrorUrl = mirrors.get(activeMirrorIdx);
            mirrorSwitchRequested.set(false);

            ConcurrentLinkedQueue<ChunkState> pendingQueue = new ConcurrentLinkedQueue<>();
            for (ChunkState c : chunks) {
                if (!c.isComplete()) {
                    pendingQueue.add(c);
                }
            }

            if (pendingQueue.isEmpty()) {
                break;
            }

            int workerCount = Math.min(THREAD_COUNT, pendingQueue.size());
            ExecutorService pool = Executors.newFixedThreadPool(workerCount);
            List<Future<?>> futures = new ArrayList<>(workerCount);
            final AtomicBoolean poolRunning = new AtomicBoolean(true);

            // Start 250ms moving-average speed & mirror-health watchdog thread
            final long mirrorStartTime = System.currentTimeMillis();
            final long mirrorStartBytes = sumDownloadedBytes();
            Thread monitorThread = new Thread(() -> {
                Deque<long[]> samples = new ArrayDeque<>();
                long lastMetaFlush = System.currentTimeMillis();

                while (poolRunning.get() && !cancelled.get()) {
                    try {
                        Thread.sleep(PROGRESS_THROTTLE_MS);
                    } catch (InterruptedException ie) {
                        break;
                    }
                    if (!poolRunning.get() || cancelled.get()) break;

                    long now = System.currentTimeMillis();
                    long dl = sumDownloadedBytes();
                    samples.addLast(new long[]{now, dl});
                    while (samples.size() > 1 && now - samples.peekFirst()[0] > 3000L) {
                        samples.removeFirst();
                    }

                    long speedBps = 0L;
                    if (samples.size() >= 2) {
                        long[] oldest = samples.peekFirst();
                        long dt = now - oldest[0];
                        long db = dl - oldest[1];
                        if (dt > 0 && db >= 0) {
                            speedBps = (db * 1000L) / dt;
                        }
                    }
                    double speedMBps = (double) speedBps / (1024.0 * 1024.0);
                    int pct = totalBytes > 0 ? Math.min(99, (int) ((dl * 100L) / totalBytes)) : 0;
                    int eta = (speedBps > 0 && totalBytes > dl) ? (int) ((totalBytes - dl) / speedBps) : -1;

                    listener.onProgress(
                            "downloading",
                            dl,
                            totalBytes,
                            pct,
                            speedBps,
                            speedMBps,
                            activeStreams.get(),
                            eta,
                            activeMirrorUrl
                    );

                    if (now - lastMetaFlush >= 1500L) {
                        persistMetaSafe();
                        lastMetaFlush = now;
                    }

                    // Mirror failover if trailing 10s average drops below 120 KB/s and backup mirror exists
                    long mirrorElapsed = now - mirrorStartTime;
                    if (mirrorElapsed >= SLOW_MIRROR_WINDOW_MS && activeMirrorIdx + 1 < mirrors.size()) {
                        double mirrorAvgBps = ((double) (dl - mirrorStartBytes) * 1000.0) / (double) mirrorElapsed;
                        if (mirrorAvgBps < SLOW_MIRROR_BPS && !mirrorSwitchRequested.getAndSet(true)) {
                            Log.w(TAG, String.format(Locale.US, "Mirror %d too slow (%.1f KB/s), failing over to mirror %d",
                                    activeMirrorIdx, mirrorAvgBps / 1024.0, activeMirrorIdx + 1));
                            for (HttpURLConnection c : activeConnections) {
                                try {
                                    c.disconnect();
                                } catch (Throwable ignored) {
                                    // Abort slow sockets cleanly so workers jump to next mirror
                                }
                            }
                            break;
                        }
                    }
                }
            }, "siraj-ota-progress");
            monitorThread.start();

            try (RandomAccessFile raf = new RandomAccessFile(partFile, "rw");
                 FileChannel channel = raf.getChannel()) {

                for (int w = 0; w < workerCount; w++) {
                    futures.add(pool.submit(() -> {
                        byte[] buffer = new byte[32768];
                        ChunkState chunk;
                        while (!cancelled.get() && !mirrorSwitchRequested.get() && !fatalFailure.get()
                                && (chunk = pendingQueue.poll()) != null) {
                            activeStreams.incrementAndGet();
                            try {
                                boolean ok = downloadChunkWithRetries(
                                        activeMirrorUrl,
                                        chunk,
                                        channel,
                                        buffer,
                                        mirrorSwitchRequested
                                );
                                if (!ok && !cancelled.get() && !mirrorSwitchRequested.get()) {
                                    fatalFailure.set(true);
                                    break;
                                }
                            } finally {
                                activeStreams.decrementAndGet();
                            }
                        }
                    }));
                }

                for (Future<?> f : futures) {
                    try {
                        f.get();
                    } catch (Throwable t) {
                        Log.w(TAG, "Worker future exception", t);
                    }
                }
            } catch (IOException ioe) {
                Log.e(TAG, "Channel error during parallel write", ioe);
                fatalFailure.set(true);
            } finally {
                poolRunning.set(false);
                pool.shutdownNow();
                try {
                    monitorThread.join(400);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                persistMetaSafe();
            }

            if (cancelled.get()) {
                return;
            }

            if (mirrorSwitchRequested.get() && currentMirrorIndex.get() + 1 < mirrors.size()) {
                currentMirrorIndex.incrementAndGet();
                fatalFailure.set(false);
                continue;
            }

            if (fatalFailure.get() && currentMirrorIndex.get() + 1 < mirrors.size()) {
                Log.w(TAG, "Mirror " + activeMirrorIdx + " failed on chunks; switching to next mirror cleanly");
                currentMirrorIndex.incrementAndGet();
                fatalFailure.set(false);
                continue;
            }

            break;
        }

        if (cancelled.get()) {
            return;
        }

        long finalDl = sumDownloadedBytes();
        if (fatalFailure.get() || finalDl < totalBytes) {
            persistMetaSafe();
            int pct = totalBytes > 0 ? Math.min(99, (int) ((finalDl * 100L) / totalBytes)) : 0;
            listener.onError("E_CHUNK_INCOMPLETE", finalDl, totalBytes, false);
            return;
        }

        // Verify full file size and optional SHA-256 before atomic promotion
        listener.onProgress("verifying", totalBytes, totalBytes, 100, 0L, 0.0, 0, 0, mirrors.get(currentMirrorIndex.get()));
        if (!verifyFileIntegrity(partFile, totalBytes, expectedSha256)) {
            Log.e(TAG, "Integrity / SHA-256 verification failed on completed .part file");
            try { partFile.delete(); } catch (Throwable ignored) {}
            try { metaFile.delete(); } catch (Throwable ignored) {}
            listener.onError("E_INTEGRITY", 0L, totalBytes, false);
            return;
        }

        if (finalApk.exists()) {
            try { finalApk.delete(); } catch (Throwable ignored) {}
        }
        if (!partFile.renameTo(finalApk)) {
            Log.e(TAG, "Failed to promote .part file to final APK");
            listener.onError("E_RENAME", finalDl, totalBytes, false);
            return;
        }
        try {
            metaFile.delete();
        } catch (Throwable ignored) {
            // Best-effort cleanup of completed metadata
        }

        listener.onCompleted(finalApk, finalApk.length());
    }

    private boolean downloadChunkWithRetries(
            String mirrorUrl,
            ChunkState chunk,
            FileChannel channel,
            byte[] buffer,
            AtomicBoolean mirrorSwitchRequested
    ) {
        for (int attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
            if (cancelled.get() || mirrorSwitchRequested.get()) {
                return false;
            }
            if (chunk.isComplete()) {
                return true;
            }

            long rangeStart = chunk.start + chunk.downloaded.get();
            long rangeEnd = chunk.end;
            if (rangeStart > rangeEnd) {
                return true;
            }

            HttpURLConnection conn = null;
            InputStream in = null;
            try {
                conn = openUrlWithRedirects(mirrorUrl, "GET", "bytes=" + rangeStart + "-" + rangeEnd);
                if (conn == null) {
                    throw new IOException("Redirect resolution returned null");
                }
                activeConnections.add(conn);

                int code = conn.getResponseCode();
                if (code != 206 && !(code == 200 && rangeStart == 0L)) {
                    throw new IOException("Unexpected HTTP status " + code + " for chunk " + chunk.index);
                }

                in = new BufferedInputStream(conn.getInputStream(), 32768);
                long writePos = rangeStart;
                long remaining = (rangeEnd - rangeStart) + 1L;
                int read;
                while (remaining > 0 && !cancelled.get() && !mirrorSwitchRequested.get()
                        && (read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining))) != -1) {
                    ByteBuffer bb = ByteBuffer.wrap(buffer, 0, read);
                    while (bb.hasRemaining()) {
                        writePos += channel.write(bb, writePos);
                    }
                    chunk.downloaded.addAndGet(read);
                    remaining -= read;
                }

                if (chunk.isComplete()) {
                    return true;
                }
                if (cancelled.get() || mirrorSwitchRequested.get()) {
                    return false;
                }
                // Partial read ended early — retry remaining bytes
                throw new IOException("Chunk " + chunk.index + " ended early, remaining=" + remaining);
            } catch (Throwable t) {
                if (cancelled.get() || mirrorSwitchRequested.get()) {
                    return false;
                }
                Log.w(TAG, "Chunk " + chunk.index + " attempt " + attempt + " failed: " + t.getMessage());
                if (attempt >= MAX_CHUNK_RETRIES) {
                    return false;
                }
                long backoffMs = Math.min(8000L, 500L * (1L << attempt));
                try {
                    Thread.sleep(backoffMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            } finally {
                if (in != null) {
                    try { in.close(); } catch (Throwable ignored) {}
                }
                if (conn != null) {
                    activeConnections.remove(conn);
                    try { conn.disconnect(); } catch (Throwable ignored) {}
                }
            }
        }
        return chunk.isComplete();
    }

    private ProbeResult probeMirror(String urlStr) {
        // First try Range GET 0-0 directly: confirms BOTH redirect URL, exact totalBytes via Content-Range, AND Range support in 1 round-trip
        HttpURLConnection conn = null;
        try {
            conn = openUrlWithRedirects(urlStr, "GET", "bytes=0-0");
            if (conn != null) {
                activeConnections.add(conn);
                int code = conn.getResponseCode();
                String finalUrl = conn.getURL().toString();
                if (code == 206) {
                    String contentRange = conn.getHeaderField("Content-Range");
                    long parsedTotal = parseTotalFromContentRange(contentRange);
                    if (parsedTotal > 0) {
                        return new ProbeResult(finalUrl, parsedTotal, true);
                    }
                } else if (code >= 200 && code < 300) {
                    long cl = getCompatContentLength(conn);
                    boolean rangesOk = "bytes".equalsIgnoreCase(conn.getHeaderField("Accept-Ranges"));
                    return new ProbeResult(finalUrl, cl, rangesOk);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "Range probe failed for " + urlStr + ": " + t.getMessage());
        } finally {
            if (conn != null) {
                activeConnections.remove(conn);
                try { conn.disconnect(); } catch (Throwable ignored) {}
            }
        }

        // Fallback HEAD probe
        HttpURLConnection headConn = null;
        try {
            headConn = openUrlWithRedirects(urlStr, "HEAD", null);
            if (headConn != null) {
                activeConnections.add(headConn);
                int code = headConn.getResponseCode();
                if (code >= 200 && code < 300) {
                    long cl = getCompatContentLength(headConn);
                    boolean rangesOk = "bytes".equalsIgnoreCase(headConn.getHeaderField("Accept-Ranges"));
                    return new ProbeResult(headConn.getURL().toString(), cl, rangesOk);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "HEAD probe failed for " + urlStr + ": " + t.getMessage());
        } finally {
            if (headConn != null) {
                activeConnections.remove(headConn);
                try { headConn.disconnect(); } catch (Throwable ignored) {}
            }
        }

        return null;
    }

    private HttpURLConnection openUrlWithRedirects(String initialUrl, String method, String rangeHeader) throws IOException {
        String currentUrl = initialUrl;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            if (cancelled.get()) return null;
            URL u = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod(method);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestProperty("User-Agent", USER_AGENT);
            conn.setRequestProperty("Accept", "*/*");
            conn.setRequestProperty("Accept-Encoding", "identity");
            if (rangeHeader != null) {
                conn.setRequestProperty("Range", rangeHeader);
            }
            int code = conn.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IOException("Redirect without Location header from " + currentUrl);
                }
                currentUrl = new URL(u, location).toString();
                continue;
            }
            return conn;
        }
        throw new IOException("Too many HTTP redirects for " + initialUrl);
    }

    private void runSingleStreamFallback(String urlStr, File partFile, File finalApk, long totalBytes) {
        HttpURLConnection conn = null;
        InputStream in = null;
        FileOutputStream out = null;
        try {
            long resumeFrom = partFile.exists() ? partFile.length() : 0L;
            String rangeHdr = (resumeFrom > 0 && (totalBytes <= 0 || resumeFrom < totalBytes))
                    ? "bytes=" + resumeFrom + "-"
                    : null;
            conn = openUrlWithRedirects(urlStr, "GET", rangeHdr);
            if (conn == null) throw new IOException("Connection null");
            activeConnections.add(conn);

            int code = conn.getResponseCode();
            boolean appending = (code == 206 && resumeFrom > 0);
            if (!appending) {
                resumeFrom = 0L;
            }
            if (code >= 400) {
                throw new IOException("HTTP " + code);
            }

            long cl = getCompatContentLength(conn);
            long resolvedTotal = totalBytes > 0 ? totalBytes : (appending && cl > 0 ? resumeFrom + cl : cl);
            this.activeTotalBytes = resolvedTotal;

            in = new BufferedInputStream(conn.getInputStream(), 65536);
            out = new FileOutputStream(partFile, appending);
            byte[] buf = new byte[65536];
            long downloaded = resumeFrom;
            long lastEmit = System.currentTimeMillis();
            long lastBytes = downloaded;
            int read;

            while (!cancelled.get() && (read = in.read(buf)) != -1) {
                out.write(buf, 0, read);
                downloaded += read;
                long now = System.currentTimeMillis();
                if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
                    long dt = now - lastEmit;
                    long db = downloaded - lastBytes;
                    long speedBps = dt > 0 ? (db * 1000L) / dt : 0L;
                    double speedMBps = (double) speedBps / (1024.0 * 1024.0);
                    int pct = resolvedTotal > 0 ? Math.min(99, (int) ((downloaded * 100L) / resolvedTotal)) : 0;
                    int eta = (speedBps > 0 && resolvedTotal > downloaded) ? (int) ((resolvedTotal - downloaded) / speedBps) : -1;
                    listener.onProgress("downloading", downloaded, resolvedTotal, pct, speedBps, speedMBps, 1, eta, urlStr);
                    lastEmit = now;
                    lastBytes = downloaded;
                }
            }
            out.flush();

            if (cancelled.get()) {
                int pct = resolvedTotal > 0 ? Math.min(99, (int) ((downloaded * 100L) / resolvedTotal)) : 0;
                listener.onPaused(downloaded, resolvedTotal, pct);
                return;
            }

            if (verifyFileIntegrity(partFile, resolvedTotal, expectedSha256)) {
                if (finalApk.exists()) finalApk.delete();
                if (partFile.renameTo(finalApk)) {
                    listener.onCompleted(finalApk, finalApk.length());
                    return;
                }
            }
            listener.onError("E_INTEGRITY", downloaded, resolvedTotal, true);
        } catch (Throwable t) {
            if (!cancelled.get()) {
                long dl = partFile.exists() ? partFile.length() : 0L;
                listener.onError("E_STREAM_" + t.getClass().getSimpleName(), dl, totalBytes, true);
            }
        } finally {
            if (out != null) try { out.close(); } catch (Throwable ignored) {}
            if (in != null) try { in.close(); } catch (Throwable ignored) {}
            if (conn != null) {
                activeConnections.remove(conn);
                try { conn.disconnect(); } catch (Throwable ignored) {}
            }
        }
    }

    private List<ChunkState> loadOrInitChunks(File metaFile, File partFile, long totalBytes, String shaKey) throws IOException {
        if (metaFile.exists() && partFile.exists() && partFile.length() == totalBytes) {
            try {
                String raw = readFileString(metaFile);
                JSONObject json = new JSONObject(raw);
                String savedSha = json.optString("sha", "");
                long savedTotal = json.optLong("totalBytes", -1L);
                JSONArray arr = json.optJSONArray("chunks");
                if (shaKey.equals(savedSha) && savedTotal == totalBytes && arr != null && arr.length() > 0) {
                    List<ChunkState> restored = new ArrayList<>(arr.length());
                    long sumSpan = 0L;
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject c = arr.getJSONObject(i);
                        long s = c.getLong("start");
                        long e = c.getLong("end");
                        long d = c.optLong("downloaded", 0L);
                        ChunkState cs = new ChunkState(i, s, e, d);
                        restored.add(cs);
                        sumSpan += cs.length();
                    }
                    if (sumSpan == totalBytes) {
                        Log.i(TAG, "Resuming cached .part download for sha=" + shaKey);
                        return restored;
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "Stale or corrupt .meta.json, re-initializing chunks", t);
            }
        }

        List<ChunkState> fresh = splitIntoChunks(totalBytes, BLOCK_SIZE_BYTES);
        try (RandomAccessFile raf = new RandomAccessFile(partFile, "rw")) {
            raf.setLength(totalBytes);
        }
        this.activeChunks = fresh;
        persistMetaSafe();
        return fresh;
    }

    public static List<ChunkState> splitIntoChunks(long totalBytes, long blockSize) {
        List<ChunkState> list = new ArrayList<>();
        if (totalBytes <= 0 || blockSize <= 0) return list;
        long cursor = 0L;
        int idx = 0;
        while (cursor < totalBytes) {
            long end = Math.min(totalBytes - 1L, cursor + blockSize - 1L);
            list.add(new ChunkState(idx++, cursor, end, 0L));
            cursor = end + 1L;
        }
        return list;
    }

    private void persistMetaSafe() {
        File metaFile = activeMetaFile;
        List<ChunkState> chunks = activeChunks;
        long totalBytes = activeTotalBytes;
        if (metaFile == null || chunks == null || chunks.isEmpty() || totalBytes <= 0) return;

        synchronized (metaWriteLock) {
            try {
                JSONObject root = new JSONObject();
                root.put("sha", releaseKey);
                root.put("totalBytes", totalBytes);
                root.put("url", mirrors.isEmpty() ? "" : mirrors.get(0));
                JSONArray arr = new JSONArray();
                for (ChunkState c : chunks) {
                    JSONObject item = new JSONObject();
                    item.put("start", c.start);
                    item.put("end", c.end);
                    item.put("downloaded", c.downloaded.get());
                    arr.put(item);
                }
                root.put("chunks", arr);
                File tmp = new File(metaFile.getParentFile(), metaFile.getName() + ".tmp");
                try (FileOutputStream fos = new FileOutputStream(tmp, false)) {
                    fos.write(root.toString().getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                if (metaFile.exists()) metaFile.delete();
                tmp.renameTo(metaFile);
            } catch (Throwable t) {
                Log.w(TAG, "Failed to persist .meta.json", t);
            }
        }
    }

    private long sumDownloadedBytes() {
        long sum = 0L;
        for (ChunkState c : activeChunks) {
            sum += c.downloaded.get();
        }
        return sum;
    }

    private static void cleanupOtherReleaseArtifacts(File dir, String activeBaseName) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            String name = f.getName();
            if (name.startsWith("siraj-update") && !name.startsWith(activeBaseName)) {
                try {
                    f.delete();
                } catch (Throwable ignored) {
                    // Stale release file cleanup guard
                }
            }
        }
    }

    private static boolean verifyFileIntegrity(File file, long expectedTotalBytes, String expectedSha256) {
        if (file == null || !file.exists() || file.length() <= 15_000_000L) {
            return false;
        }
        if (expectedTotalBytes > 15_000_000L && Math.abs(file.length() - expectedTotalBytes) > 1024L) {
            return false;
        }
        if (expectedSha256 != null && expectedSha256.length() == 64) {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] buf = new byte[65536];
                try (InputStream is = new FileInputStream(file)) {
                    int n;
                    while ((n = is.read(buf)) != -1) {
                        md.update(buf, 0, n);
                    }
                }
                byte[] digest = md.digest();
                StringBuilder hex = new StringBuilder(64);
                for (byte b : digest) {
                    hex.append(String.format(Locale.US, "%02x", b));
                }
                if (!expectedSha256.equalsIgnoreCase(hex.toString())) {
                    Log.e(TAG, "SHA-256 mismatch! expected=" + expectedSha256 + " actual=" + hex);
                    return false;
                }
            } catch (Throwable t) {
                Log.e(TAG, "Failed to verify SHA-256", t);
                return false;
            }
        }
        return true;
    }

    private static long parseTotalFromContentRange(String header) {
        if (header == null) return -1L;
        int slash = header.lastIndexOf('/');
        if (slash < 0 || slash >= header.length() - 1) return -1L;
        String tail = header.substring(slash + 1).trim();
        if ("*".equals(tail)) return -1L;
        try {
            return Long.parseLong(tail);
        } catch (NumberFormatException ignored) {
            return -1L;
        }
    }

    private static long getCompatContentLength(HttpURLConnection conn) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return conn.getContentLengthLong();
        }
        return conn.getContentLength();
    }

    private static String readFileString(File f) throws IOException {
        try (FileInputStream fis = new FileInputStream(f)) {
            byte[] data = new byte[(int) f.length()];
            int off = 0;
            while (off < data.length) {
                int r = fis.read(data, off, data.length - off);
                if (r < 0) break;
                off += r;
            }
            return new String(data, 0, off, StandardCharsets.UTF_8);
        }
    }
}
