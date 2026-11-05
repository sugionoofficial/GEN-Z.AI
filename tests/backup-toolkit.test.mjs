import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
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
    /* Isi string harus dibuang dulu: format string seperti "{0} baris" dan
       regex '\$\$;' memuat kurung yang bukan penanda blok. */
    const kode = tanpaKomentar(baca(PS1))
        .replace(/'[^'\n]*'/g, "''")
        .replace(/"[^"\n]*"/g, '""');
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

test("ringkasan ukuran tidak menampilkan berkas kecil sebagai 0 KB", () => {
    /* [int] membulatkan ke bawah: berkas 700 byte tampil "0 KB" dan terlihat
       gagal padahal normal (pembungkus restore memang kecil). */
    const ps = baca(PS1);
    assert.doesNotMatch(ps, /\[int\]\(\(Get-Item \$f\)\.Length \/ 1KB\)/,
        "jangan membulatkan ukuran dengan [int]");
    assert.match(ps, /N1/, "pakai satu angka desimal");
    assert.match(ps, /\(kosong, normal untuk pembungkus\)/, "tandai berkas kosong secara eksplisit");
});

test("dump memverifikasi blok COPY di berkas auth", () => {
    /* Ukuran saja tidak cukup: berkas bisa besar tetapi berisi komentar saja
       (COPY tidak ada) ketika tidak ada user. Hitung blok COPY langsung. */
    const ps = baca(PS1);
    assert.match(ps, /Select-String -Pattern '\^COPY '/);
    assert.match(ps, /barisCopy -lt 1/, "harus berhenti bila tidak ada blok COPY");
});

test("tutorial memberi tahu bedanya error SQL Editor vs terminal", () => {
    /* Pengguna menempelkan `cd $HOME\Desktop\genz-migrasi` ke SQL Editor dan
       mendapat `ERROR: 42601: syntax error at or near "cd"`. Panduan harus
       menautkan gejala itu ke penyebabnya, bukan hanya melarang. */
    const t = baca(path.join(ROOT, "migrasi", "TUTORIAL-BACKUP.md"));
    assert.match(t, /syntax error at or near/);
    assert.ok(t.includes("cd $HOME"), "harus memakai contoh nyata yang dilaporkan");
    assert.match(t, /Kesalahan yang paling sering terjadi/);
});

test("tutorial memisahkan cek pra-restore (SQL) dari restore (terminal)", () => {
    const t = baca(path.join(ROOT, "migrasi", "TUTORIAL-BACKUP.md"));
    assert.match(t, /select count\(\*\) as jumlah_tabel from pg_tables/);
    assert.match(t, /### 5a\./);
    assert.match(t, /### 5b\./);
});

test("skrip .ps1 menetralkan fungsi platform Supabase sebelum restore", () => {
    /* Restore berhenti dengan:
         ERROR: function "rls_auto_enable" already exists with same argument types
       Penyebabnya fungsi public.rls_auto_enable() milik Supabase (event trigger
       ensure_rls) yang SELALU ada di project baru, sementara dump ikut
       membawanya. Ini bukan data pengguna, jadi aman dinetralkan. */
    const ps = baca(PS1);
    assert.ok(ps.includes("rls_auto_enable"), "harus mengenali nama fungsi platform");
    assert.match(ps, /Remove-DdlPlatform/, "dump harus dibersihkan dari DDL fungsi platform");
    /* Strategi yang BENAR adalah tidak menyalin, bukan men-drop di target.
       Men-drop lebih dulu membuat baris ALTER FUNCTION dari dump gagal dengan
       'function does not exist'. */
    assert.doesNotMatch(ps, /drop function if exists/i,
        "jangan drop fungsi platform: ALTER FUNCTION dari dump akan gagal");
});

test("pembersihan DDL platform berhenti bila pola tidak cocok", () => {
    /* Kalau penutup $$; tidak ditemukan, skrip berisiko memotong sisa berkas
       secara diam-diam dan menghasilkan dump cacat yang tetap 'berhasil'.
       Harus berhenti terang-terangan. */
    const ps = baca(PS1);
    assert.match(ps, /dilewati -gt 400/);
    assert.match(ps, /jangan restore dump ini/);
});

test("skrip .ps1 tetap ASCII murni setelah penambahan preamble", () => {
    const isi = baca(PS1);
    const bukanAscii = [...isi].filter((c) => c.charCodeAt(0) > 127);
    assert.deepEqual(bukanAscii, [], `non-ASCII: ${JSON.stringify(bukanAscii.join(""))}`);
    const buf = fs.readFileSync(PS1);
    assert.notDeepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], "tidak boleh berawalan BOM");
});

test("DDL platform yang dibuang mencakup event trigger", () => {
    /* Event trigger Supabase (ensure_rls, pgrst_ddl_watch, issue_*) semuanya
       milik platform dan sudah ada di target. Sumbernya memuat 7 event
       trigger; menyalinnya hanya menghasilkan 'already exists'. */
    for (const [nama, berkas] of [["ps1", PS1], ["sh", SKRIP]]) {
        const isi = baca(berkas);
        assert.match(isi, /EVENT TRIGGER/, `${nama} harus membuang CREATE EVENT TRIGGER`);
    }
});

test("versi bash ikut membersihkan DDL platform", () => {
    const sh = baca(SKRIP);
    assert.match(sh, /strip_ddl_platform/);
    assert.match(sh, /FUNGSI_PLATFORM='rls_auto_enable'/);
    assert.match(sh, /strip_ddl_platform > "\$F_PUBLIC_CLEAN"/);
});

test("path folder ditampilkan (operator + hanya menggabung string, bukan interpolasi)", () => {
    /* 'Isi folder: ' + $Dir di dalam Ok(...) mencetak kosong: yang sampai ke
       Ok hanyalah argumen kedua, karena + dianggap parameter tambahan. */
    const ps = baca(PS1);
    assert.match(ps, /Ok "Isi folder: \$Dir"/, "harus memakai string ber-interpolasi");
    assert.doesNotMatch(ps, /Ok 'Isi folder: ' \+ \$Dir/, "jangan pakai operator + di dalam Ok(...)");
});

test("dump memisahkan skema public dari datanya", () => {
    /* Restore berhenti dengan:
         ERROR: insert or update on table "credit_transactions" violates
                foreign key constraint "credit_transactions_created_by_fkey"
       Sebabnya FK public -> auth.users diperiksa saat INSERT, sementara data
       public dimuat sebelum auth.users ada. Solusinya memisahkan data. */
    for (const [nama, berkas] of [["ps1", PS1], ["sh", SKRIP]]) {
        const isi = baca(berkas);
        assert.ok(isi.includes("1b_public_data.sql"), `${nama} harus punya berkas data public`);
    }
    assert.match(baca(PS1), /Split-SchemaData/);
    assert.match(baca(SKRIP), /split_schema_data/);
});

test("urutan restore: skema public -> auth -> data public", () => {
    /* Inilah inti perbaikan. Kalau urutan ini berubah, FK akan menolak lagi. */
    const ps = baca(PS1);
    assert.match(ps, /\$FPre, \$FPubClean, \$FAuth, \$FPubData, \$FStorage, \$FPost/,
        "urutan ps1 salah");
    const sh = baca(SKRIP);
    assert.match(sh, /"\$F_PRE" "\$F_PUBLIC_CLEAN" "\$F_AUTH" "\$F_PUBLIC_DATA" "\$F_STORAGE" "\$F_POST"/,
        "urutan sh salah");
});

test("pemisah data menangani blok COPY beserta penutupnya", () => {
    /* Diuji langsung dengan dump sintetis: DDL tetap di skema, blok COPY
       beserta semua barisnya pindah ke data, dan baris penutup \\. ikut. */
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "split-"));
    const src = path.join(tmp, "in.sql");
    fs.writeFileSync(src, [
        "SET statement_timeout = 0;",
        "CREATE TABLE public.t (id int);",
        "COPY public.t (id) FROM stdin;",
        "1", "2", "\\.",
        "CREATE INDEX i ON public.t (id);",
    ].join("\n"));
    const fn = execFileSync("bash", ["-c",
        `source <(sed -n '/^split_schema_data()/,/^}/p' "${SKRIP}"); ` +
        `cd "${tmp}"; split_schema_data skema.sql data.sql < in.sql; ` +
        `echo "---SKEMA---"; cat skema.sql; echo "---DATA---"; cat data.sql`
    ], { encoding: "utf8" });

    assert.match(fn, /CREATE TABLE public\.t \(id int\);/);
    assert.match(fn, /CREATE INDEX i ON public\.t \(id\);/);
    const skema = fn.split("---SKEMA---")[1].split("---DATA---")[0];
    const data = fn.split("---DATA---")[1];
    assert.doesNotMatch(skema, /^COPY /m, "COPY tidak boleh tertinggal di skema");
    assert.match(data, /^COPY public\.t \(id\) FROM stdin;$/m);
    assert.match(data, /^\\\.$/m, "baris penutup COPY harus ikut");
    assert.match(data, /^2$/m, "isi baris harus ikut");
});

test("verify-restore.sql hanya berisi SATU statement", () => {
    /* SQL Editor Supabase hanya menampilkan hasil query TERAKHIR. Versi
       sebelumnya memakai tiga query terpisah; pengguna hanya melihat hasil
       3/3 (jumlah fungsi) dan mengira 60 tabel tidak terperiksa. */
    const sql = baca(VERIFIKASI);
    const titikKoma = (sql.match(/;/g) || []).length;
    assert.equal(titikKoma, 1, `harus tepat satu statement, dapat ${titikKoma} titik koma`);
    assert.match(sql, /order by no;\s*$/);
});

test("verify-restore.sql memberi status OK / PERIKSA per baris", () => {
    /* Pengguna tidak perlu mencocokkan angka dengan mata; setiap baris
       menilai dirinya sendiri. */
    const sql = baca(VERIFIKASI);
    assert.match(sql, /'OK'/);
    assert.match(sql, /'PERIKSA'/);
    assert.match(sql, /tabel_bermasalah/, "harus menyebut nama tabel yang gagal");
});

const PERBAIKI_GRANT = path.join(ROOT, "migrasi", "perbaiki-grant.sql");

test("dump TIDAK membuang GRANT (--no-privileges dilarang)", () => {
    /* Dengan --no-privileges, role anon/authenticated/service_role kehilangan
       hak akses di project tujuan. PostgREST lalu menjawab 404
       "Could not find the table in the schema cache" walau tabelnya ada dan
       berisi. Ini terjadi pada pengguna: login sukses, tetapi profil gagal
       dibaca. --no-owner tetap dipakai (kepemilikan objek tidak boleh ikut). */
    for (const [nama, berkas] of [["ps1", PS1], ["sh", SKRIP]]) {
        const isi = baca(berkas);
        // Larangan hanya untuk dump schema=public, yaitu satu-satunya dump yang
        // di-restore. Dump referensi auth boleh memakai apa pun (tidak dipakai).
        const barisPublic = isi.split("\n").filter((l) => {
            const t = l.trim();
            if (t.startsWith("#")) return false; // komentar bukan perintah
            return /schema=public/.test(t) && /pg_dump|\$pgDump/.test(t);
        });
        assert.ok(barisPublic.length > 0, `${nama}: harus ada dump schema=public`);
        for (const baris of barisPublic) {
            assert.doesNotMatch(baris, /--no-privileges/,
                `${nama}: dump public tidak boleh memakai --no-privileges -> ${baris.trim()}`);
            assert.match(baris, /--no-owner/, `${nama}: harus tetap --no-owner`);
        }
    }
});

test("perbaiki-grant.sql memberi hak ke ketiga role + default privileges", () => {
    const sql = baca(PERBAIKI_GRANT);
    for (const role of ["anon", "authenticated", "service_role"]) {
        assert.match(sql, new RegExp(role), `harus menyebut role ${role}`);
    }
    assert.match(sql, /grant usage on schema public/i);
    assert.match(sql, /on all tables in schema public/i);
    assert.match(sql, /on all sequences in schema public/i);
    assert.match(sql, /on all functions in schema public/i);
    assert.match(sql, /alter default privileges/i, "tabel baru harus mewarisi hak");
    assert.match(sql, /has_table_privilege/, "harus bisa diverifikasi");
});

test("restore TIDAK memakai session_replication_role = replica", () => {
    /* replica mematikan SEMUA trigger pengguna, termasuk trigger DDL Supabase
       (pgrst_ddl_watch) yang menyegarkan cache skema PostgREST. Akibatnya
       Data API menjawab PGRST205 "Could not find the table in the schema
       cache" walau tabelnya ada dan GRANT-nya benar. Urutan skema -> auth ->
       data sudah membuat FK terpenuhi tanpa trik ini. */
    for (const [nama, berkas] of [["ps1", PS1], ["sh", SKRIP]]) {
        const isi = baca(berkas);
        const barisSet = isi.split("\n").filter((l) =>
            /^\s*('|")?\s*set session_replication_role\s*=\s*(replica|origin)/i.test(l)
            || /^\s*set session_replication_role\s*=\s*(replica|origin)/i.test(l.replace(/^'/g, "")));
        assert.deepEqual(barisSet, [], `${nama}: tidak boleh menyetel session_replication_role -> ${barisSet.join(" | ")}`);
    }
});

test("restore menyegarkan cache skema PostgREST (notify pgrst)", () => {
    for (const [nama, berkas] of [["ps1", PS1], ["sh", SKRIP]]) {
        const isi = baca(berkas);
        assert.match(isi, /notify pgrst, 'reload schema'/, `${nama} harus notify reload schema`);
    }
});

test("perbaiki-grant.sql juga menyegarkan cache PostgREST", () => {
    const sql = baca(PERBAIKI_GRANT);
    assert.match(sql, /notify pgrst, 'reload schema'/);
    assert.match(sql, /notify pgrst, 'reload config'/);
    assert.match(sql, /PGRST205/, "harus menyebut gejala yang ditangani");
});

const PERBAIKI_STORAGE = path.join(ROOT, "migrasi", "perbaiki-storage-rls.sql");
const MIGRATE_BULK = path.join(ROOT, "migrasi", "migrate_bulk.mjs");

test("perbaiki-storage-rls.sql mengembalikan 18 kebijakan storage.objects", () => {
    const sql = baca(PERBAIKI_STORAGE);
    const dibuat = sql.match(/create policy /gi) || [];
    assert.equal(dibuat.length, 18, "harus ada 18 create policy, sama dengan proyek sumber");
    // Kebijakan paling penting: tanpa ini berkas privat user tidak terbaca.
    assert.match(sql, /Users read own media uploads/);
    assert.match(sql, /Users read own media uploads"\s+on storage\.objects for select\s+to authenticated\s+using \(\(bucket_id = 'user-uploads'::text\) AND user_owns_media_path\(name\)\)/);
    assert.match(sql, /dashboard videos public read/);
    // Semua drop-if-exists supaya aman dijalankan berulang.
    const drop = sql.match(/drop policy if exists/gi) || [];
    assert.equal(drop.length, dibuat.length, "setiap create policy harus didahului drop if exists");
});

test("migrate_bulk.mjs menelusuri subfolder (object/list tidak rekursif)", () => {
    /* Semua berkas GEN-Z.AI ada di dalam folder. `object/list` hanya
       mengembalikan satu tingkat, sehingga versi lama melaporkan "0 objek"
       dan Fase B selesai tanpa memindahkan apa pun. */
    const isi = baca(MIGRATE_BULK);
    assert.match(isi, /listDeep/, "harus ada penelusuran folder rekursif");
    assert.match(isi, /FOLDER/, "folder ditandai id nol");
    assert.match(isi, /manifest\.length === 0/, "harus berhenti bila tidak ada objek");
});
