import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';import{parseSnapshot,buildRadar,scriptData}from'./model.ts';import{buildDossier}from'./vendor/makefun-board.ts';
const here=fileURLToPath(new URL('.',import.meta.url));
function arg(k:string,defaultValue:string){const i=process.argv.indexOf('--'+k);if(i>=0){if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Missing '+k);return process.argv[i+1]}return defaultValue}
try{
 let input=arg('input','/input/snapshot.json');if(fs.existsSync(input)&&fs.statSync(input).isDirectory())input=path.join(input,'snapshot.json');
 const out=path.resolve(arg('output',process.env.MAKEFUN_OUTPUT_DIR??'/output'));
 if(fs.statSync(input).size>8*1024*1024)throw Error('Snapshot over 8MiB');
 const snap=parseSnapshot(fs.readFileSync(input,'utf8')),radar=buildRadar(snap);
 // Refuse stale/partially written output rather than merge files from another generation.
 if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output directory must be empty');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'board.json'),JSON.stringify({rows:radar.rows})+'\n');
 fs.writeFileSync(path.join(out,'data.js'),scriptData(radar));
 for(const folder of ['dashboard','screenshots']){
  const src=path.join(here,folder),to=path.join(out,folder);fs.mkdirSync(to,{recursive:true});
  if(!fs.existsSync(src))throw Error('Missing '+folder);
  for(const name of fs.readdirSync(src).sort()){
   const p=path.join(src,name);if(!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name)||!fs.lstatSync(p).isFile())throw Error('Non-plain asset: '+name);
   fs.copyFileSync(p,path.join(to,name));
  }
 }
 const shots=fs.readdirSync(path.join(out,'screenshots'));if(shots.length!==3)throw Error('Exactly three genuine screenshots required');
 fs.writeFileSync(path.join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
 const size=fs.statSync(path.join(out,'dossier.json')).size;if(size>1572864)throw Error('Dossier exceeds1.5MiB');
 console.log(JSON.stringify({rows:radar.rows.length,watchlist:snap.watchlist.length,dossier_bytes:size,calibration:radar.calibration}));
}catch(e){console.error((e as Error).message);process.exitCode=2}
