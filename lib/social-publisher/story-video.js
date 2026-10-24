import jpeg from "jpeg-js";
import { STORY_FONT } from "./story-font-data.js";

export const STORY_VIDEO_WIDTH = 540;
export const STORY_VIDEO_HEIGHT = 960;
export const STORY_VIDEO_FPS = 24;
export const STORY_DEFAULT_DURATION_SEC = 15;
export const STORY_MIN_DURATION_SEC = 8;
export const STORY_MAX_DURATION_STORY_SEC = 25;
export const STORY_MAX_DURATION_FEED_REELS_SEC = 60;

export function maxQuoteVideoDurationForTarget(target = "feed") {
    const clean = String(target || "").trim().toLowerCase();
    if (clean === "story") {
        return STORY_MAX_DURATION_STORY_SEC;
    }
    return STORY_MAX_DURATION_FEED_REELS_SEC;
}

export function formatQuoteAuthorSignature(authorName = "") {
    const clean = String(authorName || "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^quote\s*by\s*:\s*/i, "")
        .trim();
    if (!clean) return "";
    return `quote by: ${clean}`;
}

// ============================================================================
// 1. CRC32 & Pure-JS PNG Decoder / Encoder (Web Streams deflate/zlib)
// ============================================================================
const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function zlibCompress(rawBytes) {
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    const chunks = [];
    const reader = cs.readable.getReader();
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
    }
    return out;
}

async function zlibDecompress(compressedBytes) {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
    }
    return out;
}

function pngChunk(type, data) {
    const out = new Uint8Array(12 + data.byteLength);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.byteLength, false);
    for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    const crc = crc32(out.subarray(4, 8 + data.byteLength));
    view.setUint32(8 + data.byteLength, crc, false);
    return out;
}

export async function encodeRgbaToPng(rgba, width, height) {
    const rowStride = width * 4 + 1;
    const raw = new Uint8Array(rowStride * height);
    for (let y = 0; y < height; y += 1) {
        const dstRow = y * rowStride;
        const srcRow = y * width * 4;
        // Filter type 1 (Sub) compresses gradients & photos tightly and fast
        raw[dstRow] = 1;
        for (let i = 0; i < width * 4; i += 1) {
            const left = i >= 4 ? rgba[srcRow + i - 4] : 0;
            raw[dstRow + 1 + i] = (rgba[srcRow + i] - left) & 0xFF;
        }
    }
    const compressed = await zlibCompress(raw);
    const ihdr = new Uint8Array(13);
    const iv = new DataView(ihdr.buffer);
    iv.setUint32(0, width, false);
    iv.setUint32(4, height, false);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const cIhdr = pngChunk("IHDR", ihdr);
    const cIdat = pngChunk("IDAT", compressed);
    const cIend = pngChunk("IEND", new Uint8Array(0));

    const out = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
    let pos = 0;
    for (const part of [sig, cIhdr, cIdat, cIend]) {
        out.set(part, pos);
        pos += part.length;
    }
    return out;
}

function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

async function decodePngToRgba(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 6;
    let interlace = 0;
    let palette = null;
    let trns = null;
    const idatParts = [];
    let idatTotal = 0;

    while (offset + 8 <= bytes.byteLength) {
        const len = view.getUint32(offset, false);
        const type = String.fromCharCode(
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7]
        );
        const dataStart = offset + 8;
        if (dataStart + len > bytes.byteLength) break;
        const chunkData = bytes.subarray(dataStart, dataStart + len);

        if (type === "IHDR") {
            width = view.getUint32(dataStart, false);
            height = view.getUint32(dataStart + 4, false);
            bitDepth = chunkData[8];
            colorType = chunkData[9];
            interlace = chunkData[12];
        } else if (type === "PLTE") {
            palette = chunkData;
        } else if (type === "tRNS") {
            trns = chunkData;
        } else if (type === "IDAT") {
            idatParts.push(chunkData);
            idatTotal += chunkData.byteLength;
        } else if (type === "IEND") {
            break;
        }
        offset = dataStart + len + 4;
    }

    if (!width || !height || interlace !== 0 || bitDepth !== 8 || !idatTotal) {
        throw new Error("Unsupported PNG structure for Story compositor");
    }

    const idat = new Uint8Array(idatTotal);
    let pos = 0;
    for (const part of idatParts) {
        idat.set(part, pos);
        pos += part.byteLength;
    }

    const raw = await zlibDecompress(idat);
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
    const bpp = channels;
    const stride = width * bpp;
    const recon = new Uint8Array(height * stride);

    for (let y = 0; y < height; y += 1) {
        const srcRow = y * (stride + 1);
        const filter = raw[srcRow];
        const dstRow = y * stride;
        const prevRow = (y - 1) * stride;
        for (let i = 0; i < stride; i += 1) {
            const x = raw[srcRow + 1 + i];
            const a = i >= bpp ? recon[dstRow + i - bpp] : 0;
            const b = y > 0 ? recon[prevRow + i] : 0;
            const c = (y > 0 && i >= bpp) ? recon[prevRow + i - bpp] : 0;
            let val = x;
            if (filter === 1) val = (x + a) & 0xFF;
            else if (filter === 2) val = (x + b) & 0xFF;
            else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xFF;
            else if (filter === 4) val = (x + paethPredictor(a, b, c)) & 0xFF;
            recon[dstRow + i] = val;
        }
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let p = 0; p < width * height; p += 1) {
        const di = p * 4;
        if (colorType === 6) {
            const si = p * 4;
            rgba[di] = recon[si];
            rgba[di + 1] = recon[si + 1];
            rgba[di + 2] = recon[si + 2];
            rgba[di + 3] = recon[si + 3];
        } else if (colorType === 2) {
            const si = p * 3;
            rgba[di] = recon[si];
            rgba[di + 1] = recon[si + 1];
            rgba[di + 2] = recon[si + 2];
            rgba[di + 3] = 255;
        } else if (colorType === 4) {
            const si = p * 2;
            rgba[di] = recon[si];
            rgba[di + 1] = recon[si];
            rgba[di + 2] = recon[si];
            rgba[di + 3] = recon[si + 1];
        } else if (colorType === 3 && palette) {
            const idx = recon[p];
            rgba[di] = palette[idx * 3] || 0;
            rgba[di + 1] = palette[idx * 3 + 1] || 0;
            rgba[di + 2] = palette[idx * 3 + 2] || 0;
            rgba[di + 3] = trns && idx < trns.length ? trns[idx] : 255;
        } else {
            const g = recon[p];
            rgba[di] = g;
            rgba[di + 1] = g;
            rgba[di + 2] = g;
            rgba[di + 3] = 255;
        }
    }
    return { width, height, rgba };
}

export async function decodeImageToRgba(bytes) {
    if (!bytes || bytes.byteLength < 12) return null;
    try {
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            return await decodePngToRgba(bytes);
        }
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
            const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
            return {
                width: decoded.width,
                height: decoded.height,
                rgba: decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data)
            };
        }
    } catch {
        return null;
    }
    return null;
}

// ============================================================================
// 2. Story Background Crop/Vignette + 4x4 Anti-Aliased Vector Typography
// ============================================================================
function renderFallbackSunsetRgba(width, height, seed = 0) {
    const palettes = [
        [[20, 28, 58], [94, 52, 92], [218, 114, 74]],
        [[14, 34, 48], [34, 78, 96], [186, 134, 92]],
        [[24, 22, 42], [68, 56, 98], [164, 108, 118]],
        [[18, 32, 28], [44, 78, 66], [176, 146, 96]]
    ];
    const [top, mid, bot] = palettes[Math.abs(seed) % palettes.length];
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        const ty = y / (height - 1);
        const [c1, c2, u] = ty < 0.55
            ? [top, mid, ty / 0.55]
            : [mid, bot, (ty - 0.55) / 0.45];
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * u);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * u);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * u);
        for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            rgba[idx] = r;
            rgba[idx + 1] = g;
            rgba[idx + 2] = b;
            rgba[idx + 3] = 255;
        }
    }
    return rgba;
}

function resizeCoverRgba(src, dstWidth, dstHeight) {
    const { width: sw, height: sh, rgba: sdata } = src;
    const scale = Math.max(dstWidth / sw, dstHeight / sh);
    const cropW = dstWidth / scale;
    const cropH = dstHeight / scale;
    const startX = (sw - cropW) * 0.5;
    const startY = (sh - cropH) * 0.5;

    const out = new Uint8Array(dstWidth * dstHeight * 4);
    for (let dy = 0; dy < dstHeight; dy += 1) {
        const sy = Math.min(sh - 1.001, Math.max(0, startY + (dy + 0.5) / scale - 0.5));
        const y0 = Math.floor(sy);
        const y1 = Math.min(sh - 1, y0 + 1);
        const fy = sy - y0;
        for (let dx = 0; dx < dstWidth; dx += 1) {
            const sx = Math.min(sw - 1.001, Math.max(0, startX + (dx + 0.5) / scale - 0.5));
            const x0 = Math.floor(sx);
            const x1 = Math.min(sw - 1, x0 + 1);
            const fx = sx - x0;

            const i00 = (y0 * sw + x0) * 4;
            const i10 = (y0 * sw + x1) * 4;
            const i01 = (y1 * sw + x0) * 4;
            const i11 = (y1 * sw + x1) * 4;
            const di = (dy * dstWidth + dx) * 4;

            for (let c = 0; c < 3; c += 1) {
                const top = sdata[i00 + c] * (1 - fx) + sdata[i10 + c] * fx;
                const bot = sdata[i01 + c] * (1 - fx) + sdata[i11 + c] * fx;
                out[di + c] = Math.round(top * (1 - fy) + bot * fy);
            }
            out[di + 3] = 255;
        }
    }
    return out;
}

function applyStoryScrim(rgba, width, height) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    for (let y = 0; y < height; y += 1) {
        const ny = (y - cy) / (height * 0.5);
        const bottomScrim = ny > 0.55 ? Math.pow((ny - 0.55) / 0.45, 1.35) * 0.24 : 0;
        for (let x = 0; x < width; x += 1) {
            const nx = (x - cx) / (width * 0.5);
            const distSq = nx * nx * 0.55 + ny * ny * 0.85;
            // Warm dark scrim strongest across the center reading band (0.48) + gentle outer/bottom vignette
            const centerFocus = Math.exp(-ny * ny * 2.2) * 0.34;
            const edgeVignette = Math.min(0.32, distSq * 0.22);
            const alpha = Math.min(0.66, 0.16 + centerFocus + edgeVignette + bottomScrim);
            const keep = 1 - alpha;
            const idx = (y * width + x) * 4;
            rgba[idx] = Math.round(rgba[idx] * keep + 10 * alpha);
            rgba[idx + 1] = Math.round(rgba[idx + 1] * keep + 13 * alpha);
            rgba[idx + 2] = Math.round(rgba[idx + 2] * keep + 20 * alpha);
        }
    }
}

function getGlyph(ch) {
    return STORY_FONT.glyphs[ch]
        || STORY_FONT.glyphs[ch.normalize("NFKD")[0]]
        || STORY_FONT.glyphs[" "]
        || { w: 600, p: [] };
}

function measureTextUnits(text) {
    let total = 0;
    for (const ch of text) {
        total += getGlyph(ch).w;
    }
    return total;
}

function wrapQuoteLines(text, fontSizePx, maxWidthPx) {
    const scale = fontSizePx / STORY_FONT.unitsPerEm;
    const paragraphs = String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
    const lines = [];
    for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        let current = "";
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (measureTextUnits(candidate) * scale <= maxWidthPx || !current) {
                current = candidate;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current) lines.push(current);
    }
    return lines;
}

function buildTextEdges(lines, fontSizePx, anchorX, startBaselineY, lineHeightPx, align = "center") {
    const scale = fontSizePx / STORY_FONT.unitsPerEm;
    const edges = [];

    for (let li = 0; li < lines.length; li += 1) {
        const line = lines[li];
        const lineWidthPx = measureTextUnits(line) * scale;
        let cursorX = anchorX - lineWidthPx * 0.5;
        if (align === "right") {
            cursorX = anchorX - lineWidthPx;
        } else if (align === "left") {
            cursorX = anchorX;
        }
        const baselineY = startBaselineY + li * lineHeightPx;

        for (const ch of line) {
            const glyph = getGlyph(ch);
            let startX = 0;
            let startY = 0;
            let curX = 0;
            let curY = 0;

            for (const cmd of glyph.p) {
                const op = cmd[0];
                if (op === "M") {
                    curX = cursorX + cmd[1] * scale;
                    curY = baselineY - cmd[2] * scale;
                    startX = curX;
                    startY = curY;
                } else if (op === "L") {
                    const nx = cursorX + cmd[1] * scale;
                    const ny = baselineY - cmd[2] * scale;
                    if (curY !== ny) edges.push([curX, curY, nx, ny]);
                    curX = nx;
                    curY = ny;
                } else if (op === "Q") {
                    const cx = cursorX + cmd[1] * scale;
                    const cy = baselineY - cmd[2] * scale;
                    const nx = cursorX + cmd[3] * scale;
                    const ny = baselineY - cmd[4] * scale;
                    const steps = 6;
                    let px = curX;
                    let py = curY;
                    for (let s = 1; s <= steps; s += 1) {
                        const t = s / steps;
                        const mt = 1 - t;
                        const qx = mt * mt * curX + 2 * mt * t * cx + t * t * nx;
                        const qy = mt * mt * curY + 2 * mt * t * cy + t * t * ny;
                        if (py !== qy) edges.push([px, py, qx, qy]);
                        px = qx;
                        py = qy;
                    }
                    curX = nx;
                    curY = ny;
                } else if (op === "Z") {
                    if (curY !== startY) edges.push([curX, curY, startX, startY]);
                    curX = startX;
                    curY = startY;
                }
            }
            cursorX += glyph.w * scale;
        }
    }
    return edges;
}

function rasterizeEdgesMask(edges, width, height, offsetX = 0, offsetY = 0) {
    const mask = new Uint8Array(width * height);
    if (!edges.length) return mask;

    // Group active edges per pixel row for fast O(active) scanline rendering
    const subSamplesY = [0.125, 0.375, 0.625, 0.875];
    let minY = height;
    let maxY = 0;
    const prepared = [];
    for (const [x0, y0, x1, y1] of edges) {
        const ax0 = x0 + offsetX;
        const ay0 = y0 + offsetY;
        const ax1 = x1 + offsetX;
        const ay1 = y1 + offsetY;
        const top = Math.min(ay0, ay1);
        const bot = Math.max(ay0, ay1);
        if (bot < 0 || top >= height) continue;
        const dir = ay0 < ay1 ? 1 : -1;
        prepared.push({ ax0, ay0, slope: (ax1 - ax0) / (ay1 - ay0), top, bot, dir });
        if (top < minY) minY = top;
        if (bot > maxY) maxY = bot;
    }

    const rowStart = Math.max(0, Math.floor(minY));
    const rowEnd = Math.min(height - 1, Math.ceil(maxY));
    const rowBuckets = Array.from({ length: rowEnd - rowStart + 1 }, () => []);
    for (const edge of prepared) {
        const r0 = Math.max(rowStart, Math.floor(edge.top));
        const r1 = Math.min(rowEnd, Math.floor(edge.bot));
        for (let r = r0; r <= r1; r += 1) {
            rowBuckets[r - rowStart].push(edge);
        }
    }

    const xs = [];
    const dirs = [];
    for (let y = rowStart; y <= rowEnd; y += 1) {
        const bucket = rowBuckets[y - rowStart];
        if (!bucket.length) continue;
        const rowOffset = y * width;

        for (let syIdx = 0; syIdx < 4; syIdx += 1) {
            const sy = y + subSamplesY[syIdx];
            xs.length = 0;
            dirs.length = 0;
            for (let i = 0; i < bucket.length; i += 1) {
                const e = bucket[i];
                if (sy >= e.top && sy < e.bot) {
                    const ix = e.ax0 + (sy - e.ay0) * e.slope;
                    // Insertion sort keeps xs sorted with zero allocations
                    let pos = xs.length;
                    while (pos > 0 && xs[pos - 1] > ix) pos -= 1;
                    xs.splice(pos, 0, ix);
                    dirs.splice(pos, 0, e.dir);
                }
            }
            let winding = 0;
            let spanStart = 0;
            for (let i = 0; i < xs.length; i += 1) {
                if (winding === 0) spanStart = xs[i];
                winding += dirs[i];
                if (winding === 0) {
                    const spanEnd = xs[i];
                    const x0 = Math.max(0, Math.floor(spanStart));
                    const x1 = Math.min(width - 1, Math.floor(spanEnd));
                    for (let x = x0; x <= x1; x += 1) {
                        const left = Math.max(x, spanStart);
                        const right = Math.min(x + 1, spanEnd);
                        const cov = right - left;
                        if (cov > 0) {
                            mask[rowOffset + x] = Math.min(255, mask[rowOffset + x] + Math.round(cov * 63.75));
                        }
                    }
                }
            }
        }
    }
    return mask;
}

function blendMaskRgba(rgba, mask, r, g, b, opacity = 1.0) {
    for (let i = 0; i < mask.length; i += 1) {
        const m = mask[i];
        if (!m) continue;
        const a = (m / 255) * opacity;
        const inv = 1 - a;
        const idx = i * 4;
        rgba[idx] = Math.round(rgba[idx] * inv + r * a);
        rgba[idx + 1] = Math.round(rgba[idx + 1] * inv + g * a);
        rgba[idx + 2] = Math.round(rgba[idx + 2] * inv + b * a);
    }
}

function drawHorizontalSegmentRule(rgba, width, height, xStart, xEnd, centerY, thickness, r, g, b, opacity) {
    const x0 = Math.max(0, Math.round(Math.min(xStart, xEnd)));
    const x1 = Math.min(width - 1, Math.round(Math.max(xStart, xEnd)));
    const y0 = Math.max(0, Math.round(centerY - thickness * 0.5));
    const y1 = Math.min(height - 1, Math.round(centerY + thickness * 0.5));
    const inv = 1 - opacity;
    for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
            const idx = (y * width + x) * 4;
            rgba[idx] = Math.round(rgba[idx] * inv + r * opacity);
            rgba[idx + 1] = Math.round(rgba[idx + 1] * inv + g * opacity);
            rgba[idx + 2] = Math.round(rgba[idx + 2] * inv + b * opacity);
        }
    }
}

function drawRoundedHorizontalRule(rgba, width, height, centerY, ruleWidth, thickness, r, g, b, opacity) {
    drawHorizontalSegmentRule(
        rgba,
        width,
        height,
        (width - ruleWidth) * 0.5,
        (width + ruleWidth) * 0.5,
        centerY,
        thickness,
        r,
        g,
        b,
        opacity
    );
}

function renderSolidBlackRgba(width, height) {
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 3; i < rgba.length; i += 4) {
        rgba[i] = 255;
    }
    return rgba;
}

export async function renderQuoteStoryCard({
    backgroundBytes = null,
    solidBlack = false,
    quoteText = "",
    authorName = "",
    width = STORY_VIDEO_WIDTH,
    height = STORY_VIDEO_HEIGHT,
    seed = 0
} = {}) {
    let rgba;
    if (solidBlack || !backgroundBytes || !backgroundBytes.byteLength) {
        rgba = renderSolidBlackRgba(width, height);
    } else {
        const decoded = await decodeImageToRgba(backgroundBytes);
        if (decoded) {
            rgba = resizeCoverRgba(decoded, width, height);
            applyStoryScrim(rgba, width, height);
        } else {
            rgba = renderFallbackSunsetRgba(width, height, seed);
            applyStoryScrim(rgba, width, height);
        }
    }

    const signatureText = formatQuoteAuthorSignature(authorName);
    const cleanQuote = String(quoteText || "").trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
    const displayQuote = `“${cleanQuote}”`;

    const maxTextWidth = Math.round(width * 0.78);
    const charLen = displayQuote.length;
    const scaleRatio = width / STORY_VIDEO_WIDTH;
    const baseQuoteSize = charLen <= 75 ? 34 : charLen <= 125 ? 30 : charLen <= 175 ? 26 : 23;
    let fontSize = Math.max(12, Math.round(baseQuoteSize * scaleRatio));
    const minQuoteSize = Math.max(10, Math.round(19 * scaleRatio));
    let lines = wrapQuoteLines(displayQuote, fontSize, maxTextWidth);
    while (lines.length > 10 && fontSize > minQuoteSize) {
        fontSize -= Math.max(1, Math.round(2 * scaleRatio));
        lines = wrapQuoteLines(displayQuote, fontSize, maxTextWidth);
    }

    const lineHeight = Math.round(fontSize * 1.44);
    const totalBlockHeight = lines.length * lineHeight;
    const ascenderPx = Math.round((STORY_FONT.ascender / STORY_FONT.unitsPerEm) * fontSize);
    const centerShiftY = signatureText ? Math.round(-14 * (height / STORY_VIDEO_HEIGHT)) : 0;
    const startBaselineY = Math.round((height - totalBlockHeight) * 0.5 + ascenderPx + centerShiftY);

    // Subtle top & bottom warm gold/ivory editorial accent rules
    const topRuleY = startBaselineY - ascenderPx - Math.round(28 * scaleRatio);
    const botRuleY = startBaselineY - ascenderPx + totalBlockHeight + Math.round(24 * scaleRatio);
    const ruleWidth = Math.max(18, Math.round(54 * scaleRatio));
    drawRoundedHorizontalRule(rgba, width, height, topRuleY, ruleWidth, Math.max(1, Math.round(2 * scaleRatio)), 255, 236, 200, 0.65);
    drawRoundedHorizontalRule(rgba, width, height, botRuleY, ruleWidth, Math.max(1, Math.round(2 * scaleRatio)), 255, 236, 200, 0.65);

    const edges = buildTextEdges(lines, fontSize, width * 0.5, startBaselineY, lineHeight, "center");
    // Soft dark drop shadow for effortless legibility on bright clouds/sunsets
    const shadowOffset = Math.max(1, Math.round(3 * scaleRatio));
    const shadowMask = rasterizeEdgesMask(edges, width, height, 0, shadowOffset);
    blendMaskRgba(rgba, shadowMask, 8, 10, 16, 0.68);
    // Crisp warm ivory typography
    const textMask = rasterizeEdgesMask(edges, width, height, 0, 0);
    blendMaskRgba(rgba, textMask, 255, 253, 249, 0.98);

    // Bottom-right signature ("quote by: <FB Page/Account Name>")
    if (signatureText) {
        const rightMargin = Math.max(10, Math.round(width * 0.063));
        const bottomMargin = Math.max(14, Math.round(height * 0.07));
        const rightX = width - rightMargin;
        const bottomBaselineY = height - bottomMargin;
        const maxSigWidth = Math.max(80, Math.round(width * 0.84));
        const minSigSize = Math.max(9, Math.round(12 * scaleRatio));
        let sigFontSize = Math.max(minSigSize, Math.round(16 * scaleRatio));
        let sigLines = wrapQuoteLines(signatureText, sigFontSize, maxSigWidth);
        while (sigLines.length > 1 && sigFontSize > minSigSize) {
            sigFontSize -= 1;
            sigLines = wrapQuoteLines(signatureText, sigFontSize, maxSigWidth);
        }
        sigLines = sigLines.slice(0, 2);

        const sigLineHeight = Math.max(11, Math.round(sigFontSize * 1.38));
        const sigAscenderPx = Math.round((STORY_FONT.ascender / STORY_FONT.unitsPerEm) * sigFontSize);
        const sigStartBaselineY = bottomBaselineY - (sigLines.length - 1) * sigLineHeight;
        const sigRuleY = sigStartBaselineY - sigAscenderPx - Math.max(5, Math.round(10 * scaleRatio));
        const sigRuleLen = Math.max(14, Math.round(36 * scaleRatio));

        drawHorizontalSegmentRule(
            rgba,
            width,
            height,
            rightX - sigRuleLen,
            rightX,
            sigRuleY,
            Math.max(1, Math.round(1.5 * scaleRatio)),
            255,
            234,
            194,
            0.58
        );

        const sigEdges = buildTextEdges(sigLines, sigFontSize, rightX, sigStartBaselineY, sigLineHeight, "right");
        const sigShadowMask = rasterizeEdgesMask(sigEdges, width, height, 0, Math.max(1, Math.round(2 * scaleRatio)));
        blendMaskRgba(rgba, sigShadowMask, 6, 8, 14, 0.78);
        const sigTextMask = rasterizeEdgesMask(sigEdges, width, height, 0, 0);
        blendMaskRgba(rgba, sigTextMask, 255, 249, 238, 0.94);
    }

    const pngBytes = await encodeRgbaToPng(rgba, width, height);
    return { width, height, rgba, pngBytes, signatureText };
}

// ============================================================================
// 3. Pure-JS H.264 Baseline (I_PCM + P_SKIP) Bitstream Encoder
// ============================================================================
class BitWriter {
    constructor(initialBytes = 256) {
        this.buf = new Uint8Array(initialBytes);
        this.bytePos = 0;
        this.bitPos = 0; // 0..7 from MSB
    }

    ensure(extraBytes) {
        if (this.bytePos + extraBytes + 8 <= this.buf.length) return;
        let nextLen = this.buf.length * 2;
        while (nextLen < this.bytePos + extraBytes + 8) nextLen *= 2;
        const next = new Uint8Array(nextLen);
        next.set(this.buf);
        this.buf = next;
    }

    writeBit(bit) {
        this.ensure(2);
        if (this.bitPos === 0) this.buf[this.bytePos] = 0;
        if (bit & 1) {
            this.buf[this.bytePos] |= (1 << (7 - this.bitPos));
        }
        this.bitPos += 1;
        if (this.bitPos === 8) {
            this.bitPos = 0;
            this.bytePos += 1;
        }
    }

    writeBits(val, count) {
        for (let i = count - 1; i >= 0; i -= 1) {
            this.writeBit((val >>> i) & 1);
        }
    }

    // Exp-Golomb unsigned ue(v)
    writeUE(val) {
        const v = val + 1;
        const bits = 31 - Math.clz32(v);
        for (let i = 0; i < bits; i += 1) this.writeBit(0);
        this.writeBits(v, bits + 1);
    }

    // Exp-Golomb signed se(v)
    writeSE(val) {
        const mapped = val <= 0 ? (-2 * val) : (2 * val - 1);
        this.writeUE(mapped);
    }

    alignZero() {
        while (this.bitPos !== 0) this.writeBit(0);
    }

    writeAlignedBytes(bytes) {
        this.alignZero();
        this.ensure(bytes.length);
        this.buf.set(bytes, this.bytePos);
        this.bytePos += bytes.length;
    }

    writeRbspTrailingBits() {
        this.writeBit(1);
        this.alignZero();
    }

    toRbsp() {
        return this.buf.subarray(0, this.bytePos);
    }
}

function rbspToNal(nalHeaderByte, rbsp) {
    // Emulation prevention: insert 0x03 before 00 00 00/01/02/03
    const out = new Uint8Array(1 + rbsp.length + Math.ceil(rbsp.length / 2) + 8);
    out[0] = nalHeaderByte;
    let dst = 1;
    let zeros = 0;
    for (let i = 0; i < rbsp.length; i += 1) {
        const b = rbsp[i];
        if (zeros === 2 && b <= 3) {
            out[dst++] = 0x03;
            zeros = 0;
        }
        out[dst++] = b;
        if (b === 0) zeros += 1;
        else zeros = 0;
    }
    return out.subarray(0, dst);
}

function buildSpsNal(width, height) {
    const mbWidth = Math.ceil(width / 16);
    const mbHeight = Math.ceil(height / 16);
    const cropRight = (mbWidth * 16 - width) >> 1;
    const cropBottom = (mbHeight * 16 - height) >> 1;

    const bw = new BitWriter(64);
    bw.writeBits(66, 8);      // profile_idc = 66 (Baseline)
    bw.writeBit(1);           // constraint_set0_flag = 1
    bw.writeBit(1);           // constraint_set1_flag = 1 (Constrained Baseline)
    bw.writeBit(0);           // constraint_set2_flag = 0
    bw.writeBits(0, 5);       // reserved_zero_5bits
    bw.writeBits(31, 8);      // level_idc = 3.1
    bw.writeUE(0);            // seq_parameter_set_id = 0
    bw.writeUE(0);            // log2_max_frame_num_minus4 = 0 (frame_num is 4 bits: 0..15)
    bw.writeUE(2);            // pic_order_cnt_type = 2 (no POC syntax in slice header)
    bw.writeUE(1);            // max_num_ref_frames = 1
    bw.writeBit(0);           // gaps_in_frame_num_value_allowed_flag = 0
    bw.writeUE(mbWidth - 1);  // pic_width_in_mbs_minus1
    bw.writeUE(mbHeight - 1); // pic_height_in_map_units_minus1
    bw.writeBit(1);           // frame_mbs_only_flag = 1
    bw.writeBit(1);           // direct_8x8_inference_flag = 1
    if (cropRight > 0 || cropBottom > 0) {
        bw.writeBit(1);       // frame_cropping_flag = 1
        bw.writeUE(0);        // left
        bw.writeUE(cropRight);
        bw.writeUE(0);        // top
        bw.writeUE(cropBottom);
    } else {
        bw.writeBit(0);
    }
    bw.writeBit(0);           // vui_parameters_present_flag = 0
    bw.writeRbspTrailingBits();
    return rbspToNal(0x67, bw.toRbsp()); // nal_ref_idc=3, nal_unit_type=7 (SPS)
}

function buildPpsNal() {
    const bw = new BitWriter(32);
    bw.writeUE(0);  // pic_parameter_set_id = 0
    bw.writeUE(0);  // seq_parameter_set_id = 0
    bw.writeBit(0); // entropy_coding_mode_flag = 0 (CAVLC)
    bw.writeBit(0); // bottom_field_pic_order_in_frame_present_flag = 0
    bw.writeUE(0);  // num_slice_groups_minus1 = 0
    bw.writeUE(0);  // num_ref_idx_l0_default_active_minus1 = 0
    bw.writeUE(0);  // num_ref_idx_l1_default_active_minus1 = 0
    bw.writeBit(0); // weighted_pred_flag = 0
    bw.writeBits(0, 2); // weighted_bipred_idc = 0
    bw.writeSE(0);  // pic_init_qp_minus26 = 0
    bw.writeSE(0);  // pic_init_qs_minus26 = 0
    bw.writeSE(0);  // chroma_qp_index_offset = 0
    bw.writeBit(1); // deblocking_filter_control_present_flag = 1
    bw.writeBit(0); // constrained_intra_pred_flag = 0
    bw.writeBit(0); // redundant_pic_cnt_present_flag = 0
    bw.writeRbspTrailingBits();
    return rbspToNal(0x68, bw.toRbsp()); // nal_ref_idc=3, nal_unit_type=8 (PPS)
}

function rgbaToYuv420Padded(rgba, width, height) {
    const mbWidth = Math.ceil(width / 16);
    const mbHeight = Math.ceil(height / 16);
    const pw = mbWidth * 16;
    const ph = mbHeight * 16;
    const yPlane = new Uint8Array(pw * ph);
    const uPlane = new Uint8Array((pw >> 1) * (ph >> 1));
    const vPlane = new Uint8Array((pw >> 1) * (ph >> 1));

    // BT.601 limited range (16..235 Y, 16..240 Cb/Cr)
    for (let y = 0; y < ph; y += 1) {
        const sy = Math.min(height - 1, y);
        for (let x = 0; x < pw; x += 1) {
            const sx = Math.min(width - 1, x);
            const idx = (sy * width + sx) * 4;
            const r = rgba[idx];
            const g = rgba[idx + 1];
            const b = rgba[idx + 2];
            const yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            yPlane[y * pw + x] = Math.max(16, Math.min(235, yVal));
        }
    }

    const cw = pw >> 1;
    const ch = ph >> 1;
    for (let cy = 0; cy < ch; cy += 1) {
        const sy0 = Math.min(height - 1, cy * 2);
        const sy1 = Math.min(height - 1, cy * 2 + 1);
        for (let cx = 0; cx < cw; cx += 1) {
            const sx0 = Math.min(width - 1, cx * 2);
            const sx1 = Math.min(width - 1, cx * 2 + 1);
            const i00 = (sy0 * width + sx0) * 4;
            const i10 = (sy0 * width + sx1) * 4;
            const i01 = (sy1 * width + sx0) * 4;
            const i11 = (sy1 * width + sx1) * 4;
            const r = (rgba[i00] + rgba[i10] + rgba[i01] + rgba[i11] + 2) >> 2;
            const g = (rgba[i00 + 1] + rgba[i10 + 1] + rgba[i01 + 1] + rgba[i11 + 1] + 2) >> 2;
            const b = (rgba[i00 + 2] + rgba[i10 + 2] + rgba[i01 + 2] + rgba[i11 + 2] + 2) >> 2;
            const uVal = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
            const vVal = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
            uPlane[cy * cw + cx] = Math.max(16, Math.min(240, uVal));
            vPlane[cy * cw + cx] = Math.max(16, Math.min(240, vVal));
        }
    }

    return { mbWidth, mbHeight, pw, ph, yPlane, uPlane, vPlane };
}

function buildIdrIpcmNal(rgba, width, height) {
    const { mbWidth, mbHeight, pw, yPlane, uPlane, vPlane } = rgbaToYuv420Padded(rgba, width, height);
    const cw = pw >> 1;
    const bw = new BitWriter(mbWidth * mbHeight * 400 + 128);

    // IDR Slice Header (nal_ref_idc=3, nal_unit_type=5)
    bw.writeUE(0);       // first_mb_in_slice = 0
    bw.writeUE(7);       // slice_type = 7 (all-I slice)
    bw.writeUE(0);       // pic_parameter_set_id = 0
    bw.writeBits(0, 4);  // frame_num = 0 (4 bits)
    bw.writeUE(0);       // idr_pic_id = 0
    // pic_order_cnt_type == 2 -> no POC bits
    // dec_ref_pic_marking for IDR:
    bw.writeBit(0);      // no_output_of_prior_pics_flag = 0
    bw.writeBit(0);      // long_term_reference_flag = 0
    bw.writeSE(0);       // slice_qp_delta = 0
    bw.writeUE(1);       // disable_deblocking_filter_idc = 1 (disable deblocking across lossless I_PCM)

    const pcmBlock = new Uint8Array(384);
    for (let mby = 0; mby < mbHeight; mby += 1) {
        for (let mbx = 0; mbx < mbWidth; mbx += 1) {
            bw.writeUE(25); // mb_type = 25 (I_PCM)
            // Copy 16x16 Y, 8x8 Cb, 8x8 Cr
            let p = 0;
            const yBase = mby * 16 * pw + mbx * 16;
            for (let r = 0; r < 16; r += 1) {
                const row = yBase + r * pw;
                pcmBlock.set(yPlane.subarray(row, row + 16), p);
                p += 16;
            }
            const cBase = mby * 8 * cw + mbx * 8;
            for (let r = 0; r < 8; r += 1) {
                const row = cBase + r * cw;
                pcmBlock.set(uPlane.subarray(row, row + 8), p);
                p += 8;
            }
            for (let r = 0; r < 8; r += 1) {
                const row = cBase + r * cw;
                pcmBlock.set(vPlane.subarray(row, row + 8), p);
                p += 8;
            }
            bw.writeAlignedBytes(pcmBlock);
        }
    }

    bw.writeRbspTrailingBits();
    return rbspToNal(0x65, bw.toRbsp());
}

function buildPSkipNal(frameNum, totalMbs) {
    const bw = new BitWriter(32);
    bw.writeUE(0);                    // first_mb_in_slice = 0
    bw.writeUE(5);                    // slice_type = 5 (all-P slice)
    bw.writeUE(0);                    // pic_parameter_set_id = 0
    bw.writeBits(frameNum & 0x0F, 4); // frame_num (4 bits)
    bw.writeBit(0);                   // num_ref_idx_active_override_flag = 0
    bw.writeBit(0);                   // ref_pic_list_modification_flag_l0 = 0
    bw.writeBit(0);                   // adaptive_ref_pic_marking_mode_flag = 0
    bw.writeSE(0);                    // slice_qp_delta = 0
    bw.writeUE(1);                    // disable_deblocking_filter_idc = 1
    bw.writeUE(totalMbs);             // mb_skip_run = all macroblocks skipped!
    bw.writeRbspTrailingBits();
    return rbspToNal(0x41, bw.toRbsp()); // nal_ref_idc=2 (reference), nal_unit_type=1 (non-IDR)
}

function nalToAvccSample(nal) {
    const out = new Uint8Array(4 + nal.length);
    new DataView(out.buffer).setUint32(0, nal.length, false);
    out.set(nal, 4);
    return out;
}

// ============================================================================
// 4. Audio Extractor for .m4a / .mp4 (Facebook Video!) / .aac / .mp3
// ============================================================================
function readFourCC(bytes, offset) {
    return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function iterMp4Boxes(bytes, start, end) {
    const boxes = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = start;
    while (pos + 8 <= end) {
        let size = view.getUint32(pos, false);
        const type = readFourCC(bytes, pos + 4);
        let headerSize = 8;
        if (size === 1) {
            if (pos + 16 > end) break;
            const hi = view.getUint32(pos + 8, false);
            const lo = view.getUint32(pos + 12, false);
            size = hi * 4294967296 + lo;
            headerSize = 16;
        } else if (size === 0) {
            size = end - pos;
        }
        if (size < headerSize || pos + size > end) break;
        boxes.push({ type, start: pos, dataStart: pos + headerSize, end: pos + size });
        pos += size;
    }
    return boxes;
}

function buildEsdsBoxPayload(objectTypeIndication, decSpecificInfo = null, avgBitrate = 96000) {
    const dsi = decSpecificInfo || new Uint8Array(0);
    const hasDsi = dsi.length > 0;
    const decConfigLen = 13 + (hasDsi ? 2 + dsi.length : 0);
    const esDescrLen = 3 + (2 + decConfigLen) + 3;
    const out = new Uint8Array(4 + 2 + esDescrLen);
    let p = 0;
    // version/flags = 0
    out[p++] = 0; out[p++] = 0; out[p++] = 0; out[p++] = 0;
    // ES_Descriptor tag 0x03
    out[p++] = 0x03;
    out[p++] = esDescrLen;
    out[p++] = 0x00; out[p++] = 0x02; // ES_ID = 2
    out[p++] = 0x00; // flags
    // DecoderConfigDescriptor tag 0x04
    out[p++] = 0x04;
    out[p++] = decConfigLen;
    out[p++] = objectTypeIndication; // 0x40 = AAC, 0x6B = MPEG-1 MP3, 0x69 = MPEG-2 MP3
    out[p++] = 0x15; // streamType=0x05 (AudioStream) << 2 | upstream=0 | reserved=1
    out[p++] = 0x00; out[p++] = 0x30; out[p++] = 0x00; // bufferSizeDB
    const dv = new DataView(out.buffer);
    dv.setUint32(p, avgBitrate, false); p += 4;
    dv.setUint32(p, avgBitrate, false); p += 4;
    if (hasDsi) {
        out[p++] = 0x05; // DecSpecificInfo tag
        out[p++] = dsi.length;
        out.set(dsi, p);
        p += dsi.length;
    }
    // SLConfigDescriptor tag 0x06
    out[p++] = 0x06;
    out[p++] = 0x01;
    out[p++] = 0x02;
    return out;
}

function extractMp4SoundTrack(bytes, maxDurationSec = 15) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const topBoxes = iterMp4Boxes(bytes, 0, bytes.byteLength);
    const moov = topBoxes.find(b => b.type === "moov");
    if (!moov) return null;

    for (const trak of iterMp4Boxes(bytes, moov.dataStart, moov.end).filter(b => b.type === "trak")) {
        const mdia = iterMp4Boxes(bytes, trak.dataStart, trak.end).find(b => b.type === "mdia");
        if (!mdia) continue;
        const mdiaChildren = iterMp4Boxes(bytes, mdia.dataStart, mdia.end);
        const hdlr = mdiaChildren.find(b => b.type === "hdlr");
        if (!hdlr || hdlr.end - hdlr.dataStart < 12) continue;
        const handlerType = readFourCC(bytes, hdlr.dataStart + 8);
        if (handlerType !== "soun") continue;

        const mdhd = mdiaChildren.find(b => b.type === "mdhd");
        if (!mdhd) continue;
        const mdhdVer = bytes[mdhd.dataStart];
        const timescale = mdhdVer === 1
            ? view.getUint32(mdhd.dataStart + 20, false)
            : view.getUint32(mdhd.dataStart + 12, false);

        const minf = mdiaChildren.find(b => b.type === "minf");
        if (!minf) continue;
        const stbl = iterMp4Boxes(bytes, minf.dataStart, minf.end).find(b => b.type === "stbl");
        if (!stbl) continue;
        const stblChildren = iterMp4Boxes(bytes, stbl.dataStart, stbl.end);

        const stsd = stblChildren.find(b => b.type === "stsd");
        const stts = stblChildren.find(b => b.type === "stts");
        const stsc = stblChildren.find(b => b.type === "stsc");
        const stsz = stblChildren.find(b => b.type === "stsz");
        const stco = stblChildren.find(b => b.type === "stco");
        const co64 = stblChildren.find(b => b.type === "co64");
        if (!stsd || !stts || !stsc || !stsz || (!stco && !co64)) continue;

        const sampleEntries = iterMp4Boxes(bytes, stsd.dataStart + 8, stsd.end);
        const mp4a = sampleEntries.find(b => b.type === "mp4a");
        if (!mp4a) continue;

        // AudioSampleEntry header is 28 bytes after box header
        const channelCount = view.getUint16(mp4a.dataStart + 16, false) || 2;
        const sampleRate = (view.getUint32(mp4a.dataStart + 24, false) >>> 16) || timescale || 44100;
        const mp4aChildren = iterMp4Boxes(bytes, mp4a.dataStart + 28, mp4a.end);
        const esdsBox = mp4aChildren.find(b => b.type === "esds");
        if (!esdsBox) continue;
        const esdsPayload = bytes.slice(esdsBox.dataStart, esdsBox.end);

        // Sample sizes
        const fixedSampleSize = view.getUint32(stsz.dataStart + 4, false);
        const sampleCount = view.getUint32(stsz.dataStart + 8, false);
        const sampleSizes = new Uint32Array(sampleCount);
        for (let i = 0; i < sampleCount; i += 1) {
            sampleSizes[i] = fixedSampleSize || view.getUint32(stsz.dataStart + 12 + i * 4, false);
        }

        // Sample deltas (stts)
        const sttsCount = view.getUint32(stts.dataStart + 4, false);
        const sampleDeltas = new Uint32Array(sampleCount);
        let sIdx = 0;
        for (let i = 0; i < sttsCount && sIdx < sampleCount; i += 1) {
            const cnt = view.getUint32(stts.dataStart + 8 + i * 8, false);
            const delta = view.getUint32(stts.dataStart + 12 + i * 8, false);
            for (let k = 0; k < cnt && sIdx < sampleCount; k += 1) {
                sampleDeltas[sIdx++] = delta;
            }
        }

        // Chunk offsets (stco / co64)
        const chunkCount = stco
            ? view.getUint32(stco.dataStart + 4, false)
            : view.getUint32(co64.dataStart + 4, false);
        const chunkOffsets = new Float64Array(chunkCount);
        for (let i = 0; i < chunkCount; i += 1) {
            if (stco) {
                chunkOffsets[i] = view.getUint32(stco.dataStart + 8 + i * 4, false);
            } else {
                const hi = view.getUint32(co64.dataStart + 8 + i * 8, false);
                const lo = view.getUint32(co64.dataStart + 12 + i * 8, false);
                chunkOffsets[i] = hi * 4294967296 + lo;
            }
        }

        // Sample-to-chunk (stsc)
        const stscCount = view.getUint32(stsc.dataStart + 4, false);
        const stscEntries = [];
        for (let i = 0; i < stscCount; i += 1) {
            stscEntries.push({
                firstChunk: view.getUint32(stsc.dataStart + 8 + i * 12, false),
                samplesPerChunk: view.getUint32(stsc.dataStart + 12 + i * 12, false)
            });
        }

        const frames = [];
        const deltas = [];
        const maxTicks = Math.round(maxDurationSec * timescale);
        let totalTicks = 0;
        let curSample = 0;

        for (let c = 0; c < chunkCount && curSample < sampleCount && totalTicks < maxTicks; c += 1) {
            const chunkNum1 = c + 1;
            let spc = stscEntries[0]?.samplesPerChunk || 1;
            for (const entry of stscEntries) {
                if (entry.firstChunk <= chunkNum1) spc = entry.samplesPerChunk;
                else break;
            }
            let offset = chunkOffsets[c];
            for (let k = 0; k < spc && curSample < sampleCount && totalTicks < maxTicks; k += 1) {
                const sz = sampleSizes[curSample];
                const d = sampleDeltas[curSample] || 1024;
                if (offset + sz <= bytes.byteLength) {
                    frames.push(bytes.subarray(offset, offset + sz));
                    deltas.push(d);
                    totalTicks += d;
                }
                offset += sz;
                curSample += 1;
            }
        }

        if (!frames.length) continue;
        return {
            codec: "aac",
            timescale,
            sampleRate,
            channelCount,
            esdsPayload,
            frames,
            deltas,
            durationSec: totalTicks / timescale
        };
    }
    return null;
}

const ADTS_SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350
];

function extractAdtsAacTrack(bytes, maxDurationSec = 15) {
    let pos = 0;
    if (bytes.byteLength > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        const id3Size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
        pos = 10 + id3Size;
    }
    if (pos + 7 > bytes.byteLength || bytes[pos] !== 0xFF || (bytes[pos + 1] & 0xF0) !== 0xF0) {
        return null;
    }

    const frames = [];
    const deltas = [];
    let audioObjectType = 2;
    let freqIdx = 4;
    let chanCfg = 2;
    let sampleRate = 44100;
    let totalSamples = 0;

    while (pos + 7 <= bytes.byteLength) {
        if (bytes[pos] !== 0xFF || (bytes[pos + 1] & 0xF0) !== 0xF0) break;
        const protectionAbsent = bytes[pos + 1] & 0x01;
        const headerLen = protectionAbsent ? 7 : 9;
        const profile = ((bytes[pos + 2] >>> 6) & 0x03) + 1;
        const sfIdx = (bytes[pos + 2] >>> 2) & 0x0F;
        const ch = ((bytes[pos + 2] & 0x01) << 2) | ((bytes[pos + 3] >>> 6) & 0x03);
        const frameLen = ((bytes[pos + 3] & 0x03) << 11) | (bytes[pos + 4] << 3) | ((bytes[pos + 5] >>> 5) & 0x07);
        if (frameLen <= headerLen || pos + frameLen > bytes.byteLength) break;

        if (!frames.length) {
            audioObjectType = profile;
            freqIdx = sfIdx < ADTS_SAMPLE_RATES.length ? sfIdx : 4;
            sampleRate = ADTS_SAMPLE_RATES[freqIdx];
            chanCfg = ch || 2;
        }
        frames.push(bytes.subarray(pos + headerLen, pos + frameLen));
        deltas.push(1024);
        totalSamples += 1024;
        pos += frameLen;
        if (totalSamples / sampleRate >= maxDurationSec) break;
    }

    if (!frames.length) return null;
    const ascVal = ((audioObjectType & 0x1F) << 11) | ((freqIdx & 0x0F) << 7) | ((chanCfg & 0x0F) << 3);
    const asc = new Uint8Array([(ascVal >>> 8) & 0xFF, ascVal & 0xFF]);
    return {
        codec: "aac",
        timescale: sampleRate,
        sampleRate,
        channelCount: chanCfg,
        esdsPayload: buildEsdsBoxPayload(0x40, asc, 96000),
        frames,
        deltas,
        durationSec: totalSamples / sampleRate
    };
}

const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MP3_SR_V1 = [44100, 48000, 32000, 0];
const MP3_SR_V2 = [22050, 24000, 16000, 0];
const MP3_SR_V25 = [11025, 12000, 8000, 0];

function extractMp3Track(bytes, maxDurationSec = 15) {
    let pos = 0;
    if (bytes.byteLength > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        const id3Size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
        pos = 10 + id3Size;
    }

    // Scan up to 8 KB to find first valid MPEG Layer 3 sync header
    const scanEnd = Math.min(bytes.byteLength - 4, pos + 8192);
    while (pos < scanEnd) {
        if (bytes[pos] === 0xFF && (bytes[pos + 1] & 0xE0) === 0xE0) {
            const verBits = (bytes[pos + 1] >>> 3) & 0x03;
            const layerBits = (bytes[pos + 1] >>> 1) & 0x03;
            const brIdx = (bytes[pos + 2] >>> 4) & 0x0F;
            const srIdx = (bytes[pos + 2] >>> 2) & 0x03;
            if (verBits !== 1 && layerBits === 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) break;
        }
        pos += 1;
    }

    const frames = [];
    const deltas = [];
    let sampleRate = 44100;
    let channelCount = 2;
    let mpegV1 = true;
    let totalSamples = 0;

    while (pos + 4 <= bytes.byteLength) {
        if (bytes[pos] !== 0xFF || (bytes[pos + 1] & 0xE0) !== 0xE0) break;
        const verBits = (bytes[pos + 1] >>> 3) & 0x03;
        const layerBits = (bytes[pos + 1] >>> 1) & 0x03;
        const brIdx = (bytes[pos + 2] >>> 4) & 0x0F;
        const srIdx = (bytes[pos + 2] >>> 2) & 0x03;
        const padding = (bytes[pos + 2] >>> 1) & 0x01;
        const chanMode = (bytes[pos + 3] >>> 6) & 0x03;
        if (verBits === 1 || layerBits !== 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) break;

        const isV1 = verBits === 3;
        const sr = isV1 ? MP3_SR_V1[srIdx] : (verBits === 2 ? MP3_SR_V2[srIdx] : MP3_SR_V25[srIdx]);
        const bitrateKbps = isV1 ? MP3_BITRATES_V1_L3[brIdx] : MP3_BITRATES_V2_L3[brIdx];
        const samplesPerFrame = isV1 ? 1152 : 576;
        const frameLen = isV1
            ? Math.floor((144000 * bitrateKbps) / sr) + padding
            : Math.floor((72000 * bitrateKbps) / sr) + padding;

        if (frameLen < 24 || pos + frameLen > bytes.byteLength) break;
        const frameSlice = bytes.subarray(pos, pos + frameLen);

        // Skip Xing/Info VBR metadata header frame on frame 0
        if (!frames.length) {
            const headerTxt = String.fromCharCode(...frameSlice.subarray(0, Math.min(64, frameLen)));
            if (headerTxt.includes("Xing") || headerTxt.includes("Info") || headerTxt.includes("VBRI")) {
                pos += frameLen;
                continue;
            }
            sampleRate = sr;
            channelCount = chanMode === 3 ? 1 : 2;
            mpegV1 = isV1;
        }

        frames.push(frameSlice);
        deltas.push(samplesPerFrame);
        totalSamples += samplesPerFrame;
        pos += frameLen;
        if (totalSamples / sampleRate >= maxDurationSec) break;
    }

    if (!frames.length) return null;
    const oti = mpegV1 ? 0x6B : 0x69;
    return {
        codec: "mp3",
        timescale: sampleRate,
        sampleRate,
        channelCount,
        esdsPayload: buildEsdsBoxPayload(oti, null, 128000),
        frames,
        deltas,
        durationSec: totalSamples / sampleRate
    };
}

export function extractAudioForStoryMp4(audioBytes, { maxDurationSec = STORY_DEFAULT_DURATION_SEC } = {}) {
    if (!audioBytes || audioBytes.byteLength < 32) return null;
    const bytes = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes);
    return extractMp4SoundTrack(bytes, maxDurationSec)
        || extractAdtsAacTrack(bytes, maxDurationSec)
        || extractMp3Track(bytes, maxDurationSec);
}

function loopAudioTrackToDuration(track, targetDurationSec) {
    if (!track || !track.frames.length) return null;
    const targetTicks = Math.max(track.timescale * 3, Math.round(targetDurationSec * track.timescale));
    const frames = [];
    const deltas = [];
    let totalTicks = 0;
    let idx = 0;
    while (totalTicks < targetTicks) {
        const i = idx % track.frames.length;
        frames.push(track.frames[i]);
        deltas.push(track.deltas[i]);
        totalTicks += track.deltas[i];
        idx += 1;
    }
    return {
        ...track,
        frames,
        deltas,
        totalTicks,
        durationSec: totalTicks / track.timescale
    };
}

// ============================================================================
// 5. ISO BMFF MP4 Muxer (faststart: ftyp + moov + mdat)
// ============================================================================
function mp4Box(type, ...parts) {
    let payloadLen = 0;
    for (const p of parts) payloadLen += p.byteLength;
    const out = new Uint8Array(8 + payloadLen);
    new DataView(out.buffer).setUint32(0, 8 + payloadLen, false);
    for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
    let offset = 8;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.byteLength;
    }
    return out;
}

function u32Bytes(...vals) {
    const out = new Uint8Array(vals.length * 4);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < vals.length; i += 1) dv.setUint32(i * 4, vals[i] >>> 0, false);
    return out;
}

function asciiBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i);
    return out;
}

function buildMvhd(timescale, durationTicks) {
    const b = new Uint8Array(100);
    const dv = new DataView(b.buffer);
    dv.setUint32(12, timescale, false);
    dv.setUint32(16, durationTicks, false);
    dv.setUint32(20, 0x00010000, false); // rate 1.0
    dv.setUint16(24, 0x0100, false);     // volume 1.0
    // Identity matrix
    dv.setUint32(36, 0x00010000, false);
    dv.setUint32(52, 0x00010000, false);
    dv.setUint32(68, 0x40000000, false);
    dv.setUint32(96, 3, false);          // next_track_ID
    return mp4Box("mvhd", b);
}

function buildTkhd(trackId, durationMovieTicks, width, height, isAudio) {
    const b = new Uint8Array(84);
    const dv = new DataView(b.buffer);
    b[3] = 0x03; // track_enabled | track_in_movie
    dv.setUint32(12, trackId, false);
    dv.setUint32(20, durationMovieTicks, false);
    if (isAudio) dv.setUint16(36, 0x0100, false);
    dv.setUint32(40, 0x00010000, false);
    dv.setUint32(56, 0x00010000, false);
    dv.setUint32(72, 0x40000000, false);
    if (!isAudio) {
        dv.setUint32(76, width << 16, false);
        dv.setUint32(80, height << 16, false);
    }
    return mp4Box("tkhd", b);
}

function buildMdhd(timescale, durationTicks) {
    const b = new Uint8Array(24);
    const dv = new DataView(b.buffer);
    dv.setUint32(12, timescale, false);
    dv.setUint32(16, durationTicks, false);
    dv.setUint16(20, 0x55C4, false); // 'und'
    return mp4Box("mdhd", b);
}

function buildHdlr(handlerType, name) {
    const nameBytes = asciiBytes(name + "\0");
    const b = new Uint8Array(24 + nameBytes.length);
    for (let i = 0; i < 4; i += 1) b[8 + i] = handlerType.charCodeAt(i);
    b.set(nameBytes, 24);
    return mp4Box("hdlr", b);
}

function buildAvc1Box(width, height, spsNal, ppsNal) {
    const avcC = new Uint8Array(11 + spsNal.length + ppsNal.length);
    let p = 0;
    avcC[p++] = 1;            // configurationVersion
    avcC[p++] = spsNal[1];    // AVCProfileIndication
    avcC[p++] = spsNal[2];    // profile_compatibility
    avcC[p++] = spsNal[3];    // AVCLevelIndication
    avcC[p++] = 0xFF;         // 4-byte NAL length size minus 1
    avcC[p++] = 0xE1;         // 1 SPS
    avcC[p++] = (spsNal.length >>> 8) & 0xFF;
    avcC[p++] = spsNal.length & 0xFF;
    avcC.set(spsNal, p); p += spsNal.length;
    avcC[p++] = 1;            // 1 PPS
    avcC[p++] = (ppsNal.length >>> 8) & 0xFF;
    avcC[p++] = ppsNal.length & 0xFF;
    avcC.set(ppsNal, p);

    const header = new Uint8Array(78);
    const dv = new DataView(header.buffer);
    dv.setUint16(6, 1, false);  // data_reference_index = 1
    dv.setUint16(24, width, false);
    dv.setUint16(26, height, false);
    dv.setUint32(28, 0x00480000, false); // 72 dpi
    dv.setUint32(32, 0x00480000, false);
    dv.setUint16(40, 1, false); // frame_count = 1
    dv.setUint16(74, 0x0018, false);
    dv.setInt16(76, -1, false);
    return mp4Box("avc1", header, mp4Box("avcC", avcC));
}

function buildMp4aBox(channelCount, sampleRate, esdsPayload) {
    const header = new Uint8Array(28);
    const dv = new DataView(header.buffer);
    dv.setUint16(6, 1, false); // data_reference_index = 1
    dv.setUint16(16, channelCount, false);
    dv.setUint16(18, 16, false); // sampleSize = 16
    dv.setUint32(24, Math.min(65535, sampleRate) << 16, false);
    return mp4Box("mp4a", header, mp4Box("esds", esdsPayload));
}

function buildStts(deltas) {
    // Run-length compress consecutive equal deltas
    const runs = [];
    for (const d of deltas) {
        if (runs.length && runs[runs.length - 1][1] === d) {
            runs[runs.length - 1][0] += 1;
        } else {
            runs.push([1, d]);
        }
    }
    const b = new Uint8Array(8 + runs.length * 8);
    const dv = new DataView(b.buffer);
    dv.setUint32(4, runs.length, false);
    for (let i = 0; i < runs.length; i += 1) {
        dv.setUint32(8 + i * 8, runs[i][0], false);
        dv.setUint32(12 + i * 8, runs[i][1], false);
    }
    return mp4Box("stts", b);
}

function buildStsz(samples) {
    const b = new Uint8Array(12 + samples.length * 4);
    const dv = new DataView(b.buffer);
    dv.setUint32(8, samples.length, false);
    for (let i = 0; i < samples.length; i += 1) {
        dv.setUint32(12 + i * 4, samples[i].byteLength, false);
    }
    return mp4Box("stsz", b);
}

function buildSingleChunkStsc(sampleCount) {
    return mp4Box("stsc", u32Bytes(0, 1, 1, sampleCount, 1));
}

function buildTrackBox({
    trackId,
    movieTimescale,
    trackTimescale,
    trackDurationTicks,
    width,
    height,
    isAudio,
    sampleEntryBox,
    samples,
    deltas,
    syncSampleOne = false,
    chunkOffset
}) {
    const movieDuration = Math.round((trackDurationTicks / trackTimescale) * movieTimescale);
    const vmhdOrSmhd = isAudio
        ? mp4Box("smhd", new Uint8Array(8))
        : mp4Box("vmhd", u32Bytes(1, 0, 0));
    const dinf = mp4Box("dinf", mp4Box("dref", u32Bytes(0, 1), mp4Box("url ", u32Bytes(1))));
    const stsd = mp4Box("stsd", u32Bytes(0, 1), sampleEntryBox);
    const stblParts = [
        stsd,
        buildStts(deltas),
        buildSingleChunkStsc(samples.length),
        buildStsz(samples),
        mp4Box("stco", u32Bytes(0, 1, chunkOffset))
    ];
    if (syncSampleOne) {
        stblParts.splice(2, 0, mp4Box("stss", u32Bytes(0, 1, 1)));
    }
    const stbl = mp4Box("stbl", ...stblParts);
    const minf = mp4Box("minf", vmhdOrSmhd, dinf, stbl);
    const mdia = mp4Box(
        "mdia",
        buildMdhd(trackTimescale, trackDurationTicks),
        buildHdlr(isAudio ? "soun" : "vide", isAudio ? "StoryAudio" : "StoryVideo"),
        minf
    );
    return mp4Box("trak", buildTkhd(trackId, movieDuration, width, height, isAudio), mdia);
}

function muxStoryMp4Tracks({
    width,
    height,
    videoTimescale,
    videoDurationTicks,
    videoSampleEntryBox,
    videoSamples,
    videoDeltas,
    audioTrack,
    targetSec
}) {
    let videoChunkBytes = 0;
    for (const s of videoSamples) videoChunkBytes += s.byteLength;
    let audioChunkBytes = 0;
    if (audioTrack) {
        for (const s of audioTrack.frames) audioChunkBytes += s.byteLength;
    }

    const ftyp = mp4Box(
        "ftyp",
        asciiBytes("mp42"),
        u32Bytes(0),
        asciiBytes("mp42isomavc1")
    );

    const movieTimescale = 1000;
    const movieDurationTicks = Math.round(targetSec * movieTimescale);

    // Two-pass moov build so stco offsets into mdat are exact (faststart)
    const buildMoov = (videoOffset, audioOffset) => {
        const traks = [
            buildTrackBox({
                trackId: 1,
                movieTimescale,
                trackTimescale: videoTimescale,
                trackDurationTicks: videoDurationTicks,
                width,
                height,
                isAudio: false,
                sampleEntryBox: videoSampleEntryBox,
                samples: videoSamples,
                deltas: videoDeltas,
                syncSampleOne: true,
                chunkOffset: videoOffset
            })
        ];
        if (audioTrack) {
            traks.push(
                buildTrackBox({
                    trackId: 2,
                    movieTimescale,
                    trackTimescale: audioTrack.timescale,
                    trackDurationTicks: audioTrack.totalTicks,
                    width: 0,
                    height: 0,
                    isAudio: true,
                    sampleEntryBox: buildMp4aBox(audioTrack.channelCount, audioTrack.sampleRate, audioTrack.esdsPayload),
                    samples: audioTrack.frames,
                    deltas: audioTrack.deltas,
                    syncSampleOne: false,
                    chunkOffset: audioOffset
                })
            );
        }
        return mp4Box("moov", buildMvhd(movieTimescale, movieDurationTicks), ...traks);
    };

    const dummyMoov = buildMoov(0, 0);
    const mdatHeaderSize = 8;
    const videoOffset = ftyp.byteLength + dummyMoov.byteLength + mdatHeaderSize;
    const audioOffset = videoOffset + videoChunkBytes;
    const realMoov = buildMoov(videoOffset, audioOffset);

    const mdatSize = mdatHeaderSize + videoChunkBytes + audioChunkBytes;
    const out = new Uint8Array(ftyp.byteLength + realMoov.byteLength + mdatSize);
    let pos = 0;
    out.set(ftyp, pos); pos += ftyp.byteLength;
    out.set(realMoov, pos); pos += realMoov.byteLength;
    new DataView(out.buffer).setUint32(pos, mdatSize, false);
    for (let i = 0; i < 4; i += 1) out[pos + 4 + i] = "mdat".charCodeAt(i);
    pos += 8;

    for (const s of videoSamples) {
        out.set(s, pos);
        pos += s.byteLength;
    }
    if (audioTrack) {
        for (const s of audioTrack.frames) {
            out.set(s, pos);
            pos += s.byteLength;
        }
    }

    return out;
}

export function encodeStoryMp4({
    rgba,
    width = STORY_VIDEO_WIDTH,
    height = STORY_VIDEO_HEIGHT,
    audioBytes = null,
    fps = STORY_VIDEO_FPS,
    durationSec = STORY_DEFAULT_DURATION_SEC,
    maxDurationSec = STORY_MAX_DURATION_FEED_REELS_SEC
}) {
    const safeMaxSec = Math.max(
        STORY_MIN_DURATION_SEC,
        Math.min(STORY_MAX_DURATION_FEED_REELS_SEC, Math.round(Number(maxDurationSec) || STORY_MAX_DURATION_FEED_REELS_SEC))
    );
    const parsedAudio = audioBytes ? extractAudioForStoryMp4(audioBytes, { maxDurationSec: safeMaxSec }) : null;
    // Match video duration to uploaded clip (clamped 8s..safeMaxSec: 60s for Beranda/Reels, 25s for Story)
    const targetSec = parsedAudio
        ? Math.min(safeMaxSec, Math.max(STORY_MIN_DURATION_SEC, Math.round(parsedAudio.durationSec)))
        : Math.min(safeMaxSec, Math.max(3, Math.round(Number(durationSec) || STORY_DEFAULT_DURATION_SEC)));
    const audioTrack = parsedAudio ? loopAudioTrackToDuration(parsedAudio, targetSec) : null;

    const totalVideoFrames = Math.max(fps * 3, Math.round(targetSec * fps));
    const videoTimescale = fps * 1000;
    const videoDelta = 1000;
    const videoDurationTicks = totalVideoFrames * videoDelta;

    const spsNal = buildSpsNal(width, height);
    const ppsNal = buildPpsNal();
    const idrNal = buildIdrIpcmNal(rgba, width, height);
    const totalMbs = Math.ceil(width / 16) * Math.ceil(height / 16);

    const videoSamples = [nalToAvccSample(idrNal)];
    const videoDeltas = [videoDelta];
    for (let f = 1; f < totalVideoFrames; f += 1) {
        videoSamples.push(nalToAvccSample(buildPSkipNal(f, totalMbs)));
        videoDeltas.push(videoDelta);
    }

    const out = muxStoryMp4Tracks({
        width,
        height,
        videoTimescale,
        videoDurationTicks,
        videoSampleEntryBox: buildAvc1Box(width, height, spsNal, ppsNal),
        videoSamples,
        videoDeltas,
        audioTrack,
        targetSec
    });

    return {
        mp4Bytes: out,
        durationSec: targetSec,
        hasAudio: Boolean(audioTrack)
    };
}

export function readMp4DurationSec(mp4Bytes) {
    if (!mp4Bytes) return 0;
    const bytes = mp4Bytes instanceof Uint8Array
        ? mp4Bytes
        : new Uint8Array(mp4Bytes.buffer || mp4Bytes, mp4Bytes.byteOffset || 0, mp4Bytes.byteLength ?? mp4Bytes.length ?? 0);
    if (bytes.byteLength < 32) return 0;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const moov = iterMp4Boxes(bytes, 0, bytes.byteLength).find(b => b.type === "moov");
    if (!moov) return 0;
    const mvhd = iterMp4Boxes(bytes, moov.dataStart, moov.end).find(b => b.type === "mvhd");
    if (!mvhd || mvhd.end - mvhd.dataStart < 20) return 0;
    const ver = bytes[mvhd.dataStart];
    if (ver === 1 && mvhd.end - mvhd.dataStart >= 32) {
        const timescale = view.getUint32(mvhd.dataStart + 20, false);
        const hi = view.getUint32(mvhd.dataStart + 24, false);
        const lo = view.getUint32(mvhd.dataStart + 28, false);
        return timescale ? (hi * 4294967296 + lo) / timescale : 0;
    }
    const timescale = view.getUint32(mvhd.dataStart + 12, false);
    const duration = view.getUint32(mvhd.dataStart + 16, false);
    return timescale ? duration / timescale : 0;
}

export function capStoryMp4Duration(mp4Bytes, maxDurationSec = STORY_MAX_DURATION_STORY_SEC) {
    if (!mp4Bytes) return mp4Bytes;
    const bytes = mp4Bytes instanceof Uint8Array
        ? mp4Bytes
        : new Uint8Array(mp4Bytes.buffer || mp4Bytes, mp4Bytes.byteOffset || 0, mp4Bytes.byteLength ?? mp4Bytes.length ?? 0);
    const safeMaxSec = Math.max(
        STORY_MIN_DURATION_SEC,
        Math.min(STORY_MAX_DURATION_FEED_REELS_SEC, Math.round(Number(maxDurationSec) || STORY_MAX_DURATION_STORY_SEC))
    );
    const currentSec = readMp4DurationSec(bytes);
    if (!currentSec || currentSec <= safeMaxSec + 0.05) {
        return bytes;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const moov = iterMp4Boxes(bytes, 0, bytes.byteLength).find(b => b.type === "moov");
    if (!moov) return bytes;

    let videoInfo = null;
    for (const trak of iterMp4Boxes(bytes, moov.dataStart, moov.end).filter(b => b.type === "trak")) {
        const trakChildren = iterMp4Boxes(bytes, trak.dataStart, trak.end);
        const tkhd = trakChildren.find(b => b.type === "tkhd");
        const mdia = trakChildren.find(b => b.type === "mdia");
        if (!tkhd || !mdia) continue;
        const mdiaChildren = iterMp4Boxes(bytes, mdia.dataStart, mdia.end);
        const hdlr = mdiaChildren.find(b => b.type === "hdlr");
        if (!hdlr || hdlr.end - hdlr.dataStart < 12) continue;
        if (readFourCC(bytes, hdlr.dataStart + 8) !== "vide") continue;

        const mdhd = mdiaChildren.find(b => b.type === "mdhd");
        const minf = mdiaChildren.find(b => b.type === "minf");
        if (!mdhd || !minf) continue;
        const stbl = iterMp4Boxes(bytes, minf.dataStart, minf.end).find(b => b.type === "stbl");
        if (!stbl) continue;
        const stblChildren = iterMp4Boxes(bytes, stbl.dataStart, stbl.end);
        const stsd = stblChildren.find(b => b.type === "stsd");
        const stsz = stblChildren.find(b => b.type === "stsz");
        const stco = stblChildren.find(b => b.type === "stco");
        if (!stsd || !stsz || !stco) continue;

        const avc1 = iterMp4Boxes(bytes, stsd.dataStart + 8, stsd.end).find(b => b.type === "avc1");
        if (!avc1) continue;

        const width = (view.getUint32(tkhd.dataStart + 76, false) >>> 16) || STORY_VIDEO_WIDTH;
        const height = (view.getUint32(tkhd.dataStart + 80, false) >>> 16) || STORY_VIDEO_HEIGHT;
        const videoTimescale = view.getUint32(mdhd.dataStart + 12, false) || (STORY_VIDEO_FPS * 1000);
        const fixedSampleSize = view.getUint32(stsz.dataStart + 4, false);
        const firstSampleSize = fixedSampleSize || view.getUint32(stsz.dataStart + 12, false);
        const firstChunkOffset = view.getUint32(stco.dataStart + 8, false);
        if (!firstSampleSize || firstChunkOffset + firstSampleSize > bytes.byteLength) continue;

        videoInfo = {
            width,
            height,
            videoTimescale,
            avc1BoxBytes: bytes.slice(avc1.start, avc1.end),
            idrSample: bytes.slice(firstChunkOffset, firstChunkOffset + firstSampleSize)
        };
        break;
    }

    if (!videoInfo) return bytes;

    const fps = Math.max(1, Math.round(videoInfo.videoTimescale / 1000)) || STORY_VIDEO_FPS;
    const totalVideoFrames = Math.max(fps * 3, Math.round(safeMaxSec * fps));
    const videoDelta = Math.round(videoInfo.videoTimescale / fps) || 1000;
    const videoDurationTicks = totalVideoFrames * videoDelta;
    const totalMbs = Math.ceil(videoInfo.width / 16) * Math.ceil(videoInfo.height / 16);

    const videoSamples = [videoInfo.idrSample];
    const videoDeltas = [videoDelta];
    for (let f = 1; f < totalVideoFrames; f += 1) {
        videoSamples.push(nalToAvccSample(buildPSkipNal(f, totalMbs)));
        videoDeltas.push(videoDelta);
    }

    const parsedAudio = extractMp4SoundTrack(bytes, safeMaxSec);
    const audioTrack = parsedAudio ? loopAudioTrackToDuration(parsedAudio, safeMaxSec) : null;

    return muxStoryMp4Tracks({
        width: videoInfo.width,
        height: videoInfo.height,
        videoTimescale: videoInfo.videoTimescale,
        videoDurationTicks,
        videoSampleEntryBox: videoInfo.avc1BoxBytes,
        videoSamples,
        videoDeltas,
        audioTrack,
        targetSec: safeMaxSec
    });
}
