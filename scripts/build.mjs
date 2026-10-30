import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(resolve(root, 'public'), output, {recursive: true});
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (key.startsWith('sb_secret_')) throw new Error('Only a Supabase public key may be embedded in the app.');
if (key.startsWith('eyJ')) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') throw new Error('Only the anon JWT role may be embedded.');
}
if (key && !key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) throw new Error('Unrecognized Supabase public key.');
await writeFile(resolve(output,'config.js'), `window.APP_CONFIG = ${JSON.stringify({url, key}).replace(/</g, '\\u003c')};\n`);
console.log('Built static app in dist/ (Supabase: ' + (url && key ? 'configured' : 'local mode') + ')');
