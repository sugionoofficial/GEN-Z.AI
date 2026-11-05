import { getSupabaseConfig } from "../lib/admin-models/config.js";
import { verifyAdmin } from "../lib/admin-models/auth.js";

function json(res,status,body){ res.status(status); res.setHeader("Content-Type","application/json; charset=utf-8"); res.setHeader("Cache-Control","no-store"); return res.end(JSON.stringify(body)); }

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST") return json(res,405,{success:false,error:"Method not allowed"});
  const config=getSupabaseConfig(); let admin; try{admin=await verifyAdmin(req,config);}catch(e){return json(res,500,{success:false,error:"Verifikasi gagal"});}
  if(!admin.ok) return json(res,admin.status,{success:false,error:admin.error});
  try{
    const ctype=String(req.headers["content-type"]||"");
    // expect JSON with base64 dataUrl from client (simpler than multipart)
    const body=req.body||{};
    const filename=String(body.filename||"upload.bin").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
    const dataUrl=String(body.dataUrl||"");
    const saveToStorage=!!body.saveToStorage;
    if(!dataUrl.startsWith("data:")) return json(res,400,{success:false,error:"dataUrl wajib data:*"});
    const m=dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if(!m) return json(res,400,{success:false,error:"Format dataUrl tidak valid"});
    const mime=m[1], b64=m[2];
    const buf=Buffer.from(b64,"base64");
    if(buf.length> 8*1024*1024) return json(res,413,{success:false,error:"Max 8MB"});
    let publicUrl=null, storagePath=null;
    if(saveToStorage){
      const ext=filename.includes(".")?filename.split(".").pop():"bin";
      storagePath=`${admin.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
      // upload via storage API
      const r=await fetch(`${config.url}/storage/v1/object/copilot-uploads/${encodeURIComponent(storagePath).replace(/%2F/g,"/")}`,{
        method:"POST",
        headers:{ apikey:config.serviceRoleKey, Authorization:`Bearer ${config.serviceRoleKey}`, "Content-Type": mime, "x-upsert":"false" },
        body: buf
      });
      if(!r.ok){ const t=await r.text(); throw Object.assign(new Error(`Storage upload gagal: ${r.status} ${t.slice(0,200)}`),{status:r.status}); }
      publicUrl=`${config.url}/storage/v1/object/public/copilot-uploads/${storagePath}`;
      // private bucket -> generate signed url? For now return path
    }
    return json(res,200,{success:true, filename, mime, size:buf.length, dataUrl: dataUrl.slice(0, 120)+"... (truncated for response)", fullDataUrl: dataUrl, storagePath, publicUrl});
  }catch(e){ console.error("[copilot-upload]",e); return json(res,e.status||500,{success:false,error:e.message}); }
}
