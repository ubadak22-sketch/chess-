/* UI + game flow. Needs: Chess (chess.js), DB (db.js), PUZZLES (data/puzzles.js). */
(()=>{
const $=id=>document.getElementById(id),C=Chess;
const LV={1:['Beginner',1,200],2:['Easy',2,80],3:['Medium',3,15],4:['Hard',4,0]}; // [name, depth, randomness]
const NM={K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight',P:'pawn'};
const z=()=>({w:0,l:0,d:0}),pts=r=>20*r.w-5*r.l,side=c=>c==='w'?'White':'Black';
let S={hints:true,anim:!matchMedia('(prefers-reduced-motion: reduce)').matches},G=null,T=null,PZ=null,sel=null,pend=null,q=Promise.resolve();
const worker=new Worker('js/worker.js'),wp={};let wid=0;
worker.onmessage=e=>{wp[e.data.id](e.data);delete wp[e.data.id]};
const ask=(s,depth,noise)=>new Promise(r=>{wp[++wid]=r;worker.postMessage({id:wid,s,depth,noise})});
const legalFrom=(s,i)=>C.legal(s).filter(m=>m.f===i);
const cur=()=>G.states[G.states.length-1];
const resTxt=r=>r.w?side(r.w)+' wins by '+r.why:'Draw by '+r.why;
const saveS=()=>DB.set('settings',S).catch(console.warn);

/* ---- board drawing + animation ---- */
function draw(el,s,o){const ck=C.inCheck(s)?s.b.indexOf(s.t==='w'?'K':'k'):-1;el.innerHTML='';
 for(let n=0;n<64;n++){const i=o.flip?63-n:n,p=s.b[i],b=document.createElement('button');
  b.className='sq '+(((i>>3)+(i&7))%2?'d':'l')+(o.sel===i?' sel':'')+(o.last&&o.last.includes(i)?' last':'')+(i===ck?' chk':'')+(o.hints.includes(i)?' hint':'');
  b.dataset.i=i;b.setAttribute('aria-label',C.sqn(i)+(p===' '?', empty':', '+side(C.col(p)).toLowerCase()+' '+NM[p.toUpperCase()]));
  if(p!==' ')b.innerHTML='<span class="pc '+C.col(p)+'">'+C.GL[p.toUpperCase()]+'</span>';
  el.append(b)}}
function anim(el,a,b){if(!S.anim)return;const A=el.querySelector(`[data-i="${a}"]`),B=el.querySelector(`[data-i="${b}"]`),p=B&&B.querySelector('.pc');if(!p||!A)return;
 const r1=A.getBoundingClientRect(),r2=B.getBoundingClientRect();
 p.style.transition='none';p.style.transform=`translate(${r1.left-r2.left}px,${r1.top-r2.top}px)`;p.getBoundingClientRect();
 p.style.transition='transform .25s ease';p.style.transform=''}

/* ---- game state ---- */
function rebuild(){let s=C.fromFen(G.start);G.states=[s];G.keys=[C.key(s)];G.info=[];
 for(const u of G.moves){const m=C.parse(s,u),n=C.make(s,m);G.info.push(C.describe(s,m,n));s=n;G.states.push(s);G.keys.push(C.key(s))}
 G.i=G.states.length-1}
const save=(g=G)=>q=q.then(async()=>{const o={mode:g.mode,human:g.human,level:g.level,start:g.start,moves:g.moves.slice(),done:g.done,result:g.result,counted:g.counted,date:g.date};
 if(g.id)o.id=g.id;g.id=await DB.putGame(o)}).catch(console.warn);
async function addStats(g){if(g.counted)return;g.counted=true; // counted flag set first: points are awarded once
 const st=(await DB.get('stats'))||{pvp:{w:z(),b:z()},pva:{w:z(),b:z()}},m=st[g.mode],win=g.result.w;
 if(g.mode==='pvp')for(const c of['w','b'])m[c][win?(win===c?'w':'l'):'d']++;else m[g.human][win?(win===g.human?'w':'l'):'d']++;
 await DB.set('stats',st)}
function finish(st){G.done=true;G.result={w:st.winner||null,why:st.reason};const g=G;addStats(g).catch(console.warn).then(()=>save(g))}
function newGame(){S.hints=$('hintsOpt').checked;$('setHints').checked=S.hints;saveS();
 G={mode:$('mode').value,human:$('color').value,level:+$('level').value,start:C.START,moves:[],done:false,result:null,counted:false,date:Date.now(),rp:false};
 rebuild();sel=pend=null;$('analysis').hidden=true;save();render();aiTurn()}
async function openGame(id){clearInterval(T);G={...(await DB.game(id)),rp:false};rebuild();sel=pend=null;$('analysis').hidden=true;show('play');render();aiTurn()}
function play(m){const s=cur(),n=C.make(s,m);G.info.push(C.describe(s,m,n));G.moves.push(C.uci(m));G.states.push(n);G.keys.push(C.key(n));G.i=G.states.length-1;sel=null;
 const st=C.status(n,G.keys);if(st.over)finish(st);else save();render();anim($('board'),m.f,m.t);aiTurn()}
function aiTurn(){const g=G;if(!g||g.done||g.mode!=='pva'||g.rp||cur().t===g.human||g.busy)return;
 g.busy=true;render();const[,d,nz]=LV[g.level];
 ask(cur(),d,nz).then(r=>{g.busy=false;if(G===g&&!g.done&&r.move)play(r.move);else if(G===g)render()})}

/* ---- play screen ---- */
function render(){$('setup').hidden=!!G;$('game').hidden=!G;
 const s=G?G.states[G.i]:C.fromFen(C.START),m=G&&G.i>0?C.parse(G.states[G.i-1],G.moves[G.i-1]):null,live=G&&!G.done&&!G.rp;
 draw($('board'),s,{flip:!!G&&G.mode==='pva'&&G.human==='b',sel:live?sel:null,hints:live&&S.hints&&sel!=null?legalFrom(s,sel).map(x=>x.t):[],last:m&&[m.f,m.t]});
 if(!G)return;
 $('status').textContent=G.rp?`Replay: move ${G.i} of ${G.moves.length}`:G.done?'Game over — '+resTxt(G.result):`${side(s.t)} to move${C.inCheck(s)?' — check!':''}${G.busy?' (AI is thinking…)':''}`;
 $('promo').hidden=!pend;if(pend)$('promo').innerHTML='Promote to: '+pend.map(x=>`<button data-p="${x.p}">${C.GL[x.p]} ${NM[x.p]}</button>`).join('');
 $('playBar').hidden=G.done;$('finBar').hidden=!G.done||G.rp;$('rpBar').hidden=!G.rp;
 $('rpPlay').disabled=!!G.playing;$('rpPause').disabled=!G.playing;$('rpPrev').disabled=G.i===0;$('rpNext').disabled=G.i===G.moves.length;
 $('replayBtn').disabled=$('analyzeBtn').disabled=!G.moves.length;
 let h='';for(let k=0;k<G.info.length;k+=2){const c=j=>G.info[j]?`<td class="${G.rp&&G.i===j+1?'cur':''}">${G.info[j].text}</td>`:'<td></td>';h+=`<tr><td>${k/2+1}</td>${c(k)}${c(k+1)}</tr>`}
 $('hb').innerHTML=h||'<tr><td colspan="3">No moves yet — White moves first.</td></tr>'}
$('board').onclick=e=>{const b=e.target.closest('.sq');if(!b||!G||G.done||G.rp||G.busy||pend)return;
 const s=cur(),i=+b.dataset.i;if(G.mode==='pva'&&s.t!==G.human)return;
 const ms=sel!=null?legalFrom(s,sel).filter(m=>m.t===i):[];
 if(ms.length){if(ms.length>1){pend=ms;sel=null;render()}else play(ms[0]);return}
 const p=s.b[i];sel=p!==' '&&C.col(p)===s.t?i:null;render()};
$('promo').onclick=e=>{const p=e.target.dataset.p;if(!p)return;const m=pend.find(x=>x.p===p);pend=null;play(m)};
$('start').onclick=newGame;
$('mode').onchange=()=>document.querySelectorAll('.ai').forEach(l=>l.hidden=$('mode').value!=='pva');
document.querySelectorAll('.newgame').forEach(b=>b.onclick=()=>{clearInterval(T);G=null;sel=pend=null;$('analysis').hidden=true;render()});
$('resign').onclick=()=>{if(!confirm('Resign this game?'))return;const loser=G.mode==='pva'?G.human:cur().t;finish({winner:loser==='w'?'b':'w',reason:'resignation'});render()};

/* ---- replay ---- */
function go(i){if(!G||!G.rp)return false;const o=G.i;G.i=Math.max(0,Math.min(G.moves.length,i));if(G.i===o)return false;render();
 if(G.i===o+1){const m=C.parse(G.states[o],G.moves[o]);anim($('board'),m.f,m.t)}
 else if(G.i===o-1){const m=C.parse(G.states[G.i],G.moves[G.i]);anim($('board'),m.t,m.f)}return true}
function rpPause(){clearInterval(T);G.playing=false;render()}
function rpPlay(){if(G.i>=G.moves.length)go(0);clearInterval(T);G.playing=true;T=setInterval(()=>{if(!go(G.i+1))rpPause()},S.anim?900:600);render()}
function rpStop(){clearInterval(T);G.rp=G.playing=false;G.i=G.states.length-1;render()}
$('replayBtn').onclick=()=>{G.rp=true;G.i=0;render()};
$('rpPlay').onclick=rpPlay;$('rpPause').onclick=rpPause;$('rpStop').onclick=rpStop;
$('rpPrev').onclick=()=>{if(G.playing)rpPause();go(G.i-1)};$('rpNext').onclick=()=>{if(G.playing)rpPause();go(G.i+1)};
addEventListener('keydown',e=>{if(!G||!G.rp||$('v-play').hidden||/SELECT|INPUT/.test(e.target.tagName))return;
 if(e.key==='ArrowRight'){if(G.playing)rpPause();go(G.i+1)}else if(e.key==='ArrowLeft'){if(G.playing)rpPause();go(G.i-1)}});

/* ---- analysis (local engine, depth 2 — quick and shallow) ---- */
$('analyzeBtn').onclick=async()=>{const g=G,o=$('analysis'),P=[],B=[];o.hidden=false;
 for(let k=0;k<g.states.length;k++){o.textContent=`Analyzing position ${k+1} of ${g.states.length}…`;const r=await ask(g.states[k],2,0);if(G!==g)return;P.push(r.score);B.push(r.move?C.uci(r.move):'')}
 const cl=v=>Math.max(-1500,Math.min(1500,v));
 const rows=g.moves.map((u,k)=>{const l=cl(P[k])+cl(P[k+1]),lab=u===B[k]||l<=15?'Good':l<70?'OK':l<150?'Inaccuracy':l<300?'Mistake':'Blunder',
  w=cl(P[k+1])*(g.states[k+1].t==='w'?1:-1),pc=Math.round(100/(1+Math.pow(10,-w/400)));
  return`<li class="${lab}">${side(k%2?'b':'w')} ${g.info[k].text} — <b>${lab}</b> · White ≈ ${pc}%</li>`}).join('');
 o.innerHTML='<h3>Engine analysis</h3><p class="note">Percentages are <b>engine estimates</b>, not guaranteed odds: they depend on the position and on this small engine\'s search depth (2 moves here), so treat labels as hints, not verdicts.</p><ol>'+rows+'</ol>'};

/* ---- views ---- */
function show(v){if(v!=='play'&&G&&G.playing)rpPause();
 document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!=='v-'+v);
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
 if(v==='games')gamesView();if(v==='stats')statsView();if(v==='puzzles'&&!PZ&&PUZZLES.length)loadPz(0)}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
async function gamesView(){let gs=[];try{gs=(await DB.games()).sort((a,b)=>b.date-a.date)}catch(e){}
 $('glist').innerHTML=gs.length?gs.map(g=>`<li><span>${new Date(g.date).toLocaleString()} · ${g.mode==='pva'?'vs AI ('+LV[g.level][0]+')':'2 players'} · ${g.moves.length} moves · ${g.done?resTxt(g.result):'unfinished'}</span><button data-id="${g.id}">${g.done?'Replay / analyze':'Resume'}</button></li>`).join(''):'<li>No saved games yet. Start one from the Play tab — games save automatically.</li>'}
$('glist').onclick=e=>{if(e.target.dataset.id)openGame(+e.target.dataset.id)};
const row=(n,r)=>`<tr><td>${n}</td><td>${r.w+r.l+r.d}</td><td>${r.w}</td><td>${r.l}</td><td>${r.d}</td><td><b>${pts(r)}</b></td></tr>`;
async function statsView(){let st=null;try{st=await DB.get('stats')}catch(e){}st=st||{pvp:{w:z(),b:z()},pva:{w:z(),b:z()}};let h='',all=0;
 for(const[m,n]of[['pva','Player vs AI (your results)'],['pvp','Player vs Player (results by seat)']]){const t=z();let rows='';
  for(const c of['w','b']){for(const k in t)t[k]+=st[m][c][k];rows+=row(side(c),st[m][c])}all+=pts(t);
  h+=`<h3>${n}</h3><table><thead><tr><th>Side</th><th>Games</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Points</th></tr></thead><tbody>${rows}${row('Total',t)}</tbody></table>`}
 $('stbox').innerHTML=h;$('total').textContent='Total points: '+all+' (20 × wins − 5 × losses)'}
$('export').onclick=async()=>{const d={app:'offline-chess',exported:new Date().toISOString(),settings:S,stats:await DB.get('stats'),games:await DB.games()};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'}));a.download='chess-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('setHints').onchange=e=>{S.hints=e.target.checked;$('hintsOpt').checked=S.hints;saveS();render()};
$('setAnim').onchange=e=>{S.anim=e.target.checked;saveS()};

/* ---- puzzles ---- */
function pzRender(){draw($('pboard'),PZ.s,{flip:PZ.flip,sel:PZ.sel,hints:S.hints&&PZ.sel!=null&&!PZ.done?legalFrom(PZ.s,PZ.sel).map(m=>m.t):[],last:PZ.last})}
function loadPz(k){const p=PUZZLES[k],s=C.fromFen(p.fen);PZ={p,s,i:0,sel:null,last:null,flip:s.t==='b',done:false};$('pmsg').textContent=`${side(s.t)} to move — ${p.title}`;pzRender()}
$('plist').innerHTML=PUZZLES.length?PUZZLES.map((p,k)=>`<li><button data-k="${k}">${p.title}</button></li>`).join(''):'<li>No puzzles yet — add some in data/puzzles.js.</li>';
$('plist').onclick=e=>{if(e.target.dataset.k)loadPz(+e.target.dataset.k)};
$('pboard').onclick=e=>{const b=e.target.closest('.sq');if(!b||!PZ||PZ.done)return;const i=+b.dataset.i,ms=PZ.sel!=null?legalFrom(PZ.s,PZ.sel).filter(m=>m.t===i):[];
 if(ms.length){const m=ms.find(x=>x.p==='Q')||ms[0];PZ.sel=null;
  if(C.uci(m)===PZ.p.solution[PZ.i]){PZ.s=C.make(PZ.s,m);PZ.i++;PZ.last=[m.f,m.t];
   if(PZ.i>=PZ.p.solution.length){PZ.done=true;$('pmsg').textContent='Solved! ✔'}
   else{const r=C.parse(PZ.s,PZ.p.solution[PZ.i]);PZ.s=C.make(PZ.s,r);PZ.i++;PZ.last=[r.f,r.t];$('pmsg').textContent='Correct — keep going.'}}
  else $('pmsg').textContent='Not the best move. Try again.'}
 else{const p=PZ.s.b[i];PZ.sel=p!==' '&&C.col(p)===PZ.s.t?i:null}pzRender()};

/* ---- init ---- */
render();show('play');
(async()=>{try{Object.assign(S,(await DB.get('settings'))||{})}catch(e){console.warn('Storage unavailable',e)}
 $('hintsOpt').checked=$('setHints').checked=S.hints;$('setAnim').checked=S.anim;render()})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(console.warn);
})();
