import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import pg from 'pg';
// Only the server receives this database connection. The bakery schema is not
// exposed by Supabase's public Data API.
export function postgresSQL(input){let n=0;let quoted=false;let sql='';for(let i=0;i<input.length;i++){const c=input[i];if(c==="'"){if(quoted&&input[i+1]==="'"){sql+="''";i++;continue}quoted=!quoted}sql+=c==='?'&&!quoted?'$'+(++n):c}
sql=sql.replace(/PRAGMA[^;]+;/g,'').replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g,'BIGSERIAL PRIMARY KEY').replace(/\bINTEGER\b/g,'BIGINT').replace(/UNIQUE COLLATE NOCASE/g,'UNIQUE');
sql=sql.replace(/([\w.]+)\s*=\s*(\$\d+)\s+COLLATE NOCASE/g,'lower($1)=lower($2)').replace(/([\w.]+) COLLATE NOCASE/g,'lower($1)');
if(/INSERT OR IGNORE INTO/.test(sql))sql=sql.replace('INSERT OR IGNORE INTO','INSERT INTO').replace(/;?$/,' ON CONFLICT DO NOTHING');return sql}
export async function database({data}){if(!process.env.DATABASE_URL){if(process.env.RENDER)throw Error('DATABASE_URL is required on Render; local SQLite cannot persist on the free plan.');const db=new DatabaseSync(data+'/bakery.sqlite');let queue=Promise.resolve();return{kind:'sqlite',prepare:sql=>db.prepare(sql),exec:sql=>db.exec(sql),close:()=>db.close(),withContext:fn=>{const current=queue.then(fn,fn);queue=current.catch(()=>{});return current}}}
pg.types.setTypeParser(20,Number);
const context=new AsyncLocalStorage();const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:12000,idleTimeoutMillis:30000,ssl:{rejectUnauthorized:true,...(process.env.PGSSLROOTCERT_BASE64?{ca:Buffer.from(process.env.PGSSLROOTCERT_BASE64,'base64').toString()}: {})},options:'-c search_path=bakery'});
pool.on('error',()=>console.error('Database connection interrupted.'));
await pool.query('CREATE SCHEMA IF NOT EXISTS bakery');await pool.query('REVOKE ALL ON SCHEMA bakery FROM PUBLIC');
async function query(sql,values=[]){const client=context.getStore()?.client||pool;return client.query(postgresSQL(sql),values)}
return{kind:'postgres',prepare:sql=>({get:async(...v)=>(await query(sql,v)).rows[0],all:async(...v)=>(await query(sql,v)).rows,run:async(...v)=>({changes:(await query(sql,v)).rowCount})}),
exec:async sql=>{const command=sql.trim().toUpperCase(),store=context.getStore();if(command==='BEGIN'){if(!store||store.client)throw Error('Transaction context unavailable.');store.client=await pool.connect();try{await store.client.query('BEGIN')}catch(e){store.client.release();delete store.client;throw e}return}if(command==='COMMIT'||command==='ROLLBACK'){if(!store?.client)throw Error('Transaction is not active.');const client=store.client;try{await client.query(command)}finally{delete store.client;client.release()}return}return query(sql)},close:()=>pool.end(),withContext:fn=>context.run({},async()=>{try{return await fn()}finally{const store=context.getStore();if(store?.client){await store.client.query('ROLLBACK').catch(()=>{});store.client.release();delete store.client}}})};}
