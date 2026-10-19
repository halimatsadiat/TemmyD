// Run locally to load a private .env for one command. Never prints secret values.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const command=process.argv[2];if(!command)throw Error('Usage: node scripts/prepare-env.mjs script.mjs');
const result=spawnSync(process.execPath,[command,...process.argv.slice(3)],{stdio:'inherit',env:process.env});process.exit(result.status||0);
