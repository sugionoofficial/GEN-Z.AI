import postgres from 'npm:postgres@3.4.5';

const PASS = 'GENZ-MIGRASI-2410';
const OLD_BASE = 'https://boeamhglmvkatnycluaa.supabase.co';
const CHUNK = 60;
const WIDE = { generation_history: 8, social_post_runs: 20, social_post_schedules: 20 };
const TABLES = ['auth.users','auth.identities','public.profiles','public.account_deletion_requests','public.credit_packages','public.credit_transactions','public.dashboard_videos','public.facebook_oauth_states','public.feature_credit_settings','public.feature_credit_transactions','public.hub_admin_settings','public.model_quota','public.models','public.provider_credentials','public.providers','public.site_announcements','public.social_characters','public.social_facebook_identities','public.social_outfits','public.social_page_connections','public.social_post_schedules','public.social_publisher_config','public.social_publisher_model_quotas','public.social_publisher_user_settings','public.studio_medsos_access','public.studio_medsos_pricing','public.support_agent_presence','public.support_conversations','public.support_messages','public.system_settings','public.topup_payment_methods','public.topup_payments','public.topup_requests','public.user_presence','public.kie_parameters','public.kie_workflows','public.kie_workflow_variants','public.kie_workflow_pricing','public.kie_workflow_models','public.kie_workflow_dependencies','public.kie_workflow_constraints','public.social_data_deletion_requests','public.tempmail_user_aliases','public.generation_history','public.social_post_runs','storage.buckets','supabase_migrations.schema_migrations'];
const SKIP_COLS = { 'auth.users': ['confirmed_at'], 'auth.identities': ['email'] };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encP = (b, n) => encodeURIComponent(b) + '/' + n.split('/').map(encodeURIComponent).join('/');

function hdrs(kind) {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Content-Type', kind + '; charset=utf-8');
  return h;
}
const htmlRes = (s) => new Response(s, { status: 200, headers: hdrs('text/html') });
const jsonRes = (o) => new Response(JSON.stringify(o), { status: 200, headers: hdrs('application/json') });

const CSS = `body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;line-height:1.6;color:#132a20}h1{font-size:22px}.ok{color:#0a7a4b;font-weight:700}.err{color:#b3261e;font-weight:700}pre{background:#0f172a;color:#d1fae5;padding:14px;border-radius:10px;max-height:46vh;overflow:auto;font-size:12.5px}input,textarea{width:100%;padding:10px;margin:6px 0;border:1px solid #cbd5d1;border-radius:8px;font-size:14px}button{background:#3ecf8e;border:0;padding:14px 26px;font-size:16px;font-weight:700;border-radius:10px;cursor:pointer;margin-top:10px}.spin{display:inline-block;width:16px;height:16px;border:3px solid #3ecf8e;border-top-color:transparent;border-radius:50%;animation:r 1s linear infinite;vertical-align:-3px}@keyframes r{to{transform:rotate(360deg)}}.warn{background:#fff7ed;border:1px solid #fdba74;padding:10px 14px;border-radius:10px}`;

function pageHtml(title, msgHtml, st, autogo) {
  const h = (k) => esc(st[k] || '');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="content-type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>\n<style>${CSS}</style></head><body>\n<h1>${esc(title)}</h1>${msgHtml}\n<form id="f" method="post">\n<input type="hidden" name="pass" value="${h('pass')}">\n<input type="hidden" name="oldconn" value="${h('oldconn')}">\n<input type="hidden" name="oldkey" value="${h('oldkey')}">\n<input type="hidden" name="phase" value="${h('phase')}">\n<input type="hidden" name="c1" value="${h('c1')}">\n<input type="hidden" name="c2" value="${h('c2')}">\n<textarea name="log" style="display:none">${h('log')}</textarea>\n${autogo ? '<button type="submit">LANJUTKAN \u25b6</button><p><span class="spin"></span> mengerjakan\u2026 halaman akan melanjutkan otomatis</p><script>setTimeout(()=>document.getElementById("f").submit(),400)</' + 'script>' : '<button type="submit">\ud83d\udd04 ULANGI LANGKAH INI</button>'}\n</form></body></html>`;
}

function formHtml() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="content-type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Migrator GEN-Z.AI</title>\n<style>${CSS}h1{font-size:24px}label{font-weight:600}</style></head><body>\n<h1>\ud83d\ude80 Migrator GEN-Z.AI \u2192 Proyek Baru</h1>\n<p>Isi 3 kolom lalu klik <b>MULAI MIGRASI</b>. Halaman akan berjalan sendiri sampai SELESAI (skema \u2192 48 tabel \u2192 71 file storage \u2192 finalisasi). <b>Jangan tutup tab.</b></p>\n<form method="post">\n<label>Kode akses</label><input name="pass" placeholder="kode dari agen Arena">\n<label>Koneksi DB LAMA (pooler)</label><input name="oldconn" value="postgresql://postgres.boeamhglmvkatnycluaa:PASSWORD_ANDA@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres">\n<label>Secret key proyek LAMA</label><input name="oldkey" placeholder="sb_secret_... / service_role lama">\n<input type="hidden" name="phase" value="schema"><input type="hidden" name="c1" value="0"><input type="hidden" name="c2" value="0"><textarea name="log" style="display:none"></textarea>\n<button type="submit">MULAI MIGRASI \u25b6</button>\n</form>\n<p class="warn">\u26a0\ufe0f Password di kolom koneksi adalah password DB proyek LAMA yang Anda reset di dashboard lama (huruf+angka saja). Data hanya mengalir lama\u2192baru; tidak ada yang dihapus di proyek lama.</p>\n</body></html>`;
}

function finish(st, o) {
  if (st.fmt === 'json') return jsonRes({ ok: o.type !== 'err', done: !!o.done, cont: o.type === 'ok' && !o.done, title: o.title || '', msg: o.msgText || '', counts: o.counts || null, phase: st.phase, c1: st.c1, c2: st.c2, log: st.log || '' });
  return htmlRes(pageHtml(o.title, o.msgHtml, st, o.autogo));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const h = new Headers();
    h.set('Access-Control-Allow-Origin', '*');
    h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'content-type, apikey, authorization');
    h.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: h });
  }
  if (req.method === 'GET') return htmlRes(formHtml());
  const fd = await req.formData();
  const st = Object.fromEntries(fd.entries());
  st.c1 = parseInt(st.c1 || '0', 10) || 0;
  st.c2 = parseInt(st.c2 || '0', 10) || 0;
  st.fmt = st.fmt === 'json' ? 'json' : '';
  const step = (s, t) => { st.log = ((st.log || '') + '\n' + s).slice(-6000); return finish(st, { title: 'Migrasi GEN-Z.AI', msgHtml: `<pre>${esc(st.log)}</pre><p class="${t}">${esc(s)}</p>`, msgText: s, type: t, autogo: t === 'ok' }); };
  if (st.pass !== PASS) return finish(st, { title: 'Akses ditolak', msgHtml: '<p class="err">Kode akses salah.</p>', msgText: 'Kode akses salah.', type: 'err' });
  if (!st.oldconn || !st.oldkey) return finish(st, { title: 'Data kurang', msgHtml: '<p class="err">oldconn & oldkey wajib diisi.</p>', msgText: 'oldconn & oldkey wajib diisi.', type: 'err' });
  let old = null, nw = null;
  try {
    old = postgres(st.oldconn, { max: 1, ssl: 'require', connect_timeout: 25, idle_timeout: 5 });
    nw = postgres(Deno.env.get('SUPABASE_DB_URL'), { max: 1, ssl: 'require', connect_timeout: 25, idle_timeout: 5 });

    if (st.phase === 'schema') {
      if (st.c1 === 0) {
        await nw.unsafe('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
        await nw.unsafe('CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version varchar PRIMARY KEY, statements text, name varchar, created_by varchar, idempotency_key varchar, rollback text)');
      }
      let tbl = '_bk.ddl';
      let meta = await old.unsafe("select column_name, data_type from information_schema.columns where table_schema='_bk' and table_name='ddl' order by ordinal_position");
      if (!meta.length) { tbl = 'public."_bk.ddl"'; meta = await old.unsafe("select column_name, data_type from information_schema.columns where table_schema='public' and table_name='_bk.ddl' order by ordinal_position"); }
      if (!meta.length) throw new Error('Tabel _bk.ddl tidak ditemukan di proyek lama (kabari agen bila ini muncul).');
      const ordCol = (meta.find((m) => /int/.test(m.data_type)) || meta[0]).column_name;
      const stmtCol = ([...meta].reverse().find((m) => /text|char/.test(m.data_type)) || meta[meta.length - 1]).column_name;
      const rows = await old.unsafe(`select "${stmtCol}" as s from ${tbl} order by "${ordCol}" offset ${st.c1} limit ${CHUNK}`);
      let done = 0; const errs = [];
      for (const r of rows) {
        const s = String(r.s || '').trim();
        if (!s) continue;
        try { await nw.unsafe(s); done++; } catch (e) { errs.push(s.slice(0, 60) + ' :: ' + String(e.message).slice(0, 120)); }
      }
      st.c1 += rows.length;
      const msg = `skema: ${done} statement OK (offset ${st.c1})` + (errs.length ? ` | dilewati ${errs.length}: ` + errs.slice(0, 3).join(' // ') : '');
      if (rows.length < CHUNK) { st.phase = 'data'; st.c1 = 0; st.c2 = 0; return step(msg + '\n-- SKEMA SELESAI \u2192 lanjut data', 'ok'); }
      return step(msg, errs.length ? 'err' : 'ok');
    }

    if (st.phase === 'data') {
      if (st.c2 >= TABLES.length) { st.phase = 'storage'; st.c1 = 0; return step('-- DATA SELESAI \u2192 lanjut storage', 'ok'); }
      const t = TABLES[st.c2];
      const lim = WIDE[t.replace('public.', '')] || 50;
      const rows = await old.unsafe(`select * from ${t} offset ${st.c1} limit ${lim}`);
      if (!rows.length) { st.c2++; st.c1 = 0; return step(`\u2713 ${t}: kosong/selesai`, 'ok'); }
      const cols = Object.keys(rows[0]).filter((c) => !(SKIP_COLS[t] || []).includes(c));
      const ph = rows.map((_, i) => '(' + cols.map((_, j) => '$' + (i * cols.length + j + 1)).join(',') + ')').join(',');
      const params = rows.flatMap((r) => cols.map((c) => (r[c] === undefined ? null : r[c])));
      let ins = 0;
      await nw.begin(async (tx) => {
        await tx.unsafe('SET LOCAL session_replication_role = replica');
        const res = await tx.unsafe(`insert into ${t} (${cols.map((c) => '"' + c + '"').join(',')}) values ${ph} on conflict do nothing`, params);
        ins = res.count;
      });
      st.c1 += rows.length;
      const penuh = rows.length >= lim;
      const msg = `\u2713 ${t}: +${ins} baris (diproses ${st.c1})`;
      if (!penuh) { st.c2++; st.c1 = 0; }
      return step(msg, 'ok');
    }

    if (st.phase === 'storage') {
      const hk = { apikey: st.oldkey, Authorization: 'Bearer ' + st.oldkey };
      const NK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const nk = { apikey: NK, Authorization: 'Bearer ' + NK };
      const NB = Deno.env.get('SUPABASE_URL');
      const buckets = await (await fetch(OLD_BASE + '/storage/v1/bucket', { headers: hk })).json();
      const have = new Set((await (await fetch(NB + '/storage/v1/bucket', { headers: nk })).json()).map((b) => b.id));
      for (const b of buckets) if (!have.has(b.id)) {
        await fetch(NB + '/storage/v1/bucket', { method: 'POST', headers: { ...nk, 'content-type': 'application/json' }, body: JSON.stringify({ id: b.id, name: b.name, public: !!b.public, file_size_limit: b.file_size_limit || undefined, allowed_mime_types: b.allowed_mime_types || undefined }) });
      }
      const flat = [];
      for (const b of buckets) {
        const l = await (await fetch(OLD_BASE + '/storage/v1/object/list/' + encodeURIComponent(b.id), { method: 'POST', headers: { ...hk, 'content-type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'name', order: 'asc' } }) })).json();
        for (const o of Array.isArray(l) ? l : []) flat.push({ b: b.id, n: o.name, size: o.metadata?.size || 0, mime: o.metadata?.mimetype || 'application/octet-stream' });
      }
      const slice = flat.slice(st.c1, st.c1 + 6);
      let bytes = 0;
      for (const o of slice) {
        const dl = await fetch(OLD_BASE + '/storage/v1/object/' + encP(o.b, o.n), { headers: hk });
        if (!dl.ok) throw new Error('unduh gagal ' + o.b + '/' + o.n + ' HTTP ' + dl.status);
        const buf = new Uint8Array(await dl.arrayBuffer());
        const up = await fetch(NB + '/storage/v1/object/' + encP(o.b, o.n), { method: 'POST', headers: { ...nk, 'content-type': o.mime, 'cache-control': 'max-age=3600', 'x-upsert': 'true' }, body: buf });
        if (!up.ok) throw new Error('upload gagal ' + o.b + '/' + o.n + ' HTTP ' + up.status + ' ' + (await up.text()).slice(0, 120));
        bytes += buf.length;
      }
      st.c1 += slice.length;
      if (!slice.length || st.c1 >= flat.length) { st.phase = 'finalize'; st.c1 = 0; return step(`-- STORAGE SELESAI (${flat.length} objek) \u2192 finalisasi`, 'ok'); }
      return step(`\u2713 storage: +${slice.length} objek (${(bytes / 1e6).toFixed(1)} MB) \u2014 ${st.c1}/${flat.length}`, 'ok');
    }

    if (st.phase === 'finalize') {
      const fks = await nw.unsafe("select conname, conrelid::regclass::text as tbl from pg_constraint where contype='f' and not convalidated");
      for (const f of fks) { try { await nw.unsafe(`alter table ${f.tbl} validate constraint "${f.conname}"`); } catch (e) { /* skip */ } }
      await nw.unsafe(`do $$ declare r record; mx bigint; begin for r in select c.oid::regclass::text as seq, t.relname as tab, a.attname as col from pg_class c join pg_depend d on d.objid=c.oid and d.classid='pg_class'::regclass and d.deptype in ('a','i') join pg_class t on t.oid=d.refobjid join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid where c.relkind='S' loop execute format('select coalesce(max(%I),0) from %I', r.col, r.tab) into mx; if mx>0 then execute format('select setval(%L,%s)', r.seq, mx); else execute format('select setval(%L,1,false)', r.seq); end if; end loop; end $$;`);
      try { await nw.unsafe('drop trigger if exists on_auth_user_created on auth.users'); await nw.unsafe('create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()'); } catch (e) { /* skip */ }
      try { await nw.unsafe('alter publication supabase_realtime add table public.providers, public.support_conversations, public.support_messages'); } catch (e) { /* skip */ }
      const om = await old.unsafe('select bucket_id, name, owner, created_at, updated_at from storage.objects');
      for (const o of om) { await nw.unsafe('update storage.objects set owner=$1, created_at=$2, updated_at=$3 where bucket_id=$4 and name=$5', [o.owner, o.created_at, o.updated_at, o.bucket_id, o.name]); }
      const bm = await old.unsafe('select id, owner, owner_id, created_at, updated_at, avif_autodetection from storage.buckets');
      for (const b of bm) { await nw.unsafe('update storage.buckets set owner=$1, owner_id=$2, created_at=$3, updated_at=$4, avif_autodetection=$5 where id=$6', [b.owner, b.owner_id, b.created_at, b.updated_at, b.avif_autodetection, b.id]); }
      const c = await nw.unsafe("select (select count(*) from auth.users) u, (select count(*) from public.profiles) p, (select count(*) from public.models) m, (select count(*) from public.generation_history) gh, (select count(*) from public.social_post_runs) spr, (select count(*) from storage.buckets) b, (select count(*) from storage.objects) o");
      const r = c[0];
      const counts = { u: r.u, p: r.p, m: r.m, gh: r.gh, spr: r.spr, b: r.b, o: r.o };
      return finish(st, { title: '\ud83c\udf89 SELESAI', msgHtml: `<p class="ok">Migrasi selesai! Jumlah baris di proyek baru:</p><pre>auth.users            : ${r.u}   (harap 6)\npublic.profiles       : ${r.p}   (harap 6)\npublic.models         : ${r.m}   (harap 24)\ngeneration_history    : ${r.gh}  (harap 246+)\nsocial_post_runs      : ${r.spr} (harap 117+)\nstorage.buckets       : ${r.b}   (harap 7)\nstorage.objects       : ${r.o}   (harap 71)</pre><p>Selanjutnya: kabari agen Arena untuk verifikasi, lalu setel 4 hal di Dashboard \u2192 Authentication (Anonymous ON, Manual linking ON, require reauthentication ON, rate limit email_sent 2/jam) dan deploy Worker.</p><pre>${esc(st.log || '')}</pre>`, msgText: 'Migrasi selesai.', type: 'done', done: true, counts });
    }
    return finish(st, { title: '?', msgHtml: '<p class="err">phase tidak dikenal</p>', msgText: 'phase tidak dikenal', type: 'err' });
  } catch (e) {
    return finish(st, { title: '\u26a0\ufe0f Error', msgHtml: `<p class="err">${esc(String((e && e.message) || e).slice(0, 600))}</p><p>Kirim pesan error ini ke agen Arena, lalu klik ULANGI setelah diperbaiki.</p><pre>${esc(st.log || '')}</pre>`, msgText: String((e && e.message) || e).slice(0, 600), type: 'err' });
  } finally {
    try { if (old) await old.end(); } catch (e) { /* */ }
    try { if (nw) await nw.end(); } catch (e) { /* */ }
  }
});
