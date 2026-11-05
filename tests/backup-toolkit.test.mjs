import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SKRIP = path.join(ROOT, "migrasi", "backup-penuh.sh");
const DOKUMEN = path.join(ROOT, "migrasi", "BACKUP-PENUH.md");
const VERIFIKASI = path.join(ROOT, "migrasi", "verify-restore.sql");
const FINGERPRINT = path.join(ROOT, "migrasi", "export-fingerprint.sql");

const baca = (p) => fs.readFileSync(p, "utf8");

/* Backup migrasi pernah dibuat dengan `pg_dump --schema=public` saja.
   Hasilnya: 60 tabel utuh tetapi SELURUH 25 akun pengguna hilang, dan tidak
   ada satu pun error yang muncul saat restore. Test di bawah mengunci dua
   hal: (1) auth wajib ikut, (2) restore berhenti pada error pertama.
   Ditambah satu hal ketiga: checksum isi baris TIDAK boleh masuk repo,
   karena repo ini publik dan baris `provider_credentials` memuat API key. */

const JENIS = [
    "tests/backup-toolkit.test.mjs",
    "migrasi/BACKUP-PENUH.md",
    "migrasi/CUTOVER-rvgioyenjgkprnssfpfr.md",
];

test("skrip backup ada dan bisa dieksekusi", () => {
    assert.ok(fs.existsSync(SKRIP), "migrasi/backup-penuh.sh harus ada");
    assert.ok(fs.statSync(SKRIP).mode & 0o100, "harus executable (chmod +x)");
});

test("sintaks bash valid", () => {
    const r = spawnSync("bash", ["-n", SKRIP], { encoding: "utf8" });
    assert.equal(r.status, 0, `bash -n gagal: ${r.stderr}`);
});

test("menolak jalan tanpa SRC/DST", () => {
    const r = spawnSync("bash", [SKRIP, "dump"], {
        encoding: "utf8",
        env: { ...process.env, SRC: "", DST: "" },
    });
    assert.equal(r.status, 1);
    assert.match(`${r.stdout}${r.stderr}`, /SRC belum diisi/);
});

test("menolak transaction pooler (port 6543)", () => {
    const r = spawnSync("bash", [SKRIP, "dump"], {
        encoding: "utf8",
        env: {
            ...process.env,
            SRC: "postgresql://postgres.x:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
            DST: "postgresql://postgres.y:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
        },
    });
    assert.equal(r.status, 1);
    assert.match(`${r.stdout}${r.stderr}`, /port 6543/);
});

test("menolak restore bila berkas auth belum ada", () => {
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "genz-"));
    const r = spawnSync("bash", [SKRIP, "restore"], {
        encoding: "utf8",
        env: {
            ...process.env,
            SRC: "postgresql://postgres.x:p@h:5432/postgres",
            DST: "postgresql://postgres.y:p@h:5432/postgres",
            DIR: tmp,
        },
    });
    assert.equal(r.status, 1);
    // Boleh berhenti lebih awal karena psql tidak tersedia; yang penting TIDAK
    // lanjut diam-diam ketika dump public/auth tidak ditemukan.
    assert.match(`${r.stdout}${r.stderr}`, /tidak ditemukan|tidak ada/);
});

test("dump auth diwajibkan, bukan opsional", () => {
    const isi = baca(SKRIP);
    assert.match(isi, /--table=auth\.users/, "harus men-dump auth.users");
    assert.match(isi, /--table=auth\.identities/, "harus men-dump auth.identities");
    assert.match(isi, /2_auth\.sql/);
    assert.match(isi, /\[ -s "\$F_AUTH" \]\s*\|\|\s*die/, "auth harus diperiksa sebelum restore");
});

test("restore berhenti pada error pertama (ON_ERROR_STOP)", () => {
    assert.match(baca(SKRIP), /ON_ERROR_STOP=1/);
});

test("urutan restore: pre → public → auth → storage → post", () => {
    const isi = baca(SKRIP);
    assert.match(isi, /for f in "\$F_PRE" "\$F_PUBLIC_CLEAN" "\$F_AUTH" "\$F_STORAGE" "\$F_POST"/,
        "auth harus setelah public (FK profiles → auth.users)");
});

test("restore memakai SATU sesi psql, bukan satu sesi per berkas", () => {
    /* `set session_replication_role = replica` hanya berlaku untuk sesi
       berjalan. Versi pertama skrip menjalankan psql per berkas, sehingga
       setting itu hilang sebelum data dimuat — trigger dan cek foreign key
       kembali aktif dan `2_auth.sql` ditolak oleh FK profiles -> auth.users.
       Kunci di sini: semua -f harus berada di satu pemanggilan psql. */
    const isi = baca(SKRIP);
    assert.match(isi, /args\+=\(-f "\$f"\)/, "berkas harus dikumpulkan ke satu array -f");
    assert.match(isi, /psql "\$DST" "\$\{args\[@\]\}"/, "psql dipanggil sekali dengan semua berkas");
    assert.match(isi, /--single-transaction/, "restore harus atomik");

    // Tidak boleh ada pemanggilan psql per-berkas di dalam loop restore.
    const blokRestore = isi.slice(isi.indexOf("do_restore()"), isi.indexOf("do_verify()"));
    const psqlPerBerkas = blokRestore.match(/psql "\$DST"\s+-v ON_ERROR_STOP=1\s+-q\s+-f/g) || [];
    assert.equal(psqlPerBerkas.length, 0, "jangan panggil psql terpisah per berkas");
});

test("dokumen Windows memakai satu perintah psql (bukan terpisah)", () => {
    /* Jalur PowerShell tanpa Git Bash menjelaskan hal yang sama: `-c "set ..."`
       yang berdiri sendiri tidak berpengaruh ke perintah berikutnya. */
    const t = baca(path.join(ROOT, "migrasi", "TUTORIAL-BACKUP.md"));
    assert.match(t, /psql \$DST -c "set session_replication_role = replica;".*-f 1_public\.sql/,
        "harus satu baris: -c replica + semua -f dalam satu pemanggilan");
    assert.match(t, /satu sesi/i);
});

test("dump dibersihkan dari CREATE SCHEMA public", () => {
    // Tanpa ini restore selalu gagal di baris pertama: skema public sudah ada
    // di project target.
    assert.match(baca(SKRIP), /grep -v -E .*CREATE SCHEMA public/);
});

test("verify-restore.sql mencakup 60 tabel dengan total 4449 baris", () => {
    const sql = baca(VERIFIKASI);
    // Ambil hanya blok harapan pertama (baris per tabel), bukan blok ringkasan.
    const blok = [...sql.matchAll(/\('([a-z_]+)',(\d+)\)/g)].map((m) => [m[1], Number(m[2])]);
    const unik = new Map(blok);
    assert.equal(unik.size, 60, `harus 60 tabel unik, dapat ${unik.size}`);
    const total = [...unik.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 4449, "total baris public harus 4449");
    assert.match(sql, /tabel_pass/, "harus ada ringkasan");
    assert.match(sql, /'60'/);
});

test("berkas ter-commit TIDAK memuat checksum isi baris (repo publik)", () => {
    /* md5 isi baris dari provider_credentials / free_credit_secret_config
       setara membocorkan verifier kredensial yang bisa di-brute-force
       offline. Checksum itu hanya boleh hidup di supabase/backup/. */
    for (const rel of JENIS) {
        const isi = baca(path.join(ROOT, rel));
        const md5 = isi.match(/\b[0-9a-f]{32}\b/g) || [];
        assert.deepEqual(md5, [], `${rel} memuat md5 checksum: ${md5.join(", ")}`);
    }
});

test("supabase/backup/ tetap di .gitignore (menampung checksum + PII)", () => {
    const gi = baca(path.join(ROOT, ".gitignore"));
    assert.match(gi, /^supabase\/backup\/$/m);
});

test("export-fingerprint.sql memperingatkan hasilnya rahasia", () => {
    const sql = baca(FINGERPRINT);
    assert.match(sql, /RAHASIA/i);
    assert.match(sql, /provider_credentials/);
    assert.match(sql, /JANGAN/);
});

test("dokumen menjelaskan auth wajib, port pooler, dan urutan deploy", () => {
    const d = baca(DOKUMEN);
    assert.match(d, /auth\.users/);
    assert.match(d, /akun pengguna hilang|tanpa akun/);
    assert.match(d, /5432/);
    assert.match(d, /6543/);
    assert.match(d, /merge PR #330|Deploy sebelum A–D/i);
});

test("perintah winget memakai ID paket lengkap", () => {
    /* `winget install PostgreSQL.17` dijawab "No package found matching input
       criteria" karena winget butuh ID penuh PostgreSQL.PostgreSQL.17.
       Kesalahan satu kata ini sempat dikirim ke pengguna. */
    const t = baca(path.join(ROOT, "migrasi", "TUTORIAL-BACKUP.md"));
    assert.match(t, /winget install --id PostgreSQL\.PostgreSQL\.17 -e/);
    assert.doesNotMatch(t, /winget install PostgreSQL\.17(?!\S)/, "jangan pakai nama paket pendek");
});

test("tutorial memberi jalan keluar bila pg_dump tidak dikenali (PATH)", () => {
    const t = baca(path.join(ROOT, "migrasi", "TUTORIAL-BACKUP.md"));
    assert.match(t, /tidak dikenali padahal instalasi berhasil/);
    assert.ok(t.includes("C:\\Program Files\\PostgreSQL\\17\\bin"), "harus menyebut lokasi bin");
    assert.ok(t.includes("Get-ChildItem"), "harus menyuruh mencari versi yang benar");
});

const PS1 = path.join(ROOT, "migrasi", "backup-penuh.ps1");

test("versi PowerShell tersedia dan setara fungsinya dengan versi bash", () => {
    assert.ok(fs.existsSync(PS1), "migrasi/backup-penuh.ps1 harus ada");
    const ps = baca(PS1);
    for (const mode of ["dump", "restore", "verify"]) {
        assert.match(ps, new RegExp(`'${mode}'`), `mode ${mode} harus ada`);
    }
    // Auth tetap wajib, dengan ambang ukuran sebagai pengaman.
    assert.match(ps, /--table=auth\.users/);
    assert.match(ps, /--table=auth\.identities/);
    assert.match(ps, /ukuranAuth -lt 2000/);
    // Satu sesi + satu transaksi, dan begin/commit TIDAK boleh ada.
    assert.match(ps, /--single-transaction/);
    assert.match(ps, /ON_ERROR_STOP=1/);
    assert.doesNotMatch(ps, /^begin;$/m, "jangan pakai begin; di berkas restore");
    assert.doesNotMatch(ps, /^commit;$/m, "jangan pakai commit; di berkas restore");
});

test("versi PowerShell meng-encode password di connection string", () => {
    /* Password dengan @ : / # memutus parsing URL. Versi bash gagal di kasus
       ini; versi PowerShell menutupnya, dan itu harus tetap begitu. */
    const ps = baca(PS1);
    assert.match(ps, /EscapeDataString/);
    assert.ok(ps.includes("[YOUR-PASSWORD]"), "harus menolak placeholder yang belum diganti");
});

test("versi PowerShell mencari pg_dump/psql sendiri (PATH tidak diwarisi)", () => {
    const ps = baca(PS1);
    assert.match(ps, /Get-Command \$nama/);
    assert.match(ps, /Program Files\\PostgreSQL/);
});

test("versi bash tidak lagi menulis begin;/commit; di berkas restore", () => {
    /* begin; hanya menghasilkan WARNING di dalam --single-transaction, tetapi
       commit; MENUTUP transaksi lebih awal sehingga kegagalan berikutnya tidak
       membatalkan apa pun — janji "gagal = target kosong" jadi bohong. */
    const sh = baca(SKRIP);
    const isiPre = (sh.match(/cat > "\$F_PRE" <<'SQL'\n([\s\S]*?)\nSQL/) || [])[1] || "";
    const isiPost = (sh.match(/cat > "\$F_POST" <<'SQL'\n([\s\S]*?)\nSQL/) || [])[1] || "";
    assert.doesNotMatch(isiPre, /^begin;/m, "F_PRE tidak boleh punya begin;");
    assert.doesNotMatch(isiPost, /^commit;/m, "F_POST tidak boleh punya commit;");
});

/* ---- Kekakuan yang mencegah skrip .ps1 gagal di-parse di Windows ----
   Percobaan pertama gagal di PowerShell 5.1 karena here-string ter-indentasi
   (penutup '@ wajib di kolom 0) dan karakter non-ASCII (5.1 membaca .ps1
   sebagai ANSI, sehingga em-dash/panah rusak). Test di bawah menutup kedua
   kelas kesalahan itu, plus BOM yang membuat psql menolak baris pertama. */

function tanpaKomentar(teks) {
    return teks
        .replace(/<#[\s\S]*?#>/g, "")   // komentar blok
        .replace(/^\s*#.*$/gm, "");     // komentar baris
}

test("skrip .ps1 hanya berisi ASCII (PowerShell 5.1 membaca sebagai ANSI)", () => {
    const isi = baca(PS1);
    const bukanAscii = [...isi].filter((c) => c.charCodeAt(0) > 127);
    assert.deepEqual(bukanAscii, [],
        `karakter non-ASCII membuat skrip rusak di PS 5.1: ${JSON.stringify(bukanAscii.join(""))}`);
});

test("skrip .ps1 tidak memakai here-string (penutup wajib kolom 0)", () => {
    const kode = tanpaKomentar(baca(PS1));
    assert.doesNotMatch(kode, /@'\s*$/m, "here-string @' tidak boleh dipakai");
    assert.doesNotMatch(kode, /^'@/m, "penutup here-string '@ tidak boleh dipakai");
});

test("skrip .ps1 tidak diawali BOM (psql menolak baris pertama)", () => {
    const buf = fs.readFileSync(PS1);
    assert.notDeepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], "berkas tidak boleh berawalan BOM");
});

test("skrip .ps1 menyeimbangkan kurung kurawal dan kurung biasa", () => {
    const kode = tanpaKomentar(baca(PS1));
    const hitung = (c) => (kode.match(new RegExp(`\\${c}`, "g")) || []).length;
    assert.equal(hitung("{"), hitung("}"), "kurung kurawal tidak seimbang");
    assert.equal(hitung("("), hitung(")"), "kurung biasa tidak seimbang");
});

test("skrip .ps1 menulis SQL sebagai UTF-8 tanpa BOM", () => {
    const ps = baca(PS1);
    assert.match(ps, /New-Object System\.Text\.UTF8Encoding\(\$false\)/, "harus UTF8Encoding($false)");
    /* Set-Content -Encoding utf8 pada PS 5.1 menambahkan BOM. */
    assert.doesNotMatch(tanpaKomentar(ps), /Set-Content[^\n]*-Encoding\s+utf8/i,
        "jangan pakai Set-Content -Encoding utf8 untuk berkas .sql");
});

test("skrip .ps1 menerima alamat lewat $env:SRC (variabel tidak diwarisi -File)", () => {
    /* `powershell -File` membuat proses BARU dengan sesi bersih: $SRC yang
       diisi di jendela sebelah tidak ikut. Kalau skrip hanya membaca $SRC,
       pengguna selalu mendapat "variabel belum diisi" padahal sudah mengisi.
       Environment variable diwarisi proses anak, jadi harus didukung. */
    const ps = baca(PS1);
    assert.match(ps, /\$env:SRC/, "harus membaca $env:SRC");
    assert.match(ps, /\$env:DST/, "harus membaca $env:DST");
    assert.match(ps, /\[string\]\$Src/, "harus punya parameter -Src");
    assert.match(ps, /\[string\]\$Dst/, "harus punya parameter -Dst");
    // Tidak boleh lagi hanya bergantung pada $SRC/$DST.
    assert.doesNotMatch(tanpaKomentar(ps), /if \(-not \$SRC\)/, "jangan hanya cek $SRC");
});
