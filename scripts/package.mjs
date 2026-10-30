import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
let html = await readFile(resolve(root,'public/index.html'),'utf8');
const css = await Promise.all(['vendor/leaflet.css','style.css'].map(p=>readFile(resolve(root,'public',p),'utf8')));
html=html.replace('    <link rel="stylesheet" href="vendor/leaflet.css">','    <style>'+css[0]+'</style>').replace('    <link rel="stylesheet" href="style.css">','    <style>'+css[1]+'</style>');
for(const p of ['vendor/leaflet.js','vendor/supabase.js','config.js','seed.js','app.js']){
    let js=await readFile(resolve(root,'public',p),'utf8');
    js=js.replace(/<\/script/gi,'<\\/script');
    html=html.replace(`    <script defer src="${p}"></script>`,`    <script>${js}</script>`);
}
// Inline scripts run at the bottom, after the DOM exists. Keep their original order.
const scripts=html.match(/    <script>[\s\S]*?<\/script>/g)||[];
html=html.replace(/    <script>[\s\S]*?<\/script>\n/g,'');
html=html.replace('</body>',scripts.join('\n')+'\n</body>');
await writeFile(resolve(root,'../kagoshima-trip.html'),html);
console.log('Standalone HTML packaged.');
