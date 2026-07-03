import fs from 'fs';
const text=fs.readFileSync('contas_export.csv','utf8').replace(/^﻿/,'');
function parseCSVLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;}
function norm(s){return (s||'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[\s\n\r"]+/g,'');}
const COLS=["name","csm","plan","mrrStart","mrrNow","seatsEnt","seatsAct","loginFreq","lastContact","champion","contacts","tickets","critTickets","csat","nps","pay","stage","renewalDays"];
const NUMERIC=new Set(['mrrStart','mrrNow','seatsEnt','seatsAct','loginFreq','lastContact','contacts','tickets','critTickets','csat','nps','renewalDays']);
function toNum(v){if(v==null||v==='')return 0;const n=parseFloat((''+v).replace(/[^0-9,\-]/g,'').replace(',','.'));return isNaN(n)?0:n;}
function detectKey(h){const n=norm(h);
  if(n==='conta')return 'name';if(n==='csm')return 'csm';if(n==='plano')return 'plan';
  if(n.includes('inicial'))return 'mrrStart';if(n.includes('mrr')&&n.includes('atual'))return 'mrrNow';
  if(n.includes('contratad'))return 'seatsEnt';if(n.includes('licenc')&&n.includes('ativ'))return 'seatsAct';
  if(n.includes('login'))return 'loginFreq';if(n.includes('contato'))return 'lastContact';
  if(n.includes('champion'))return 'champion';if(n.includes('engajad'))return 'contacts';
  if(n.includes('aberto'))return 'tickets';if(n.includes('critic'))return 'critTickets';
  if(n.includes('csat'))return 'csat';if(n.includes('nps'))return 'nps';
  if(n.includes('pagamento'))return 'pay';if(n.includes('estagio')||n.includes('jornada'))return 'stage';
  if(n.includes('renova'))return 'renewalDays';return null;}
function rowToObj(r){const o={};COLS.forEach((k,i)=>o[k]=r[i]);o.champion=(''+o.champion).trim().toLowerCase().startsWith('s');o.pay=(''+o.pay).toLowerCase().includes('atras')?'late':'ok';return o;}
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
function enrich(a){const seatUtil=a.seatsEnt?a.seatsAct/a.seatsEnt:0;
  const sAdocao=clamp(0.6*(seatUtil*100)+0.4*a.loginFreq);
  const sRelac=clamp((a.champion?45:0)+clamp(a.contacts*10,0,30)+clamp(25-(a.lastContact/3),0,25));
  const sSupp=clamp(0.5*a.csat+0.3*clamp(100-a.tickets*12)+0.2*clamp(100-a.critTickets*40));
  const sCom=clamp((a.pay==='ok'?60:20)+(a.mrrNow>=a.mrrStart?40:(a.mrrNow>=a.mrrStart*0.85?20:0)));
  const sSent=clamp((a.nps+100)/2);
  const health=Math.round(0.35*sAdocao+0.20*sRelac+0.20*sSupp+0.15*sCom+0.10*sSent);
  let churn=(1-seatUtil)*25+(a.loginFreq<40?15:(a.loginFreq<60?7:0))+(a.champion?0:18)+(a.contacts<=1?10:0)+clamp(a.lastContact/4,0,18)+a.critTickets*8+(a.mrrNow<a.mrrStart?12:0)+(a.pay==='late'?10:0)+(a.nps<0?8:0);
  churn=Math.round(clamp(churn));const renewalDays=a.renewalDays||0;
  let farol='verde';if(health>=45&&health<70)farol='amarelo';if(churn>=45&&churn<65&&farol==='verde')farol='amarelo';
  if(health<45||churn>=65||(renewalDays<=60&&renewalDays>0&&health<60&&a.mrrNow>0))farol='vermelho';if(a.mrrNow===0)farol='vermelho';
  return {...a,seatUtil,health,churn,farol};}

const lines=text.split(/\r?\n/).filter(l=>l.trim()!=='');
let hi=-1;for(let i=0;i<8;i++){const cells=parseCSVLine(lines[i]).map(norm);if(cells.includes('conta')&&cells.includes('csm')){hi=i;break;}}
const headers=parseCSVLine(lines[hi]);const map=headers.map(detectKey);
console.log('header detection:',map.filter(x=>x).length,'of 18 input cols mapped');
console.log('unmapped count (calc cols expected ~11):',map.filter(x=>!x).length);
const rows=[];
for(let i=hi+1;i<lines.length;i++){const cells=parseCSVLine(lines[i]);const o={};map.forEach((k,j)=>{if(k)o[k]=cells[j];});if(!o.name||!o.name.trim())continue;rows.push(COLS.map(k=>{const v=o[k];if(NUMERIC.has(k))return toNum(v);return v!=null?v.trim():'';}));}
const DATA=rows.map(rowToObj).map(enrich);
console.log('rows parsed:',DATA.length);
console.log('first 3:',DATA.slice(0,3).map(d=>({n:d.name,health:d.health,churn:d.churn,farol:d.farol})));
const start=DATA.reduce((s,d)=>s+d.mrrStart,0),now=DATA.reduce((s,d)=>s+d.mrrNow,0);
console.log('NRR:',(now/start*100).toFixed(1)+'%  (planilha esperava ~102.4%)');
console.log('mrrStart sum:',start,' mrrNow sum:',now);
