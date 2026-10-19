import {randomBytes,createHash} from 'node:crypto';
export async function recovery({db,body,json,fail,passwordHash,mail}){
 await db.exec(`CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,used_at TEXT,email_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS recovery_limits(key_hash TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);`);
 const hash=s=>createHash('sha256').update(s).digest('hex');
 async function limit(key,max){const k=hash(key),now=Date.now();await db.prepare('INSERT INTO recovery_limits VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN recovery_limits.window_start<? THEN 1 ELSE recovery_limits.attempts+1 END,window_start=CASE WHEN recovery_limits.window_start<? THEN excluded.window_start ELSE recovery_limits.window_start END').run(k,now,now-3600000,now-3600000);return(await db.prepare('SELECT attempts FROM recovery_limits WHERE key_hash=?').get(k)).attempts<=max;}
 async function handle(req,res,route,method){
  if(!['/api/forgot-password','/api/reset-password'].includes(route)||method!=='POST')return false;
  const b=await body(req);const generic={message:'If an account exists for this email, a reset link will be sent. Check your inbox and spam folder.'};
  if(route==='/api/forgot-password'){
   const email=typeof b.email==='string'?b.email.trim().toLowerCase().slice(0,254):'';
   const ipOK=await limit('request-ip:'+req.socket.remoteAddress,60),emailOK=ipOK?await limit('request-email:'+email,3):false;
   if(ipOK&&emailOK&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    const u=await db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
    if(u){const token=randomBytes(32).toString('hex'),expires=Date.now()+30*60000;await db.exec('BEGIN');try{
     await db.prepare("UPDATE email_outbox SET content='',status='cancelled' WHERE id IN (SELECT email_id FROM password_resets WHERE user_id=? AND used_at IS NULL)").run(u.id);
     await db.prepare('DELETE FROM password_resets WHERE user_id=?').run(u.id);
     const emailId=await mail.queue(u.email,'Reset your Temmyd Cakes password',`Someone requested a password reset for your Temmyd Cakes account.\n\nChoose a new password here:\n${mail.info().origin}/reset-password?token=${token}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore the email. Your password has not changed.`,'',expires);
     await db.prepare('INSERT INTO password_resets VALUES(?,?,?,NULL,?)').run(hash(token),u.id,expires,emailId);await db.exec('COMMIT');
    }catch(e){await db.exec('ROLLBACK');throw e}}
   }
   json(res,generic);return true;
  }
  if(!await limit('reset-ip:'+req.socket.remoteAddress,30))fail(429,'Too many attempts. Try again later.');
  if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token)||typeof b.password!=='string'||b.password.length<10||b.password.length>128)fail(400,'Use a valid reset link and a password of 10–128 characters.');
  const stored=passwordHash(b.password);await db.exec('BEGIN');try{
   const reset=await db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires>?').get(hash(b.token),Date.now());if(!reset)fail(400,'This reset link has expired or has already been used. Request another.');
   const claimed=await db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL').run(new Date().toISOString(),hash(b.token));if(!claimed.changes)fail(400,'This reset link has already been used.');
   await db.prepare('UPDATE users SET password=? WHERE id=?').run(stored,reset.user_id);await db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);
   const account=await db.prepare('SELECT email FROM users WHERE id=?').get(reset.user_id);await mail.queue(account.email,'Your Temmyd Cakes password was changed','Your password was changed using a reset link. All previous sessions have been signed out. If you did not make this change, request another password reset and contact the bakery.');
   await db.prepare("UPDATE email_outbox SET content='',status=CASE WHEN status IN ('queued','preview') THEN 'cancelled' ELSE status END WHERE id=?").run(reset.email_id);
   await db.exec('COMMIT');
  }catch(e){await db.exec('ROLLBACK');throw e}
  json(res,{message:'Your password has been changed. Sign in with your new password.'});return true;
 }
 return{handle};
}
