// Original snapshot-only, auditable valuation. No live prices, keys, predictions or transactions.
export type Protocol={slug:string,name:string,category:string|null,chains:string[],tvl_usd:number,change_7d:number|null,mcap_usd:number|null,listed_at:string|null,gecko_id:string|null,symbol:string|null,data_quality?:string[],source_mcap_usd?:number};
export type Snapshot={as_of:string,source:string,floor_usd:number,protocols:Protocol[],watchlist:string[]};
const excludedCategories=new Set(['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','CEX','Stablecoin Wrapper','Cross Chain Bridge']);
export function parseSnapshot(text:string):Snapshot{
 const s=JSON.parse(text);if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s.as_of)||!Number.isFinite(Date.parse(s.as_of+'T00:00:00Z'))||typeof s.source!=='string'||!Array.isArray(s.protocols)||s.protocols.length>10000||!Array.isArray(s.watchlist))throw Error('Invalid snapshot header');
 const seen=new Set();for(const p of s.protocols){
  if(!p||typeof p.slug!=='string'||!/^\S{1,128}$/.test(p.slug)||seen.has(p.slug)||typeof p.name!=='string'||!p.name.trim()||!Number.isSafeInteger(p.tvl_usd)||p.tvl_usd<=0||!Array.isArray(p.chains)||!p.chains.every((v:unknown)=>typeof v==='string')||!(p.category===null||typeof p.category==='string'))throw Error('Invalid or duplicate protocol');
  for(const k of ['gecko_id','symbol','listed_at'])if(!(p[k]===null||typeof p[k]==='string'))throw Error('Invalid text field');
  for(const k of ['change_7d','mcap_usd'])if(!(p[k]===null||typeof p[k]==='number'&&Number.isFinite(p[k])))throw Error('Invalid numeric field');
  if(p.mcap_usd===-1){p.source_mcap_usd=-1;p.mcap_usd=null;p.data_quality=['Source market cap sentinel -1: unusable, excluded from peers.'];}else if(p.mcap_usd!==null&&p.mcap_usd<0)throw Error('Negative capitalization');seen.add(p.slug);
 }
 if(new Set(s.watchlist).size!==s.watchlist.length||s.watchlist.some((x:unknown)=>typeof x!=='string'||!seen.has(x)))throw Error('Invalid watchlist');
 return s;
}
export const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
export function quantile(values:number[],q:number):number{
 if(!values.length)throw Error('No observations');const a=values.slice().sort((a,b)=>a-b),i=(a.length-1)*q,j=Math.floor(i);return a[j]+(a[Math.ceil(i)]-a[j])*(i-j);
}
export function tokenRecorded(p:Protocol){return !!p.symbol?.trim()||!!p.gecko_id?.trim()||(p.mcap_usd!==null&&p.mcap_usd>0);}
export function exclusion(p:Protocol):string|null{
 if(tokenRecorded(p))return 'Token recorded';
 if(excludedCategories.has(p.category??''))return 'Wrapper / bridge / exchange category';
 if(/\b(wrapped|staked|staking)\b/i.test(p.name)||/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name))return 'Wrapper / exchange name';
 if(/\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name))return 'Versioned record: parent not in snapshot';
 return null;
}
export function ageDays(p:Protocol,asOf:string):number|null{
 if(!p.listed_at||!/^\d{4}-\d{2}-\d{2}$/.test(p.listed_at))return null;
 const n=(Date.parse(asOf+'T00:00:00Z')-Date.parse(p.listed_at+'T00:00:00Z'))/86400000;return Number.isFinite(n)&&n>=0?Math.floor(n):null;
}
function weightedQuantile(peers:{ratio:number,weight:number}[],q:number){
 const a=peers.slice().sort((a,b)=>a.ratio-b.ratio),total=a.reduce((n,p)=>n+p.weight,0);let sum=0;
 for(const p of a){sum+=p.weight;if(sum>=q*total)return p.ratio}return a.at(-1)!.ratio;
}
export function estimate(p:Protocol,all:Protocol[],asOf:string){
 const available=all.filter(x=>x.slug!==p.slug&&tokenRecorded(x)&&x.mcap_usd!==null&&x.mcap_usd>0&&x.tvl_usd>0&&x.mcap_usd/x.tvl_usd>=0.001&&x.mcap_usd/x.tvl_usd<=100);
 if(available.length<5)throw Error('At least five token-bearing comparables required');
 const sector=available.filter(x=>x.category===p.category),useSector=sector.length>=5;
 const pool=useSector?sector:available;
 const nearest=pool.map(x=>({p:x,distance:Math.abs(Math.log(x.tvl_usd/p.tvl_usd)),ratio:x.mcap_usd!/x.tvl_usd})).sort((a,b)=>a.distance-b.distance||a.p.slug.localeCompare(b.p.slug,'en')).slice(0,15);
 const lo=quantile(pool.map(x=>x.mcap_usd!/x.tvl_usd),.1),hi=quantile(pool.map(x=>x.mcap_usd!/x.tvl_usd),.9);
 const weighted=nearest.map(x=>({ratio:clamp(x.ratio,lo,hi),weight:1/(1+x.distance)}));
 const ratio=weightedQuantile(weighted,.5),growth=clamp(1+(p.change_7d??0)/400,.8,1.2),age=ageDays(p,asOf);
 // Age tracks history length, never a probability of issuance. Caps avoid extrapolating one volatile week.
 const maturity=age===null?.9:.8+.2*Math.min(age/730,1),factor=growth*maturity;
 const base=Math.round(clamp(p.tvl_usd*ratio*factor,1,1e14));
 const low=Math.round(clamp(Math.min(base,p.tvl_usd*weightedQuantile(weighted,.25)*factor*.65),1,1e14));
 const high=Math.round(clamp(Math.max(base,p.tvl_usd*weightedQuantile(weighted,.75)*factor*1.5),1,1e14));
 const warnings=[...(p.data_quality??[]),'No parentProtocol field: independent launch eligibility is unverified.'];
 if(p.change_7d===null)warnings.push('Missing growth: neutral multiplier.');
 if(age===null)warnings.push('Missing or future listing date: conservative maturity 0.90.');
 if(!useSector)warnings.push('Sparse sector: cross-category comparables.');
 if(p.change_7d!==null&&Math.abs(p.change_7d)>80)warnings.push('Extreme weekly TVL movement: inspect data quality.');
 return {base,low,high,ratio,growth,maturity,age,scope:useSector?'Same category':'Cross-category fallback',pool_size:pool.length,peers:nearest.slice(0,5).map(x=>({slug:x.p.slug,name:x.p.name,tvl_usd:x.p.tvl_usd,mcap_usd:x.p.mcap_usd,ratio:Math.round(x.ratio*1000)/1000})),warnings};
}
export function farmPlan(p:Protocol,watch:boolean){
 const c=p.category??'Unclassified',chain=p.chains[0]??'unreported chain';
 let action='Read the documented user action and its exit path; do not treat a TVL listing as access or eligibility.';
 if(/Lending|CDP|Collateral/.test(c))action='Inspect the supply market, collateral rules, withdrawal liquidity and oracle risks; do not borrow or add leverage for points.';
 else if(/Dex|Liquidity|Derivatives|Trading/.test(c))action='Inspect the swap or liquidity route and fee tier; calculate spread and impermanent loss before any optional manual trial. No leverage or wash volume.';
 else if(/RWA|Capital|Curator|Yield|Vault|Aggregator/.test(c))action='Inspect the vault mandate, curator, withdrawal queue and underlying counterparties; check deposit restrictions before any optional manual trial.';
 else if(/Restaking|Staking|Pool/.test(c))action='Inspect lockup, slashing exposure and withdrawal queue; no stake or signature until terms and loss limits are understood.';
 return [
  'Research '+p.name+' ('+p.slug+') for 15–25 min, $0 capital: find its official site through the DefiLlama record; match the exact protocol and '+chain+' network, then read current eligibility and exclusions.',
  action+' Allow 20–30 min of read-only inspection; $0 spent. The sealed snapshot cannot verify an official app, points program or reward.',
  'If eligible and independently approved, price a single $50–100 unleveraged trial and its complete exit first. Budget 15–30 min and chain fees separately; capital is at risk, fees are unknown, and this dashboard performs no transaction.',
  'Record dated activity and receipts once a week (5–10 min); stop if fees exceed your own cap, withdrawals fail, terms change or a signature is unclear. Do not create extra identities or repetitive volume.',
  watch?'Watchlist record, not an airdrop promise: recheck token status before using funds. After any announced launch, verify the official allocation and claim domain; do not sign unknown claims.':'Below-floor / additional research candidate: verify independent protocol ownership and token status first. After a genuine launch announcement, reassess the token and any official claim; never assume retroactive rewards.'
 ];
}
export function buildRadar(s:Snapshot){
 const watch=new Set(s.watchlist),rows:any[]=[],setAside:any[]=[];
 for(const p of s.protocols){
  const reason=exclusion(p);if(reason&&!watch.has(p.slug)){setAside.push({...p,reason});continue}
  const e=estimate(p,s.protocols,s.as_of);rows.push({...p,rank:0,implied_value_usd:e.base,value_low_usd:e.low,value_high_usd:e.high,watchlist:watch.has(p.slug),token_status:tokenRecorded(p)?'Record conflict: verify':'No token recorded',age_days:e.age,peer_ratio:e.ratio,growth_factor:e.growth,maturity_factor:e.maturity,peer_scope:e.scope,peer_pool_size:e.pool_size,peers:e.peers,warnings:[...e.warnings,...(reason?[reason+': official watchlist retained for coverage.']:[])],farm_steps:farmPlan(p,watch.has(p.slug))});
 }
 rows.sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug,'en'));rows.forEach((r,i)=>r.rank=i+1);
 if(rows.length<100)throw Error('Fewer than 100 independently classified candidates');
 const comps=s.protocols.filter(p=>tokenRecorded(p)&&p.mcap_usd!==null&&p.mcap_usd>0);
 const errors=comps.flatMap(p=>{try{return [Math.abs(Math.log(estimate(p,s.protocols,s.as_of).base/p.mcap_usd!))]}catch{return []}});
 return {as_of:s.as_of,source:s.source,watchlist:s.watchlist,protocol_count:s.protocols.length,rows,set_aside:setAside,calibration:{method:'Leave-one-out valuation of token-bearing records; identity excluded from own comparables. Descriptive reconstruction, NOT launch-price forecasting.',n:errors.length,median_abs_log_error:quantile(errors,.5),median_multiplicative_error:Math.exp(quantile(errors,.5))},model:{name:'Local peer × TVL, bounded growth and tracking-age adjustment',formula:'TVL × weighted median(MCap/TVL) × clamp(1 + weekly growth/400, 0.80, 1.20) × maturity',maturity:'0.80 + 0.20 × min(days tracked/730, 1); missing date uses 0.90',peers:'Up to 15 nearest log-TVL peers, weight 1/(1 + log-distance), same category when at least 5 observations; otherwise global. Ratios trimmed to 0.001…100 and winsorised at category 10th/90th percentiles.',range:'Weighted 25th × 0.65 and 75th × 1.5; scenario envelope, not a confidence interval.',limitations:'Market caps are circulating values, not FDV. TVL may double-count, tracking age is not launch age, parent links and reward programs are absent. Values are conditional scenarios, not income, issuance odds or verified eligibility.'}};
}
export function scriptData(data:unknown){return 'window.RADAR='+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';}
