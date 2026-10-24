#!/usr/bin/env node
// =====================================================================
// migrate_bulk.mjs (v2 — mandiri) — migrasi file STORAGE GEN-Z.AI
// Proyek LAMA : boeamhglmvkatnycluaa (ap-southeast-2)
// Proyek BARU : ycovbqmezhrvzobxqnyp (ap-southeast-1)
//
// Skema + data tabel sudah dipindah dengan pg_dump/psql (lihat RECOVERY.md).
// Skrip ini HANYA memindah storage: 7 bucket + semua objek (±380 MB),
// diambil langsung dari Storage API proyek lama (tidak butuh file data apa pun).
//
// Syarat   : Node.js >= 18. Jalankan di folder tempat storage_objects_meta.csv berada.
// Env WAJIB: OLD_SERVICE_KEY = secret/service_role key proyek LAMA (dashboard lama)
//            NEW_SERVICE_KEY = secret key proyek BARU (sb_secret_...)
// Env ops. : OLD_URL, NEW_URL (sudah default benar), META_CSV (default ./storage_objects_meta.csv)
//
// Pakai    : node migrate_bulk.mjs
// * Bisa di-resume: jalankan ulang perintah yang sama bila ada yang gagal.
// * Hasil  : storage_fixup.sql → jalankan ke proyek baru (perintah di RECOVERY.md).
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';

const OLD_URL = (process.env.OLD_URL || 'https://boeamhglmvkatnycluaa.supabase.co').replace(/\/+$/, '');
const NEW_URL = (process.env.NEW_URL || 'https://ycovbqmezhrvzobxqnyp.supabase.co').replace(/\/+$/, '');
const OLD_KEY = process.env.OLD_SERVICE_KEY || '';
const NEW_KEY = process.env.NEW_SERVICE_KEY || '';
const META_CSV = process.env.META_CSV || path.join(process.cwd(), 'storage_objects_meta.csv');
const PROGRESS_FILE = path.join(process.cwd(), '.bulk_progress.json');
const FIXUP_FILE = path.join(process.cwd(), 'storage_fixup.sql');

const die = (m) => { console.error('\n[ERR] ' + m); process.exit(1); };
const warn = (m) => console.warn('[!] ' + m);
const authHeaders = (key, extra = {}) => ({ apikey: key, Authorization: 'Bearer ' + key, ...extra });
const encPath = (b, n) => encodeURIComponent(b) + '/' + n.split('/').map(encodeURIComponent).join('/');

function sqlVal(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return "E'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + "'";
}

async function fetchRetry(url, opts = {}, tries = 4) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status >= 500 || res.status === 429) throw new Error('HTTP ' + res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300));
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries) { const w = i * i * 1500; warn('retry ' + i + '/' + (tries - 1) + ' dalam ' + w + 'ms — ' + String(e.message || e).slice(0, 140)); await new Promise(r => setTimeout(r, w)); }
    }
  }
  throw lastErr;
}

function parseCsv(text) {
  const rows = []; let row = [], f = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inQ = false; } else f += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { uploaded: {} }; } }
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 1)); }

async function main() {
  if (!OLD_KEY) die('OLD_SERVICE_KEY wajib (dashboard LAMA > Project Settings > API Keys > secret/service_role).');
  if (!NEW_KEY) die('NEW_SERVICE_KEY wajib (dashboard BARU > Project Settings > API Keys > secret).');
  console.log('OLD_URL = ' + OLD_URL); console.log('NEW_URL = ' + NEW_URL);

  // 1) bucket: daftar dari lama, pastikan ada di baru
  const oldBuckets = await (await fetchRetry(`${OLD_URL}/storage/v1/bucket`, { headers: authHeaders(OLD_KEY) })).json();
  const newBuckets = new Set((await (await fetchRetry(`${NEW_URL}/storage/v1/bucket`, { headers: authHeaders(NEW_KEY) })).json()).map(b => b.id));
  for (const b of oldBuckets) {
    if (newBuckets.has(b.id)) continue;
    warn(`bucket ${b.id} belum ada di proyek baru — membuat via Storage API`);
    await fetchRetry(`${NEW_URL}/storage/v1/bucket`, { method: 'POST', headers: authHeaders(NEW_KEY, { 'Content-Type': 'application/json' }), body: JSON.stringify({ id: b.id, name: b.name, public: !!b.public, file_size_limit: b.file_size_limit ?? undefined, allowed_mime_types: b.allowed_mime_types ?? undefined }) });
    console.log(`  [OK] bucket ${b.id} dibuat`);
  }
  console.log(`Bucket: ${oldBuckets.length} di lama, ${newBuckets.size} sudah ada di baru.`);

  // 2) daftar objek per bucket (dari API lama)
  const manifest = [];
  for (const b of oldBuckets) {
    const res = await fetchRetry(`${OLD_URL}/storage/v1/object/list/${encodeURIComponent(b.id)}`, { method: 'POST', headers: authHeaders(OLD_KEY, { 'Content-Type': 'application/json' }), body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'name', order: 'asc' } }) });
    const entries = await res.json();
    if (!Array.isArray(entries)) throw new Error(`list ${b.id} gagal: ` + JSON.stringify(entries).slice(0, 200));
    if (entries.length >= 1000) warn(`bucket ${b.id}: >=1000 objek — skrip ini hanya mengambil 1000 pertama (hubungi agen)`);
    for (const o of entries) manifest.push({ bucket_id: b.id, name: o.name, size: o.metadata?.size, mimetype: o.metadata?.mimetype, cacheControl: o.metadata?.cacheControl, created_at: o.created_at, updated_at: o.updated_at });
    console.log(`  ${b.id}: ${entries.length} objek`);
  }
  const totalBytes = manifest.reduce((s, o) => s + (o.size || 0), 0);
  console.log(`Total: ${manifest.length} objek, ±${(totalBytes / 1e6).toFixed(1)} MB`);

  // 3) unduh dari lama -> upload ke baru (resume-able)
  const progress = loadProgress();
  let ok = 0, skip = 0; const failures = []; let i = 0;
  for (const o of manifest) {
    i++;
    const key = o.bucket_id + '/' + o.name;
    if (progress.uploaded[key]) { skip++; continue; }
    const label = `[${i}/${manifest.length}] ${key}`;
    try {
      const dl = await fetchRetry(`${OLD_URL}/storage/v1/object/${encPath(o.bucket_id, o.name)}`, { headers: authHeaders(OLD_KEY) });
      const buf = Buffer.from(await dl.arrayBuffer());
      if (typeof o.size === 'number' && buf.length !== o.size) throw new Error(`ukuran ${buf.length} != metadata ${o.size}`);
      await fetchRetry(`${NEW_URL}/storage/v1/object/${encPath(o.bucket_id, o.name)}`, { method: 'POST', headers: authHeaders(NEW_KEY, { 'Content-Type': o.mimetype || 'application/octet-stream', 'Cache-Control': o.cacheControl || 'max-age=3600', 'x-upsert': 'true' }), body: buf });
      progress.uploaded[key] = buf.length; saveProgress(progress); ok++;
      console.log(`  [OK] ${label} (${buf.length} B)`);
    } catch (e) { failures.push({ key, err: String(e.message || e).slice(0, 180) }); console.error(`  [GAGAL] ${label}: ${String(e.message || e).slice(0, 180)}`); }
  }

  // 4) storage_fixup.sql — pulihkan owner/timestamp asli
  const ownerMap = new Map();
  let haveCsv = false;
  if (fs.existsSync(META_CSV)) {
    haveCsv = true;
    const rows = parseCsv(fs.readFileSync(META_CSV, 'utf8'));
    const hdr = rows.shift() || [];
    const ix = Object.fromEntries(hdr.map((h, n) => [h.trim(), n]));
    for (const r of rows) ownerMap.set(r[ix.bucket_id] + '/' + r[ix.name], { owner: r[ix.owner] || null, created_at: r[ix.created_at] || null, updated_at: r[ix.updated_at] || null });
    console.log(`META_CSV: ${ownerMap.size} baris owner/timestamp dimuat.`);
  } else {
    warn(`META_CSV tidak ditemukan (${META_CSV}) — owner objek TIDAK dipulihkan.`);
    console.log('  Buat dulu dengan psql (lihat RECOVERY.md langkah 2), lalu jalankan ulang skrip ini.');
  }
  const uploaded = manifest.filter(o => progress.uploaded[o.bucket_id + '/' + o.name]);
  const fx = [];
  fx.push('-- storage_fixup.sql — dibuat migrate_bulk.mjs v2 pada ' + new Date().toISOString());
  fx.push('-- Pulihkan owner/timestamp asli bucket + objek. Jalankan: psql "URL_BARU" -f storage_fixup.sql');
  fx.push('BEGIN;');
  for (const b of oldBuckets) fx.push(`UPDATE storage.buckets SET owner=${sqlVal(b.owner)}, owner_id=${sqlVal(b.owner_id)}, created_at=${sqlVal(b.created_at)}, updated_at=${sqlVal(b.updated_at)}, avif_autodetection=${sqlVal(b.avif_autodetection)} WHERE id=${sqlVal(b.id)};`);
  for (const o of uploaded) {
    const meta = ownerMap.get(o.bucket_id + '/' + o.name) || {};
    const own = haveCsv ? `, owner=${sqlVal(meta.owner)}` : '';
    fx.push(`UPDATE storage.objects SET created_at=${sqlVal(meta.created_at || o.created_at)}, updated_at=${sqlVal(meta.updated_at || o.updated_at)}${own} WHERE bucket_id=${sqlVal(o.bucket_id)} AND name=${sqlVal(o.name)};`);
  }
  fx.push('COMMIT;');
  fs.writeFileSync(FIXUP_FILE, fx.join('\n') + '\n');

  console.log(`\nRingkasan: ${ok} diupload, ${skip} dilewati (sudah pernah), ${failures.length} gagal.`);
  console.log(`[OK] ${FIXUP_FILE} ditulis (${oldBuckets.length} bucket + ${uploaded.length} objek).`);
  if (failures.length) { console.log('Objek gagal (jalankan ulang perintah yang sama untuk resume):'); for (const f of failures) console.log('  - ' + f.key + ' :: ' + f.err); process.exit(1); }
  console.log('\nSELESAI. Lanjut: psql "URL_BARU" -f storage_fixup.sql  (RECOVERY.md langkah 6)');
}

main().catch(e => die(String(e && e.message || e)));
