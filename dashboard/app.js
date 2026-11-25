'use strict';
const R=window.RADAR,$=id=>document.getElementById(id);
const money=n=>n===null||n===undefined?'Not reported':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const full=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const pct=n=>n===null?'Not reported':(n>0?'+':'')+n.toFixed(1)+'%';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
let visible=[],current;
function populate(id,values){for(const v of [...new Set(values)].sort())if(v)$(id).append(new Option(v,v))}
function textLine(parent,label,value){const p=el('p');p.append(el('strong',label+' '),document.createTextNode(value));parent.append(p)}
function openDetail(row){
 current=row;const d=$('detail-body');d.replaceChildren();const title=el('h2',row.name);title.id='detail-title';d.append(el('p',(row.category||'Unclassified')+' / '+row.chains.join(', '),'eyebrow'),title);
 d.append(el('p',row.slug+' · '+(row.watchlist?'Official watchlist · ':'')+(row.token_status||row.reason),'note'));
 if(row.implied_value_usd){
  const grid=el('div',undefined,'detail-grid'),numbers=el('section'),plan=el('section');grid.append(numbers,plan);d.append(grid);
  const values=el('div',undefined,'values');for(const [name,n]of[['Low scenario',row.value_low_usd],['Base scenario',row.implied_value_usd],['High scenario',row.value_high_usd]]){const v=el('div');v.append(el('span',name),el('strong',money(n)),el('small',full(n)));values.append(v)}numbers.append(values);
  const metrics=el('div',undefined,'evidence');for(const [k,v]of[['TVL',full(row.tvl_usd)],['7-day change',pct(row.change_7d)],['Tracking history',row.age_days===null?'Not reported':row.age_days+' days'],['Reference multiple',row.peer_ratio.toFixed(3)+' × TVL'],['Growth adjustment',row.growth_factor.toFixed(3)+'×'],['Maturity adjustment',row.maturity_factor.toFixed(3)+'×']])textLine(metrics,k,v);numbers.append(metrics);
  numbers.append(el('h3','What this estimate assumes'),el('p',R.model.formula),el('p',row.peer_scope+'; '+row.peer_pool_size+' eligible peers. The interval is a scenario range, not a confidence interval.','note'));
  numbers.append(el('h3','Closest comparable records'));for(const peer of row.peers){const p=el('div',undefined,'peer');p.append(el('span',peer.name+' · '+peer.slug),el('span',peer.ratio.toFixed(3)+'× · '+money(peer.mcap_usd)+' MCap','num'));numbers.append(p)}
  const warnings=el('ul',undefined,'warnings');row.warnings.forEach(v=>warnings.append(el('li',v)));numbers.append(warnings);
  plan.append(el('h3','Farm research plan'),el('p','Start with $0 read-only research. Optional capital actions require independent approval; no allocation or reward is assumed.','note'));
  const steps=el('ol');row.farm_steps.forEach(v=>steps.append(el('li',v)));plan.append(steps);
 }else{
  textLine(d,'TVL',full(row.tvl_usd));textLine(d,'Recorded market cap',money(row.mcap_usd));if(row.data_quality)row.data_quality.forEach(v=>d.append(el('p',v,'warnings')));d.append(el('p','Set aside: '+row.reason+'. Not presented as a new token opportunity. Recheck the underlying record and official project before drawing conclusions.'));
 }
 d.append(el('p',R.source+' · sealed, not live.','note'));
 if(typeof $('detail').showModal==='function')$('detail').showModal();else{$('detail').setAttribute('open','');d.prepend(el('p','Dialog support is unavailable; use Close details to return.'))}
}
function render(){
 const q=$('search').value.trim().toLocaleLowerCase('en'),category=$('category').value,chain=$('chain').value,view=$('view').value;
 const set=view==='recorded'?R.set_aside.filter(r=>r.reason==='Token recorded'):view==='excluded'?R.set_aside.filter(r=>r.reason!=='Token recorded'):view==='watch'?R.rows.filter(r=>r.watchlist):R.rows;
 visible=set.filter(r=>(!q||(r.name+' '+r.slug+' '+r.chains.join(' ')).toLocaleLowerCase('en').includes(q))&&(!category||r.category===category)&&(!chain||r.chains.includes(chain)));
 const sort=$('sort').value,key={value:'implied_value_usd',tvl:'tvl_usd',growth:'change_7d',age:'age_days'}[sort];
 visible.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'en'):((b[key]??-Infinity)-(a[key]??-Infinity))||a.slug.localeCompare(b.slug,'en'));
 $('rows').replaceChildren();
 for(const r of visible){
  const tr=el('tr');tr.dataset.slug=r.slug;const th=el('th');th.scope='row';const b=el('button',(r.rank?'#'+r.rank+' ':'')+r.name,'protocol');b.type='button';b.addEventListener('click',()=>openDetail(r));th.append(b,el('span',r.category||'Unclassified','sub'),el('span',r.chains.join(' · '),'sub'));if(r.watchlist)th.append(el('span','REQUIRED WATCHLIST','watch'));tr.append(th);
  const value=el('td',r.implied_value_usd?money(r.implied_value_usd):'Not a launch estimate','num');value.append(el('span',r.implied_value_usd?money(r.value_low_usd)+' – '+money(r.value_high_usd):'MCap '+money(r.mcap_usd),'sub'));tr.append(value,el('td',money(r.tvl_usd),'num'),el('td',pct(r.change_7d),'num '+(r.change_7d<0?'down':'up')),el('td',r.age_days===null||r.age_days===undefined?'Not reported':r.age_days+'d','num'));
  const evidence=el('td');evidence.append(el('span',r.token_status||r.reason),el('span',r.peer_scope||'Excluded from ranking','sub'));tr.append(evidence);$('rows').append(tr);
 }
 $('result').textContent=visible.length+' of '+set.length+' records · '+(view==='recorded'?'Token-recorded comparables, not launch candidates':view==='excluded'?'Potential wrappers / versions excluded; parent links unavailable':'Rank remains the original descending-value rank');
 $('empty').hidden=visible.length>0;
}
if(!R){$('result').textContent='Missing sealed data. Run main.ts and open output/dashboard/index.html.'}else{
 $('origin').textContent='As of '+R.as_of+' UTC · '+R.protocol_count+' protocols · DefiLlama sealed snapshot';
 $('candidates').textContent=R.rows.length;$('coverage').textContent=R.rows.filter(r=>r.watchlist).length+'/'+R.watchlist.length;$('aside').textContent=R.set_aside.length;
 const method=$('method-content');for(const [k,v]of Object.entries(R.model))textLine(method,k,v);textLine(method,'Sanity check',R.calibration.n+' leave-one-out token records; median multiplicative reconstruction error '+R.calibration.median_multiplicative_error.toFixed(2)+'×. '+R.calibration.method);
 populate('category',[...R.rows,...R.set_aside].map(r=>r.category));populate('chain',[...R.rows,...R.set_aside].flatMap(r=>r.chains));
 for(const id of ['search','category','chain','view','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
 $('reset').addEventListener('click',()=>{for(const id of ['search','category','chain'])$(id).value='';$('view').value='candidates';$('sort').value='value';render()});
 $('export').addEventListener('click',()=>{const a=el('a');const url=URL.createObjectURL(new Blob([JSON.stringify({as_of:R.as_of,source:R.source,rows:visible},null,2)],{type:'application/json'}));a.href=url;a.download='token-radar-'+R.as_of+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
 render();
}
