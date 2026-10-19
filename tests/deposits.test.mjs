import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {payments} from '../payments.mjs';
test('verified deposits and balances accumulate once without trusting customer amounts',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'temmyd-deposits-')),db=new DatabaseSync(':memory:');db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,email TEXT,total INTEGER,status TEXT,payment TEXT);INSERT INTO orders VALUES('order1','alice','alice@example.test',12500,'Placed','Unpaid');");let answer,amount=625000,domain='test';const calls=[],events=[];
 const fail=(status,message)=>{const e=Error(message);e.status=status;throw e};const service=await payments({db,data:dir,fail,body:async req=>req.payload,requireUser:req=>req.actor,json:(_,v)=>answer=v,terms:async()=>50,update:()=>{},addEvent:(...x)=>events.push(x),fetcher:async(url,opts)=>{if(url.endsWith('/initialize')){const b=JSON.parse(opts.body);calls.push(b);return Response.json({status:true,data:{reference:b.reference,authorization_url:'https://checkout.paystack.com/test'}})}return Response.json({status:true,data:{reference:url.split('/').pop(),status:'success',amount,currency:'NGN',domain}})}});
 const call=async(route,body,actor={id:'alice',role:'customer'},method='POST')=>{await service.handle({payload:body,actor},{},route,method);return answer};
 try{
 await call('/api/admin/payments',{secret:'sk_test_12345678901234567890',origin:'http://127.0.0.1:4174',enabled:true},{id:'owner',role:'admin'},'PATCH');
 const first=await call('/api/payments/initialize',{orderId:'order1',paymentOption:'deposit',amount:1});assert.equal(calls[0].amount,625000);
 await call('/api/payments/verify',{reference:first.reference});await call('/api/payments/verify',{reference:first.reference});let order=db.prepare('SELECT * FROM orders').get();assert.equal(order.payment,'Part-paid');assert.equal(events.length,1);assert.deepEqual(await service.summary(order),{amountPaid:6250,balanceDue:6250,depositPercent:50,depositDue:6250});
 const second=await call('/api/payments/initialize',{orderId:'order1',paymentOption:'deposit'});assert.notEqual(second.reference,first.reference);assert.equal(calls[1].amount,625000);
 amount=1250000;await assert.rejects(call('/api/payments/verify',{reference:second.reference}),/did not match/);assert.equal(db.prepare('SELECT payment FROM orders').get().payment,'Part-paid');
 amount=625000;await call('/api/payments/verify',{reference:second.reference});await call('/api/payments/verify',{reference:second.reference});order=db.prepare('SELECT * FROM orders').get();assert.equal(order.payment,'Paid');assert.equal((await service.summary(order)).balanceDue,0);assert.equal(events.length,2);await assert.rejects(call('/api/payments/initialize',{orderId:'order1'}),{status:409});
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
