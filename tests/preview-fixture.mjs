// Disposable UI test server. Never uses the real bakery database.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'temmyd-ui-test-'));
process.env.PORT='4198';
await import('../server.mjs');
const call=async(p,b,cookie)=>{const r=await fetch('http://127.0.0.1:4198/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:b?JSON.stringify(b):undefined});return{data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
await call('setup',{name:'Test Bakery Owner',email:'owner@example.test',password:'DisposableUiTest123'});
const customer=await call('register',{name:'Test Customer',email:'customer@example.test',password:'DisposableCustomer123'});
const cakes=await call('cakes');
await call('orders',{phone:'08012345678',date:'2030-12-20',fulfilment:'Delivery',address:'Test delivery address',items:[{cakeId:cakes.data[0].id,size:8,qty:1,message:'Happy birthday!'}]},customer.cookie);
console.log('Disposable UI fixture ready on http://127.0.0.1:4198');
