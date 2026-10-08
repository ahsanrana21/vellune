import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const ORDER_STATUSES = ['Pending','Confirmed','Delivered','Cancelled'];
const DEFAULT_PASSWORD = process.env.VELLUNE_ADMIN_PASSWORD || 'VELLUNE2026';
const store = () => getStore({ name:'vellune', consistency:'strong' });
const json = (obj,status=200,extra={}) => Response.json(obj,{status,headers:{'Cache-Control':'no-store',...extra}});
const text = v => v == null ? '' : String(v);
const num = v => Number(v) || 0;
const now = () => new Date().toISOString().slice(0,19).replace('T',' ');
const key = (kind,id) => `${kind}/${String(id).padStart(10,'0')}`;
const readJson = async req => { try{return await req.json()}catch{return {}} };
const listAll = async kind => {
  const s=store(); const {blobs}=await s.list({prefix:`${kind}/`});
  const rows=await Promise.all(blobs.map(b=>s.get(b.key,{type:'json'})));
  return rows.filter(Boolean).sort((a,b)=>String(a.createdAt||a.d||'').localeCompare(String(b.createdAt||b.d||'')));
};
const makeOrderId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VL${stamp}${rand}`;
};
const hash = v => crypto.createHash('sha256').update(text(v)).digest('hex');
const secret = async()=> (await store().get('meta/admin_password_hash')) || hash(DEFAULT_PASSWORD);
const sign = async p=>crypto.createHmac('sha256',await secret()).update(p).digest('hex');
const cookie = async()=>{const exp=Date.now()+7*24*60*60*1000;const p=String(exp);return `vl_admin=${p}.${await sign(p)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`};
const logged = async req => {const raw=req.headers.get('cookie')||'';const m=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith('vl_admin='));if(!m)return false;const [exp,sig]=m.slice(9).split('.');if(!exp||!sig||Number(exp)<Date.now())return false;const ex=await sign(exp);return sig.length===ex.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(ex));};
const ensure = async()=>{const s=store();if(!(await s.get('meta/seeded'))){await s.set('meta/admin_password_hash',hash(DEFAULT_PASSWORD));await s.set('meta/seeded','1')}};

export default async req => {
  try {
    const u=new URL(req.url), parts=u.pathname.replace(/\/+$/,'').split('/'), resource=parts[2]||'', idPart=parts[3], method=req.method, s=store();
    if(resource==='health'&&method==='GET') return json({ok:true,service:'vellune-api',time:new Date().toISOString()});
    if(resource==='admin'&&idPart==='login'&&method==='POST'){const d=await readJson(req);if(hash(d.password)!==await secret())return json({error:'Wrong password'},401);return json({ok:true},200,{'Set-Cookie':await cookie()})}
    if(resource==='admin'&&idPart==='logout'&&method==='POST')return json({ok:true},200,{'Set-Cookie':'vl_admin=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0'});
    if(resource==='admin'&&idPart==='me'&&method==='GET')return json({admin:await logged(req)});
    await ensure();

    if(resource==='admin'&&idPart==='password'&&method==='POST'){
      if(!await logged(req))return json({error:'Login required'},401); const d=await readJson(req);
      if(!d.current_password||!d.new_password||String(d.new_password).length<8)return json({error:'Current password and a new password of at least 8 characters are required'},400);
      if(hash(d.current_password)!==await secret())return json({error:'Current password is incorrect'},400);
      await s.set('meta/admin_password_hash',hash(d.new_password)); return json({ok:true},200,{'Set-Cookie':'vl_admin=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0'});
    }

    if(resource==='orders'){
      if(method==='POST'&&!idPart){
        const d=await readJson(req), name=text(d.name).trim(), ph=text(d.ph).trim(), items=Array.isArray(d.items)?d.items.slice(0,50):[];
        if(!name||!ph)return json({ok:false,error:'Name and phone are required.'},400);
        if(!items.length)return json({ok:false,error:'No items in order.'},400);
        const id=makeOrderId(), clean=items.map(i=>({id:text(i.id),name:text(i.name)||'Vellune Product',q:Math.max(1,Math.trunc(num(i.q))||1),price:num(i.price)}));
        const sub=clean.reduce((a,i)=>a+i.price*i.q,0), disc=Math.min(sub,Math.max(0,num(d.disc))), total=sub-disc, row={id,offer:disc?text(d.offer).slice(0,80):'',disc,prize:text(d.prize).slice(0,120),pn:clean.map(i=>`${i.name} x ${i.q}`).join(', '),items:clean,total,name,ph,c:text(d.c),a:text(d.a),no:text(d.no),st:'Pending',d:now(),createdAt:new Date().toISOString()};
        // Store directly under the public order ID. This removes the old counter dependency,
        // which could make Place Order fail before the order was ever saved.
        await s.setJSON(`orders/${id}`,row);
        return json({ok:true,order:row},201);
      }
      if(!await logged(req))return json({error:'Login required'},401);
      const oid=idPart?decodeURIComponent(idPart):null;
      if(method==='GET'&&!oid)return json({ok:true,orders:(await listAll('orders')).reverse()});
      if(oid&&method==='PATCH'){const d=await readJson(req);if(d.status&&!ORDER_STATUSES.includes(d.status))return json({ok:false,error:'Invalid status.'},400);const {blobs}=await s.list({prefix:'orders/'});for(const b of blobs){const row=await s.get(b.key,{type:'json'});if(row&&row.id===oid){if(d.status)row.st=d.status;await s.setJSON(b.key,row);return json({ok:true,order:row})}}return json({ok:false,error:'Order not found.'},404);}
      if(oid&&method==='DELETE'){const {blobs}=await s.list({prefix:'orders/'});for(const b of blobs){const x=await s.get(b.key,{type:'json'});if(x&&x.id===oid){await s.delete(b.key);return json({ok:true})}}return json({ok:false,error:'Order not found.'},404)}
    }
    if(resource==='customers'&&method==='GET'&&!idPart){if(!await logged(req))return json({error:'Login required'},401);const groups=new Map();for(const o of await listAll('orders')){const k=JSON.stringify([o.name,o.ph,o.c,o.a]);const g=groups.get(k);if(g)g.order_count++;else groups.set(k,{name:o.name,phone:o.ph,city:o.c,address:o.a,order_count:1,last_order_at:o.createdAt||o.d})}return json([...groups.values()]);}
    return json({ok:false,error:'Not found'},404);
  } catch(e){console.error(e);return json({ok:false,error:e.message||'Server error'},500)}
};
export const config={path:'/api/*'};
