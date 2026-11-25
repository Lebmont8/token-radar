import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{parseSnapshot,buildRadar,scriptData}from'./model.ts';
const here=fileURLToPath(new URL('.',import.meta.url));const i=process.argv.indexOf('--output');if(i<0||!process.argv[i+1])throw Error('Pass --output EMPTY_DIR');const out=process.argv[i+1];
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output must be empty');const data=buildRadar(parseSnapshot(fs.readFileSync(path.join(here,'input/snapshot.json'),'utf8')));
fs.mkdirSync(out,{recursive:true});fs.cpSync(path.join(here,'dashboard'),path.join(out,'dashboard'),{recursive:true});fs.writeFileSync(path.join(out,'data.js'),scriptData(data));fs.writeFileSync(path.join(out,'preview.json'),JSON.stringify({rows:data.rows.length,watchlist:data.watchlist.length,calibration:data.calibration}));
console.log(JSON.stringify({rows:data.rows.length,watchlist:data.watchlist.length,calibration:data.calibration}));
