import {randomBytes} from 'node:crypto';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function emailService({db,json,body,requireUser,fail,env=process.env,fetcher=fetch}){
 await db.exec(`CREATE TABLE IF NOT EXISTS email_outbox(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,created_at TEXT NOT NULL,provider_id TEXT NOT NULL DEFAULT '',last_error TEXT NOT NULL DEFAULT '',invite_id TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS email_attempt_windows(email_id TEXT PRIMARY KEY,started_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS email_secrets(email_id TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
 const origin=env.APP_URL||env.RENDER_EXTERNAL_URL||'http://127.0.0.1:4174';
 const provider=(env.EMAIL_PROVIDER||'resend').toLowerCase();
 const senderMatch=(env.EMAIL_FROM||'').trim().match(/^(?:([^<>\r\n]+)\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))$/);
 const sender=senderMatch?{name:senderMatch[1]?.trim()||'Temmyd Cakes',email:senderMatch[2]||senderMatch[3]}:null;
 const configured=!!sender&&(provider==='brevo'?!!env.BREVO_API_KEY:provider==='resend'&&!!env.RESEND_API_KEY);
 const providerName=provider==='brevo'?'Brevo':'Resend';
 let validOrigin=false;try{const u=new URL(origin);validOrigin=!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&(u.protocol==='https:'||!env.RENDER&&['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:')}catch{}
 const enabled=env.EMAIL_ENABLED==='true'&&configured&&validOrigin;
 const info=()=>({provider:providerName,configured,enabled,mode:enabled?'sending':'preview',from:env.EMAIL_FROM||'',origin,originValid:validOrigin});
 async function queue(recipient,subject,content,inviteId='',secretExpires=0){
  const id=randomBytes(16).toString('hex');await db.prepare('INSERT INTO email_outbox(id,recipient,subject,content,status,next_attempt,created_at,invite_id) VALUES(?,?,?,?,?,?,?,?)').run(id,recipient,subject,content,enabled?'queued':'preview',Date.now(),new Date().toISOString(),inviteId);if(secretExpires)await db.prepare('INSERT INTO email_secrets VALUES(?,?)').run(id,secretExpires);return id;
 }
 async function orderEvent(orderId,status,message){
  const o=await db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);if(!o)return;
  const payment=/payment verified|payment marked/i.test(message);const heading=payment?'Payment update':status==='Placed'?'Order received':'Order update: '+status;
  const items=JSON.parse(o.items).map(i=>`${i.qty} × ${i.name} (${i.size} inch / box equivalent)`).join('\n');
  await queue(o.email,`${heading} · ${o.id}`,`Hello ${o.customer},\n\n${message}\n\nOrder: ${o.id}\nStatus: ${status}\nPayment record: ${o.payment}\nTotal: NGN ${o.total.toLocaleString('en-NG')}\nCelebration date: ${o.delivery_date}\nFulfilment: ${o.fulfilment}\n\n${items}\n\nView your order: ${origin}/account/orders/${encodeURIComponent(o.id)}\n\nThank you,\nTemmyd Cakes\n\n${payment?'A payment record update does not itself collect or refund money.':'Orders are subject to bakery confirmation.'}`);
 }
 async function invite(email,role,joinPath,inviteId){return queue(email,'Your Temmyd Cakes staff invitation',`You have been invited to join Temmyd Cakes as ${role==='manager'?'a manager':'delivery staff'}.\n\nSign in or register using ${email}, then accept your invitation:\n${origin}${joinPath}\n\nThis link expires after seven days and works once. If you did not expect it, ignore this email.`,inviteId)}
 async function drain(){
  if(!enabled)return;
  const jobs=await db.prepare("SELECT * FROM email_outbox WHERE status IN ('queued','sending') AND next_attempt<=? ORDER BY created_at LIMIT 5").all(Date.now());
  for(const job of jobs){
   const claim=await db.prepare("UPDATE email_outbox SET status='sending',next_attempt=?,attempts=attempts+1 WHERE id=? AND status IN ('queued','sending') AND next_attempt<=?").run(Date.now()+60000,job.id,Date.now());if(!claim.changes)continue;
   await db.prepare('INSERT OR IGNORE INTO email_attempt_windows(email_id,started_at) VALUES(?,?)').run(job.id,Date.now());
   const window=await db.prepare('SELECT started_at FROM email_attempt_windows WHERE email_id=?').get(job.id);
   if(provider==='brevo'&&Date.now()-window.started_at>10*60000){await db.prepare("UPDATE email_outbox SET status='failed',last_error=? WHERE id=?").run('Retry window expired. Check Brevo logs before sending another notification.',job.id);continue;}
   if(Date.now()-Date.parse(job.created_at)>23*3600000){await db.prepare("UPDATE email_outbox SET status='failed',last_error=? WHERE id=?").run('Sending window expired. Create a fresh notification.',job.id);continue;}
   if(job.invite_id){const active=await db.prepare('SELECT id FROM staff_invites WHERE id=? AND revoked=0 AND used_at IS NULL AND expires>?').get(job.invite_id,Date.now());if(!active){await db.prepare("UPDATE email_outbox SET status='cancelled',content='' WHERE id=?").run(job.id);continue;}}
   const secret=await db.prepare('SELECT expires FROM email_secrets WHERE email_id=?').get(job.id);if(secret&&secret.expires<=Date.now()){await db.prepare("UPDATE email_outbox SET status='cancelled',content='' WHERE id=?").run(job.id);continue;}
   try{
    const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#234432"><h1>Temmyd Cakes</h1><div style="white-space:pre-wrap;line-height:1.6">${escape(job.content)}</div></div>`;
    const brevo=provider==='brevo';const key='temmyd-email-'+job.id;
    const payload=brevo?{sender,to:[{email:job.recipient}],replyTo:sender,subject:job.subject,textContent:job.content,htmlContent:html,headers:{idempotencyKey:key}}:{from:env.EMAIL_FROM,to:[job.recipient],subject:job.subject,text:job.content,html};
    const r=await fetcher(brevo?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',...(brevo?{'api-key':env.BREVO_API_KEY}:{Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':key})},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if(!r.ok){const e=new Error('Email provider returned HTTP '+r.status);e.retry=r.status===429||r.status>=500;throw e;}
    const result=await r.json();const providerId=brevo?result.messageId:result.id;if(typeof providerId!=='string')throw Error('Email provider response was incomplete.');
    await db.prepare("UPDATE email_outbox SET status='sent',provider_id=?,last_error='',content=? WHERE id=?").run(providerId,job.invite_id||secret?'Private link submitted. Link hidden for security.':job.content,job.id);
   }catch(e){const retry=e.retry!==false&&job.attempts<4;await db.prepare('UPDATE email_outbox SET status=?,next_attempt=?,last_error=? WHERE id=?').run(retry?'queued':'failed',Date.now()+Math.min(3600000,60000*2**job.attempts),e.message.startsWith('Email provider returned HTTP ')?e.message:'Email provider could not be reached. Check configuration and retry.',job.id);}
  }
 }
 async function handle(req,res,route,method){
  if(!route.startsWith('/api/admin/email'))return false;const owner=await requireUser(req,true);
  if(route==='/api/admin/email'&&method==='GET'){const messages=await db.prepare('SELECT id,recipient,subject,status,attempts,created_at,last_error,provider_id FROM email_outbox ORDER BY created_at DESC LIMIT 50').all();json(res,{...info(),messages});return true;}
  if(route==='/api/admin/email/test'&&method==='POST'){await queue(owner.email,'Temmyd Cakes email test',`Your bakery email notifications are ${enabled?'connected':'in preview mode'}.\n\n${enabled?'This message was sent through '+providerName+'.':'No email was sent. Connect your email provider to send real notifications.'}`);json(res,{mode:info().mode},201);return true;}
  if(route.startsWith('/api/admin/email/preview/')&&method==='GET'){if(env.NODE_ENV==='production'||env.RENDER)fail(403,'Email previews are available only locally.');const message=await db.prepare('SELECT subject,content,recipient,status FROM email_outbox WHERE id=?').get(route.split('/')[5]);if(!message)fail(404,'Email not found.');if(message.status!=='preview')fail(403,'Only preview emails can be opened here.');json(res,message);return true;}
  fail(404,'Email action not found.');
 }
 return{queue,orderEvent,invite,drain,handle,info};
}
