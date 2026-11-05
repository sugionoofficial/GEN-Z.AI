import { getSupabaseConfig } from "../lib/admin-models/config.js";
import { verifyAdmin } from "../lib/admin-models/auth.js";

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

async function supaFetch(config, path, opts = {}) {
  const r = await fetch(`${config.url}${path}`, {
    ...opts,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const t = await r.text();
  let d = null;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) throw Object.assign(new Error(d?.message || d?.error || `Supabase ${r.status}`), { status: r.status, data: d });
  return d;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { success:false, error:"Method not allowed" });
  const config = getSupabaseConfig();
  if (!config.url || !config.serviceRoleKey) return json(res, 500, { success:false, error:"Supabase belum dikonfigurasi" });
  let admin;
  try { admin = await verifyAdmin(req, config); } catch(e){ return json(res,500,{success:false,error:"Gagal verifikasi admin"}); }
  if (!admin.ok) return json(res, admin.status, { success:false, error: admin.error });

  try {
    const action = String(req.query?.action || req.body?.action || "status");
    if (action === "status") {
      // basic health: project reachable, tables count, buckets
      let tables = null, buckets = null, tableList = [], storageOk = false;
      try { tables = await supaFetch(config, "/rest/v1/?select=*", { method:"GET" }); } catch {}
      try {
        const rows = await supaFetch(config, "/rest/v1/information_schema_tables?select=table_name&table_schema=eq.public&limit=50", { method:"GET" });
        // fallback: query via postgrest not allowed for information_schema, use rpc or just count known tables via pg_tables
        // try pg_tables
        tableList = Array.isArray(rows) ? rows.map(r=>r.table_name) : [];
      } catch {}
      try {
        const b = await supaFetch(config, "/storage/v1/bucket", { method: "GET" });
        buckets = Array.isArray(b) ? b.map(x=>({ id:x.id, name:x.name, public:x.public })) : [];
        storageOk = true;
      } catch {}
      // try known tables via REST probing
      const probeTables = ["profiles","generation_history","provider_credentials","feature_credit_settings"];
      const probeResults = [];
      for (const t of probeTables) {
        try {
          const c = await supaFetch(config, `/rest/v1/${t}?select=*&limit=1`, { method:"GET", headers:{ Prefer:"count=exact" }});
          probeResults.push({ table:t, ok:true, sample: Array.isArray(c) ? c.length : 0 });
          if (tableList.length===0) tableList.push(t);
        } catch(e){ probeResults.push({ table:t, ok:false, error:e.message }); }
      }
      // ensure at least url returned even if probes fail
      return json(res,200,{ success:true, url:config.url, projectRef: (config.url.match(/https:\/\/([^.]+)\.supabase\.co/)||[])[1]||"", anonKeyPresent: !!config.anonKey, serviceRolePresent:true, buckets: buckets||[], storageOk, probeResults, tableList: tableList.length?tableList:["profiles","generation_history"] });
    }
    if (action === "query") {
      // read-only SELECT via postgrest - only allow SELECT
      const sql = String(req.body?.sql || req.query?.sql || "").trim();
      const table = String(req.body?.table || req.query?.table || "").trim();
      if (!table) return json(res,400,{success:false,error:"table wajib diisi"});
      if (!/^[a-z_][a-z0-9_]*$/i.test(table)) return json(res,400,{success:false,error:"Nama tabel tidak valid"});
      const limit = Math.min(50, Math.max(1, Number(req.body?.limit || req.query?.limit || 10)));
      const select = String(req.body?.select || req.query?.select || "*").slice(0,200);
      // simple guard: block dangerous keywords in select
      if (/;\s*drop|;\s*delete|;\s*insert|;\s*update/i.test(select+table)) return json(res,400,{success:false,error:"Hanya SELECT read-only"});
      const rows = await supaFetch(config, `/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&limit=${limit}`, { method:"GET" });
      return json(res,200,{success:true, table, rows, count: Array.isArray(rows)?rows.length:0});
    }
    if (action === "buckets") {
      const b = await supaFetch(config, "/storage/v1/bucket", { method:"GET" });
      return json(res,200,{success:true, buckets:b});
    }
    return json(res,400,{success:false,error:"action tidak dikenal"});
  } catch(e){ console.error("[copilot-supabase]",e); return json(res, e.status||500,{success:false,error:e.message}); }
}
