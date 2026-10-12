/* UI + game flow. Needs: Chess (chess.js), DB (db.js), PUZZLES (data/puzzles.js). */
(()=>{
const $=id=>document.getElementById(id),$$=s=>document.querySelectorAll(s),C=Chess;
const LV={1:['Beginner',1,200],2:['Easy',2,80],3:['Medium',3,15],4:['Hard',4,0]}; // [name, depth, randomness]
const NM={K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight',P:'pawn'};
const OUT={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙\uFE0E'};
const DEF={hints:true,anim:!matchMedia('(prefers-reduced-motion: reduce)').matches,autosave:true,coords:true,sound:false,piece:'modern',board:'classic',theme:'dark'};
const z=()=>({w:0,l:0,d:0}),pts=r=>20*r.w-5*r.l,side=c=>c==='w'?'White':'Black';
let S={...DEF},G=null,T=null,PZ=null,sel=null,pend=null,q=Promise.resolve(),NG={mode:'pva',color:'w'},gf='all',pf='All',pk=0;
const worker=new Worker('js/worker.js'),wp={};let wid=0;
worker.onmessage=e=>{wp[e.data.id](e.data);delete wp[e.data.id]};
const ask=(s,depth,noise)=>new Promise(r=>{wp[++wid]=r;worker.postMessage({id:wid,s,depth,noise})});
const legalFrom=(s,i)=>C.legal(s).filter(m=>m.f===i);
const cur=()=>G.states[G.states.length-1];
const resTxt=r=>r.w?side(r.w)+' wins by '+r.why:'Draw by '+r.why;
const saveS=()=>DB.set('settings',S).catch(console.warn);
const fmt=n=>String(n/60|0).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function beep(){if(!S.sound)return;try{const a=beep.c||(beep.c=new AudioContext()),o=a.createOscillator(),g=a.createGain();o.frequency.value=440;g.gain.value=.05;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.06)}catch(e){}}

/* ---- settings / theme ---- */
function syncUI(){$('hintsOpt').checked=$('setHints').checked=S.hints;$('autoOpt').checked=S.autosave;$('setAnim').checked=S.anim;$('setCoords').checked=S.coords;$('setSound').checked=S.sound;$('setPiece').value=S.piece;$('setBoard').value=S.board;
 $$('#themes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===S.theme));
 $$('#modes .opt').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===NG.mode));
 $$('#colors button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===NG.color));
 $$('.ai').forEach(e=>e.hidden=NG.mode!=='pva');
 document.documentElement.dataset.theme=S.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):S.theme;document.documentElement.dataset.board=S.board}
const bind=(id,k,chk=1)=>$(id).onchange=e=>{S[k]=chk?e.target.checked:e.target.value;saveS();syncUI();render();if(PZ)pzRender()};
bind('setHints','hints');bind('setAnim','anim');bind('setCoords','coords');bind('setSound','sound');bind('setPiece','piece',0);bind('setBoard','board',0);
$('themes').onclick=e=>{if(e.target.dataset.t){S.theme=e.target.dataset.t;saveS();syncUI()}};
$('resetS').onclick=()=>{if(confirm('Reset all settings to defaults? Saved games and stats are kept.')){S={...DEF};saveS();syncUI();render()}};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncUI);

/* ---- board drawing + animation ---- */
function draw(el,s,o){const ck=C.inCheck(s)?s.b.indexOf(s.t==='w'?'K':'k'):-1;el.innerHTML='';el.classList.toggle('cls',S.piece==='classic');
 for(let n=0;n<64;n++){const i=o.flip?63-n:n,p=s.b[i],b=document.createElement('button');
  b.className='sq '+(((i>>3)+(i&7))%2?'d':'l')+(o.sel===i?' sel':'')+(o.last&&o.last.includes(i)?' last':'')+(i===ck?' chk':'')+(o.hints.includes(i)?' hint':'')+(o.hm&&o.hm.includes(i)?' hm':'');
  b.dataset.i=i;b.setAttribute('aria-label',C.sqn(i)+(p===' '?', empty':', '+side(C.col(p)).toLowerCase()+' '+NM[p.toUpperCase()]));
  let h='';if(S.coords){if(n%8===0)h+=`<i class="co r">${8-(i>>3)}</i>`;if(n>>3===7)h+=`<i class="co f">${'abcdefgh'[i&7]}</i>`}
  if(p!==' ')h+=`<span class="pc ${C.col(p)}">${(S.piece==='classic'&&C.col(p)==='w'?OUT:C.GL)[p.toUpperCase()]}</span>`;
  b.innerHTML=h;el.append(b)}}
function anim(el,a,b){if(!S.anim)return;const A=el.querySelector(`[data-i="${a}"]`),B=el.querySelector(`[data-i="${b}"]`),p=B&&B.querySelector('.pc');if(!p||!A)return;
 const r1=A.getBoundingClientRect(),r2=B.getBoundingClientRect();
 p.style.transition='none';p.style.transform=`translate(${r1.left-r2.left}px,${r1.top-r2.top}px)`;p.getBoundingClientRect();
 p.style.transition='transform .25s ease';p.style.transform=''}

/* ---- game state ---- */
function rebuild(){let s=C.fromFen(G.start);G.states=[s];G.keys=[C.key(s)];G.info=[];G.clock={w:0,b:0};G.hint=null;
 for(const u of G.moves){const m=C.parse(s,u),n=C.make(s,m);G.info.push(C.describe(s,m,n));s=n;G.states.push(s);G.keys.push(C.key(s))}
 G.i=G.states.length-1}
const save=(g=G)=>q=q.then(async()=>{if(!S.autosave&&!g.done)return;
 const o={mode:g.mode,human:g.human,level:g.level,start:g.start,moves:g.moves.slice(),done:g.done,result:g.result,counted:g.counted,date:g.date};
 if(g.id)o.id=g.id;g.id=await DB.putGame(o)}).catch(console.warn);
async function addStats(g){if(g.counted)return;g.counted=true; // flag first: points are awarded once per game
 const st=(await DB.get('stats'))||{pvp:{w:z(),b:z()},pva:{w:z(),b:z()}},m=st[g.mode],win=g.result.w;
 if(g.mode==='pvp')for(const c of['w','b'])m[c][win?(win===c?'w':'l'):'d']++;else m[g.human][win?(win===g.human?'w':'l'):'d']++;
 await DB.set('stats',st)}
function finish(st){G.done=true;G.result={w:st.winner||null,why:st.reason};const g=G;addStats(g).catch(console.warn).then(()=>save(g))}
function newGame(){S.hints=$('hintsOpt').checked;S.autosave=$('autoOpt').checked;saveS();syncUI();
 G={mode:NG.mode,human:NG.color,level:+$('level').value,start:C.START,moves:[],done:false,result:null,counted:false,date:Date.now(),rp:false};
 rebuild();sel=pend=null;$('analysis').hidden=true;show('play');save();render();aiTurn()}
async function openGame(id){clearInterval(T);G={...(await DB.game(id)),rp:false};rebuild();sel=pend=null;$('analysis').hidden=true;show('play');aiTurn()}
function play(m){const s=cur(),n=C.make(s,m);G.info.push(C.describe(s,m,n));G.moves.push(C.uci(m));G.states.push(n);G.keys.push(C.key(n));G.i=G.states.length-1;sel=null;G.hint=null;
 const st=C.status(n,G.keys);if(st.over)finish(st);else save();render();anim($('board'),m.f,m.t);beep();aiTurn()}
function aiTurn(){const g=G;if(!g||g.done||g.mode!=='pva'||g.rp||cur().t===g.human||g.busy)return;
 g.busy=true;render();const[,d,nz]=LV[g.level];
 ask(cur(),d,nz).then(r=>{g.busy=false;if(G===g&&!g.done&&r.move)play(r.move);else if(G===g)render()})}
function undo(){if(!G||G.done||G.rp||G.busy||!G.moves.length)return;let n=1;
 if(G.mode==='pva')while(n<G.moves.length&&G.states[G.states.length-1-n].t!==G.human)n++;
 for(const a of[G.moves,G.info,G.states,G.keys])a.splice(-n);G.i=G.states.length-1;G.hint=null;sel=pend=null;save();render();aiTurn()}
function hint(){const g=G;if(!g||g.done||g.rp||g.busy||g.hbusy||(g.mode==='pva'&&cur().t!==g.human))return;
 g.hbusy=true;ask(cur(),2,0).then(r=>{g.hbusy=false;if(G===g&&r.move){g.hint=[r.move.f,r.move.t];render()}})}

/* ---- play screen ---- */
function render(){if(!G)return;
 const s=G.states[G.i],m=G.i>0?C.parse(G.states[G.i-1],G.moves[G.i-1]):null,live=!G.done&&!G.rp,flip=G.mode==='pva'&&G.human==='b';
 draw($('board'),s,{flip,sel:live?sel:null,hints:live&&S.hints&&sel!=null?legalFrom(s,sel).map(x=>x.t):[],last:m&&[m.f,m.t],hm:live?G.hint:null});
 const nm=c=>G.mode==='pva'?(c===G.human?`You (${side(c)})`:`Computer (${LV[G.level][0]})`):`Player ${c==='w'?1:2} (${side(c)})`;
 [['top',flip?'w':'b'],['bot',flip?'b':'w']].forEach(([k,c])=>{$(k+'Name').textContent=nm(c);$(k+'Av').textContent=G.mode==='pva'&&c!==G.human?'🤖':'👤';$(k+'Bar').classList.toggle('turn',live&&s.t===c)});
 clocks();
 $('status').textContent=G.rp?`Replay: move ${G.i} of ${G.moves.length}`:G.done?'Game over — '+resTxt(G.result):`${side(s.t)} to move${C.inCheck(s)?' — check!':''}${G.busy?' (AI is thinking…)':''}`;
 $('promo').hidden=!pend;if(pend)$('promo').innerHTML='Promote to: '+pend.map(x=>`<button data-p="${x.p}">${C.GL[x.p]} ${NM[x.p]}</button>`).join('');
 $('playBar').hidden=G.done;$('finBar').hidden=!G.done||G.rp;$('rpBar').hidden=!G.rp;
 $('undo').disabled=!G.moves.length||G.busy;$('hint').disabled=G.busy||(G.mode==='pva'&&s.t!==G.human);
 $('rpPlay').disabled=!!G.playing;$('rpPause').disabled=!G.playing;$('rpPrev').disabled=G.i===0;$('rpNext').disabled=G.i===G.moves.length;
 $('replayBtn').disabled=$('analyzeBtn').disabled=!G.moves.length;
 let h='';for(let k=0;k<G.info.length;k+=2){const c=j=>G.info[j]?`<td class="${G.rp&&G.i===j+1?'cur':''}">${G.info[j].text}</td>`:'<td></td>';h+=`<tr><td>${k/2+1}</td>${c(k)}${c(k+1)}</tr>`}
 $('hb').innerHTML=h||'<tr><td colspan="3">No moves yet — White moves first.</td></tr>'}
function clocks(){const t=G.mode==='pva'&&G.human==='b'?'w':'b';$('topClock').textContent=fmt(G.clock[t]);$('botClock').textContent=fmt(G.clock[t==='w'?'b':'w'])}
setInterval(()=>{if(G&&!G.done&&!G.rp&&!$('v-play').hidden){G.clock[cur().t]++;clocks()}},1000); // elapsed time per side (not saved)
$('board').onclick=e=>{const b=e.target.closest('.sq');if(!b||!G||G.done||G.rp||G.busy||pend)return;
 const s=cur(),i=+b.dataset.i;if(G.mode==='pva'&&s.t!==G.human)return;
 const ms=sel!=null?legalFrom(s,sel).filter(m=>m.t===i):[];
 if(ms.length){if(ms.length>1){pend=ms;sel=null;render()}else play(ms[0]);return}
 const p=s.b[i];sel=p!==' '&&C.col(p)===s.t?i:null;render()};
$('promo').onclick=e=>{const p=e.target.dataset.p;if(!p)return;const m=pend.find(x=>x.p===p);pend=null;play(m)};
$('start').onclick=newGame;$('undo').onclick=undo;$('hint').onclick=hint;
$('modes').onclick=e=>{const b=e.target.closest('.opt');if(b&&b.dataset.mode){NG.mode=b.dataset.mode;syncUI()}};
$('colors').onclick=e=>{if(e.target.dataset.c){NG.color=e.target.dataset.c;syncUI()}};
$$('.newgame').forEach(b=>b.onclick=()=>show('new'));
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

/* ---- navigation + list views ---- */
const TITLES={home:'',new:'New Game',play:'Offline Chess',games:'Saved Games',stats:'Statistics',puzzles:'Puzzles',settings:'Settings'};
function show(v){if(v!=='play'&&G&&G.playing)rpPause();
 $$('main>section').forEach(s=>s.hidden=s.id!=='v-'+v);$('back').hidden=v==='home';$('gear').hidden=v==='settings';$('title').textContent=TITLES[v];
 if(v==='new')syncUI();if(v==='play')render();if(v==='games')gamesView();if(v==='stats')statsView();if(v==='puzzles')pzView()}
$$('[data-v]').forEach(b=>b.onclick=()=>show(b.dataset.v));$('back').onclick=()=>show('home');$('gear').onclick=()=>show('settings');
$('gtabs').onclick=e=>{if(e.target.dataset.f){gf=e.target.dataset.f;gamesView()}};
async function gamesView(){let gs=[];try{gs=(await DB.games()).sort((a,b)=>b.date-a.date)}catch(e){}
 $$('#gtabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===gf));gs=gs.filter(g=>gf==='all'||g.mode===gf);
 $('glist').innerHTML=gs.length?gs.map(g=>`<li><span class="mini"></span><span><b>${g.mode==='pva'?'Game vs AI ('+LV[g.level][0]+')':'Two Players'}</b><small>${new Date(g.date).toLocaleString()} · ${g.moves.length} moves · ${g.done?resTxt(g.result):'unfinished'}</small></span><button data-id="${g.id}">${g.done?'Replay':'Resume'}</button></li>`).join(''):'<li>No saved games here yet. Start one from Play — games save automatically (if Autosave is on).</li>'}
$('glist').onclick=e=>{if(e.target.dataset.id)openGame(+e.target.dataset.id)};
const row=(n,r)=>`<tr><td>${n}</td><td>${r.w+r.l+r.d}</td><td>${r.w}</td><td>${r.l}</td><td>${r.d}</td><td><b>${pts(r)}</b></td></tr>`;
async function statsView(){let st=null,gs=[];try{st=await DB.get('stats');gs=await DB.games()}catch(e){}st=st||{pvp:{w:z(),b:z()},pva:{w:z(),b:z()}};
 const sum=m=>{const t=z();for(const c of['w','b'])for(const k in t)t[k]+=st[m][c][k];return t},a=sum('pva'),p=sum('pvp'),ag=a.w+a.l+a.d,pg=(p.w+p.l+p.d)/2,rate=ag?Math.round(100*a.w/ag):0,mx=Math.max(ag,pg,1);
 const card=(n,l,i)=>`<div class="sc"><i>${i}</i><b>${n}</b><small>${l}</small></div>`;
 const rec=gs.filter(g=>g.done).sort((x,y)=>y.date-x.date).slice(0,4).map(g=>{const r=g.mode==='pva'?(g.result.w?(g.result.w===g.human?'Win':'Loss'):'Draw'):(g.result.w?side(g.result.w)+' wins':'Draw');
  return`<li><span class="${r==='Win'?'ok':r==='Loss'?'bad':''}"><b>${r}</b> ${g.mode==='pva'?'vs AI ('+LV[g.level][0]+')':'· Two Players'}</span><small>${new Date(g.date).toLocaleDateString()}</small></li>`}).join('');
 let h=`<p class="note">Cards and win rate show your Player vs AI results.</p><div class="sgrid">${card(ag,'Games','♟')}${card(a.w,'Wins','🏆')}${card(a.d,'Draws','🤝')}${card(a.l,'Losses','✕')}</div>
 <div class="two"><div class="card"><h3>Win rate</h3><div class="ring" style="--p:${rate}"><b>${rate}%</b></div></div>
 <div class="card"><h3>Games by mode</h3><div class="bars"><div><i style="height:${60*ag/mx}px"></i>${ag}<br>vs AI</div><div><i style="height:${60*pg/mx}px"></i>${pg}<br>Two Players</div></div></div></div>
 <div class="card"><h3>Recent results</h3><ul class="rec">${rec||'<li>No finished games yet — play one to see results here.</li>'}</ul></div>
 <div class="card"><h3>Points</h3><p class="note">+20 per win, −5 per loss, 0 per draw; each finished game counts once. In Two Players, a decisive game gives +20 to the winning seat and −5 to the other.</p>`,all=0;
 for(const[m,n]of[['pva','Player vs AI (your results)'],['pvp','Two Players (by seat)']]){let rows='';for(const c of['w','b'])rows+=row(side(c),st[m][c]);all+=pts(sum(m));
  h+=`<h3>${n}</h3><table><thead><tr><th>Side</th><th>Games</th><th>W</th><th>L</th><th>D</th><th>Pts</th></tr></thead><tbody>${rows}${row('Total',sum(m))}</tbody></table>`}
 $('stbox').innerHTML=h+`<p><b>Total points: ${all}</b> (20 × wins − 5 × losses)</p></div>`}
$('export').onclick=async()=>{const d={app:'offline-chess',exported:new Date().toISOString(),settings:S,stats:await DB.get('stats'),games:await DB.games()};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'}));a.download='chess-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

/* ---- puzzles ---- */
const pl=()=>PUZZLES.filter(p=>pf==='All'||p.level===pf);
function pzRender(){draw($('pboard'),PZ.s,{flip:PZ.flip,sel:PZ.sel,hints:S.hints&&PZ.sel!=null&&!PZ.done?legalFrom(PZ.s,PZ.sel).map(m=>m.t):[],last:PZ.last})}
function loadPz(p){const s=C.fromFen(p.fen);PZ={p,s,i:0,sel:null,last:null,flip:s.t==='b',done:false};$('ptitle').textContent=p.title;$('plevel').textContent=p.level||'Easy';$('pmsg').textContent=side(s.t)+' to move';pzRender()}
function pzView(){$$('#ptabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===pf));const l=pl();$('pcard').hidden=!l.length;$('pempty').hidden=!!l.length;
 if(l.length){pk=(pk+l.length)%l.length;loadPz(l[pk])}}
$('ptabs').onclick=e=>{if(e.target.dataset.f){pf=e.target.dataset.f;pk=0;pzView()}};
$('pPrev').onclick=()=>{pk--;pzView()};$('pNext').onclick=()=>{pk++;pzView()};$('pRestart').onclick=()=>loadPz(PZ.p);
$('pboard').onclick=e=>{const b=e.target.closest('.sq');if(!b||!PZ||PZ.done)return;const i=+b.dataset.i,ms=PZ.sel!=null?legalFrom(PZ.s,PZ.sel).filter(m=>m.t===i):[];
 if(ms.length){const m=ms.find(x=>x.p==='Q')||ms[0];PZ.sel=null;
  if(C.uci(m)===PZ.p.solution[PZ.i]){PZ.s=C.make(PZ.s,m);PZ.i++;PZ.last=[m.f,m.t];
   if(PZ.i>=PZ.p.solution.length){PZ.done=true;$('pmsg').textContent='Solved! ✔'}
   else{const r=C.parse(PZ.s,PZ.p.solution[PZ.i]);PZ.s=C.make(PZ.s,r);PZ.i++;PZ.last=[r.f,r.t];$('pmsg').textContent='Correct — keep going.'}}
  else $('pmsg').textContent='Not the best move. Try again.'}
 else{const p=PZ.s.b[i];PZ.sel=p!==' '&&C.col(p)===PZ.s.t?i:null}pzRender()};

/* ---- init ---- */
syncUI();show('home');
(async()=>{try{Object.assign(S,(await DB.get('settings'))||{})}catch(e){console.warn('Storage unavailable',e)}syncUI();render()})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(console.warn);
})();
