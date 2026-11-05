import { getSupabaseConfig } from "../lib/admin-models/config.js";
import { verifyAdmin } from "../lib/admin-models/auth.js";

function json(res, status, body){
  res.status(status);
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  return res.end(JSON.stringify(body));
}
async function supaFetch(config, path, opts={}){
  const r=await fetch(`${config.url}${path}`,{...opts, headers:{apikey:config.serviceRoleKey, Authorization:`Bearer ${config.serviceRoleKey}`, "Content-Type":"application/json", ...(opts.headers||{})}});
  const t=await r.text(); let d=null; try{d=t?JSON.parse(t):null;}catch{d=t;}
  if(!r.ok) throw Object.assign(new Error(d?.message||d?.error||`Supabase ${r.status}`),{status:r.status});
  return d;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS") return res.status(204).end();
  const config=getSupabaseConfig();
  if(!config.url||!config.serviceRoleKey) return json(res,500,{success:false,error:"Supabase belum dikonfigurasi"});
  let admin; try{ admin=await verifyAdmin(req,config);}catch(e){ return json(res,500,{success:false,error:"Verifikasi gagal"}); }
  if(!admin.ok) return json(res,admin.status,{success:false,error:admin.error});
  const userId = admin.user?.id || admin.userId;
  try{
    if(req.method==="GET"){
      const rows=await supaFetch(config, `/rest/v1/copilot_sessions?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=50`,{method:"GET"});
      return json(res,200,{success:true, sessions: rows});
    }
    const body=req.body||{};
    const action=String(body.action||"").trim();
    if(action==="create"){
      const title=String(body.title||"Percakapan Baru").slice(0,100);
      const rows=await supaFetch(config, `/rest/v1/copilot_sessions`,{method:"POST", headers:{Prefer:"return=representation"}, body:JSON.stringify({user_id:userId, title, messages:[], metadata:{}})});
      return json(res,201,{success:true, session: Array.isArray(rows)?rows[0]:rows});
    }
    if(action==="update"){
      const id=String(body.id||"").trim(); if(!id) return json(res,400,{success:false,error:"id wajib"});
      const patch={}; if(body.title!==undefined) patch.title=String(body.title).slice(0,100);
      if(body.messages!==undefined) patch.messages=Array.isArray(body.messages)?body.messages:[];
      if(body.metadata!==undefined) patch.metadata=body.metadata;
      patch.updated_at=new Date().toISOString();
      const rows=await supaFetch(config, `/rest/v1/copilot_sessions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,{method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify(patch)});
      return json(res,200,{success:true, session: Array.isArray(rows)?rows[0]:rows});
    }
    if(action==="delete"){
      const id=String(body.id||"").trim(); if(!id) return json(res,400,{success:false,error:"id wajib"});
      await supaFetch(config, `/rest/v1/copilot_sessions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,{method:"DELETE"});
      return json(res,200,{success:true});
    }
    return json(res,400,{success:false,error:"action tidak dikenal"});
  }catch(e){
    // table not exists -> fallback to localStorage only
    if(String(e.message).includes("copilot_sessions") || e.status===404) return json(res,200,{success:true, sessions:[], fallback:true, note:"Tabel belum ada, pakai localStorage"});
    console.error("[copilot-session]",e);
    return json(res,e.status||500,{success:false,error:e.message});
  }
}
