import {spawnSync} from 'node:child_process';
for(const file of ['server.mjs','payments.mjs','database.mjs','photo-storage.mjs','web/app.js']){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
console.log('Application syntax checks passed.');
