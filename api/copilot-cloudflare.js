import { getSupabaseConfig } from "../lib/admin-models/config.js";
import { verifyAdmin } from "../lib/admin-models/auth.js";

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET","POST"].includes(req.method)) return json(res,405,{success:false,error:"Method not allowed"});
  const config = getSupabaseConfig();
  try { const a = await verifyAdmin(req, config); if (!a.ok) return json(res,a.status,{success:false,error:a.error}); } catch(e){ return json(res,500,{success:false,error:"Verifikasi gagal"}); }

  const cfToken = String(req.env?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "").trim();
  const cfAccount = String(req.env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const cfZone = String(req.env?.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || "").trim();
  const hasToken = !!cfToken;

  let deployments = null, workers = null, error = null;
  if (hasToken && cfAccount) {
    try {
      // list workers (pages deployments via pages API, workers via workers API)
      const wr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/workers/scripts`, {
        headers:{ Authorization:`Bearer ${cfToken}`, "Content-Type":"application/json" }
      });
      const wj = await wr.json().catch(()=>null);
      if (wj?.success) workers = (wj.result||[]).map(w=>({id:w.id, name:w.id, modified_on:w.modified_on}));
      else if (!wr.ok) error = wj?.errors?.[0]?.message || `Workers ${wr.status}`;

      // pages deployments (if zone not needed, try pages)
      // try fetch last 5 deployments via wrangler hidden not needed; we just return workers
    } catch(e){ error = e.message; }
  }

  return json(res,200,{
    success:true,
    configured: hasToken,
    accountPresent: !!cfAccount,
    zonePresent: !!cfZone,
    workers,
    deployments,
    error,
    envHint: {
      CLOUDFLARE_API_TOKEN: hasToken ? "set (hidden)" : "missing",
      CLOUDFLARE_ACCOUNT_ID: cfAccount ? cfAccount.slice(0,8)+"..." : "missing",
    },
    note: !hasToken ? "Set CLOUDFLARE_API_TOKEN & CLOUDFLARE_ACCOUNT_ID di Worker secrets untuk enable konektor" : null
  });
}
