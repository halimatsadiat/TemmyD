import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('custom prices, private references, quote acceptance, reminders and password recovery work together',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'temmyd-commerce-')),server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4195',DATA_DIR:dir,EMAIL_ENABLED:'false',APP_URL:'http://127.0.0.1:4195'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{let errors='';server.stderr.on('data',d=>errors+=d);const t=setTimeout(()=>reject(Error(errors||'Server timeout')),10000);server.stdout.once('data',()=>{clearTimeout(t);resolve()});server.once('exit',()=>{clearTimeout(t);reject(Error(errors))})});
 async function call(route,method='GET',body,cookie){const r=await fetch('http://127.0.0.1:4195'+route,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const reg=async(name,route='/api/register')=>call(route,'POST',{name,email:name+'@example.test',password:'DisposablePassword123'});const owner=await reg('owner','/api/setup'),alice=await reg('alice'),bob=await reg('bob');
 const opts=(await call('/api/customisation')).data;assert.equal(opts.depositPercent,50);assert.equal((await call('/api/admin/customisation','PUT',{options:opts.options},alice.cookie)).status,403);
 assert.equal((await call('/api/references','POST',{image:'data:image/png;base64,SGVsbG8='},alice.cookie)).status,400);
 const image=await call('/api/references','POST',{image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII='},alice.cookie);assert.equal(image.status,201);
 assert.equal((await fetch('http://127.0.0.1:4195'+image.data.url,{headers:{cookie:alice.cookie}})).status,200);assert.equal((await call(image.data.url,'GET',null,bob.cookie)).status,404);
 const local=new DatabaseSync(path.join(dir,'bakery.sqlite'));const filename=local.prepare('SELECT filename FROM reference_photos WHERE id=?').get(image.data.id).filename;local.close();assert.equal((await call('/uploads/'+filename,'GET')).status,404);
 const cake=(await call('/api/cakes')).data[0],input={phone:'08012345678',date:'2030-12-20',fulfilment:'Pickup',items:[{cakeId:cake.id,size:8,qty:2,flavour:'Chocolate',filling:'Chocolate ganache',decoration:'Sprinkles',referenceId:image.data.id,unit:1}]};
 const order=await call('/api/orders','POST',input,alice.cookie);assert.equal(order.status,201);assert.equal(order.data.total,(Math.round(cake.price*1.5)+4500)*2);assert.equal(order.data.items[0].referenceId,image.data.id);assert.equal(order.data.balance.depositDue,Math.ceil(order.data.total/2));
 assert.equal((await call('/api/orders','POST',input,bob.cookie)).status,400);assert.equal((await call('/api/orders','POST',{...input,items:[{...input.items[0],flavour:'Nonexistent'}]},alice.cookie)).status,400);
 const request=await call('/api/cake-requests','POST',{description:'Three-tier vanilla wedding cake',budget:100000,date:'2030-12-20',phone:'08012345678',fulfilment:'Delivery',address:'Test Cake Lane',referenceId:image.data.id},alice.cookie);assert.equal(request.status,201);const rid=request.data.id;
 assert.equal((await call('/api/admin/cake-requests','GET',null,alice.cookie)).status,403);assert.equal((await call('/api/cake-requests','GET',null,bob.cookie)).data.length,0);
 assert.equal((await call('/api/admin/cake-requests/'+rid,'PATCH',{total:90000,note:'Three tiers, vanilla, delivery included',days:7},owner.cookie)).status,200);
 let quote=(await call('/api/cake-requests','GET',null,alice.cookie)).data[0];const oldVersion=quote.version;await call('/api/admin/cake-requests/'+rid,'PATCH',{total:95000,note:'Revised total includes delivery',days:7},owner.cookie);
 assert.equal((await call('/api/cake-requests/'+rid+'/accept','POST',{version:oldVersion},alice.cookie)).status,409);
 quote=(await call('/api/cake-requests','GET',null,alice.cookie)).data[0];assert.equal((await call('/api/cake-requests/'+rid+'/accept','POST',{version:quote.version},bob.cookie)).status,404);
 await call('/api/admin/deposit-policy','PUT',{percent:70},owner.cookie);
 const accepted=await call('/api/cake-requests/'+rid+'/accept','POST',{version:quote.version,total:1},alice.cookie);assert.equal(accepted.status,201);const custom=(await call('/api/orders/'+accepted.data.orderId,'GET',null,alice.cookie)).data;assert.equal(custom.total,95000);assert.equal(custom.balance.depositPercent,70);assert.equal(custom.balance.depositDue,66500);assert.equal((await call('/api/orders/'+order.data.id,'GET',null,alice.cookie)).data.balance.depositPercent,50);
 assert.equal((await call('/api/cake-requests/'+rid+'/accept','POST',{version:quote.version},alice.cookie)).data.orderId,accepted.data.orderId);
 assert.equal((await call('/api/admin/orders/'+custom.id+'/remind','POST',{},owner.cookie)).status,200);assert.equal((await call('/api/admin/orders/'+custom.id+'/remind','POST',{},owner.cookie)).status,429);
 const known=await call('/api/forgot-password','POST',{email:'alice@example.test'}),unknown=await call('/api/forgot-password','POST',{email:'unknown@example.test'});assert.deepEqual(known.data,unknown.data);
 const messages=(await call('/api/admin/email','GET',null,owner.cookie)).data.messages;const resetEmail=messages.find(x=>x.subject==='Reset your Temmyd Cakes password');assert.ok(resetEmail);const content=(await call('/api/admin/email/preview/'+resetEmail.id,'GET',null,owner.cookie)).data.content;const token=content.match(/token=([a-f0-9]{64})/)[1];
 assert.equal((await call('/api/reset-password','POST',{token,password:'short'})).status,400);assert.equal((await call('/api/reset-password','POST',{token,password:'ChangedPassword123'})).status,200);assert.equal((await call('/api/session','GET',null,alice.cookie)).data.user,null);assert.equal((await call('/api/reset-password','POST',{token,password:'AnotherPassword123'})).status,400);const login=await call('/api/login','POST',{email:'alice@example.test',password:'ChangedPassword123'});assert.equal(login.status,200);assert.equal(login.data.user.role,'customer');
 }finally{server.kill();await new Promise(r=>server.once('exit',r));rmSync(dir,{recursive:true,force:true})}
});
