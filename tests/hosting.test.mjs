import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=mkdtempSync(path.join(tmpdir(),'temmyd-hosting-test-'));
let server;const token='test-only-owner-setup-token-1234567890';
async function start(setupToken){server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'production',PORT:'4197',HOST:'127.0.0.1',DATA_DIR:dir,SETUP_TOKEN:setupToken},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Hosting test did not start')),10000);server.stdout.once('data',()=>{clearTimeout(timeout);resolve()});server.once('error',reject)})}
async function stop(){if(server&&!server.killed){const child=server;await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}}
after(async()=>{await stop();try{rmSync(dir,{recursive:true,force:true})}catch{}});
test('hosted admin setup requires a private token, cookies are secure, and data survives restart',async()=>{await start(token);let r=await fetch('http://127.0.0.1:4197/api/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok'});let session=await(await fetch('http://127.0.0.1:4197/api/session')).json();assert.equal(session.requiresSetupToken,true);assert.equal(JSON.stringify(session).includes(token),false);const setup=async setupToken=>fetch('http://127.0.0.1:4197/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Hosted Owner',email:'owner@example.test',password:'HostedPassword123',setupToken})});assert.equal((await setup()).status,403);assert.equal((await setup('incorrect')).status,403);r=await setup(token);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/; Secure/);assert.equal((await r.json()).user.role,'admin');await stop();await start('');session=await(await fetch('http://127.0.0.1:4197/api/session')).json();assert.equal(session.needsSetup,false);assert.equal((await setup(token)).status,409)});
