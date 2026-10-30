import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('public/app.js',root),'utf8');
new vm.Script(source);
const sandbox = {window:{},document:{},URL,console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('public/seed.js',root),'utf8'),sandbox);
const prefix=source.slice(0,source.indexOf('    try {\n        const stored'));
vm.runInContext(prefix+'window.API={validateTrip,gmaps,safeURL,esc};})();',sandbox);
const {validateTrip,gmaps,safeURL,esc}=sandbox.window.API;
const seed=sandbox.window.TRIP_SEED;
validateTrip(seed);
let checks=1;
for (const d of seed.days) {
    for(const s of d.stops){
        const u=new URL(gmaps(s.query,true,s.mode));
        assert.equal(u.hostname,'www.google.com');
        assert.equal(u.searchParams.get('destination'),s.query);
        assert.ok(s.parking.trim());assert.ok(s.fee.trim());
        for(const f of s.food){assert.equal(new URL(gmaps(f.query,true)).searchParams.get('destination'),f.query);assert.ok(safeURL(f.source));}
        checks++;
    }
}
for(const change of [s=>s.days[0].stops[0].lat=999,s=>s.days[0].stops[0].amount=-1,s=>s.days[0].stops.push(s.days[0].stops[0]),s=>s.days[0].stops[0].food='invalid',s=>s.travelers=0]){
    const candidate=JSON.parse(JSON.stringify(seed));change(candidate);assert.throws(()=>validateTrip(candidate));checks++;
}
assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(safeURL('data:text/html,test'),'');
assert.equal(esc('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
const day3=seed.days[2].stops;
for(const id of ['yuno','kuro','arimura','akamizu','aqua','sengan','night'])assert.ok(day3.some(s=>s.id===id));
assert.ok(seed.days[3].stops.some(s=>s.id==='budgetback'));
for(const f of ['public/vendor/leaflet.js','public/vendor/leaflet.css','public/vendor/supabase.js'])assert.ok(fs.statSync(new URL(f,root)).size>10000);
console.log(`PASS: ${checks+5} data/link/import safety checks; app syntax, map libraries, requested stops verified.`);
console.log('Supabase Auth/RPC integration requires a real project; not live-tested.');
