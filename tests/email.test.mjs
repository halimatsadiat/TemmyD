import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {emailService} from '../email.mjs';

async function fixture(env={},fetcher=async()=>{throw Error('No network expected')}){
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE orders(id TEXT,customer TEXT,email TEXT,items TEXT,payment TEXT,total INTEGER,delivery_date TEXT,fulfilment TEXT);CREATE TABLE staff_invites(id TEXT,revoked INTEGER,used_at TEXT,expires INTEGER);");
 const responses=[];const mail=await emailService({db,env,fetcher,json:(res,data,status)=>responses.push({data,status}),body:async()=>({}),requireUser:async(req,owner)=>{if(!req.owner||!owner){const e=Error('Owner only');e.status=403;throw e}return{email:'owner@example.test'}},fail:(status,message)=>{const e=Error(message);e.status=status;throw e}});return{db,mail,responses};
}
test('preview mode never sends and notification records roll back with order events',async()=>{
 const {db,mail,responses}=await fixture();try{
 db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)').run('TC-TEST','Test Customer','customer@example.test',JSON.stringify([{name:'<Vanilla>',qty:1,size:6}]),'Unpaid',28000,'2030-12-20','Delivery');
 db.exec('BEGIN');await mail.orderEvent('TC-TEST','Placed','Order received. Awaiting confirmation.');db.exec('ROLLBACK');assert.equal(db.prepare('SELECT count(*) n FROM email_outbox').get().n,0);
 await mail.orderEvent('TC-TEST','Placed','Order received. Awaiting confirmation.');await mail.drain();const job=db.prepare('SELECT * FROM email_outbox').get();assert.equal(job.status,'preview');assert.match(job.content,/Unpaid/);assert.match(job.content,/account\/orders\/TC-TEST/);
 await assert.rejects(mail.handle({},null,'/api/admin/email','GET'),{status:403});await mail.handle({owner:true},null,'/api/admin/email','GET');assert.equal(responses[0].data.messages[0].content,undefined);
 await mail.handle({owner:true},null,'/api/admin/email/preview/'+job.id,'GET');assert.equal(responses[1].data.content,job.content);
 }finally{db.close()}
});
test('sending uses escaped HTML, server credentials and a stable idempotency key; previews are not sent later',async()=>{
 const sent=[];const env={EMAIL_ENABLED:'true',RESEND_API_KEY:'private-test-key',EMAIL_FROM:'Bakery <orders@example.test>',APP_URL:'https://bakery.example.test',NODE_ENV:'production'};
 const {db,mail}=await fixture(env,async(url,opts)=>{sent.push({url,...opts});return{ok:true,json:async()=>({id:'email-123'})}});try{
 await mail.queue('customer@example.test','Test','<script>bad</script>');await mail.drain();await mail.drain();assert.equal(sent.length,1);assert.equal(sent[0].url,'https://api.resend.com/emails');assert.match(sent[0].headers['Idempotency-Key'],/^temmyd-email-/);const payload=JSON.parse(sent[0].body);assert.match(payload.html,/&lt;script&gt;/);assert.equal(payload.to[0],'customer@example.test');assert.equal(db.prepare('SELECT status FROM email_outbox').get().status,'sent');
 await assert.rejects(mail.handle({owner:true},null,'/api/admin/email/preview/x','GET'),{status:403});
 }finally{db.close()}
});
test('temporary failures retry without exposing provider secrets; revoked invitations are cancelled',async()=>{
 let attempts=0;const {db,mail}=await fixture({EMAIL_ENABLED:'true',RESEND_API_KEY:'secret-value',EMAIL_FROM:'orders@example.test',APP_URL:'https://bakery.example.test'},async()=>{attempts++;return{ok:false,status:429,json:async()=>({message:'secret-value'})}});try{
 const id=await mail.queue('customer@example.test','Test','Body');await mail.drain();assert.equal(attempts,1);let job=db.prepare('SELECT * FROM email_outbox WHERE id=?').get(id);assert.equal(job.status,'queued');assert.equal(job.last_error.includes('secret-value'),false);await mail.drain();assert.equal(attempts,1);db.prepare('UPDATE email_outbox SET next_attempt=0 WHERE id=?').run(id);await mail.drain();assert.equal(attempts,2);
 await mail.invite('staff@example.test','manager','/staff/join?token=private','revoked-id');await mail.drain();job=db.prepare('SELECT * FROM email_outbox WHERE invite_id=?').get('revoked-id');assert.equal(job.status,'cancelled');assert.equal(job.content,'');
 }finally{db.close()}
});
