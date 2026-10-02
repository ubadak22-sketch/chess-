import{Game}from'./chess/engine.js';
import{evaluate}from'./ai/ai.js';
import{load,save}from'./storage.js';

const GLYPH={P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'},TEXT='\uFE0E';
const LEVELS={easy:{depth:1,noise:150},medium:{depth:2,noise:30},hard:{depth:3,noise:0},expert:{depth:4,noise:0}};
const $=s=>document.querySelector(s);
const settings=load('cx-settings',{anim:true,legal:true,coords:true,theme:'neon'});
const stats=load('cx-stats',{games:0,won:0,lost:0,draws:0,ai:0,pvp:0,streak:0,best:0});
let game=new Game(),mode='pvp',level='medium',sel=null,busy=false,over=false,times={w:0,b:0},token=0,worker=null,startedAt=0;

const show=id=>{document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id===id));
  if(id==='stats')renderStats();if(id==='settings')renderSettings();};
const piece=p=>`<span class="p ${p[0]}">${GLYPH[p[1]]+TEXT}</span>`;
const fmt=t=>String(t/60|0).padStart(2,'0')+':'+String(t%60).padStart(2,'0');

// ---------- rendering ----------
function renderBoard(){
  const s=game.s,last=game.moves.at(-1)?.m,targets=sel!==null&&settings.legal?game.legalFrom(sel):[];
  const king=game.inCheck()?s.b.indexOf(s.turn+'K'):-1;let h='';
  for(let i=0;i<64;i++){
    const r=i>>3,c=i&7,t=targets.find(m=>m.to===i);
    const cls=['sq',(r+c)%2?'d':'l',sel===i&&'sel',last&&(last.from===i||last.to===i)&&'last',t&&'mv',t&&s.b[i]&&'cap',king===i&&'chk'].filter(Boolean).join(' ');
    h+=`<div class="${cls}" data-i="${i}">${s.b[i]?piece(s.b[i]):''}${settings.coords&&c===0?`<i class="rk">${8-r}</i>`:''}${settings.coords&&r===7?`<i class="fl">${'abcdefgh'[c]}</i>`:''}</div>`;
  }
  $('#board').innerHTML=h;
}
function renderHud(){
  const caps=by=>game.moves.filter(m=>m.by===by&&m.cap).map(m=>m.cap).sort().map(p=>GLYPH[p[1]]+TEXT).join('');
  $('#cap-w').textContent=caps('b');$('#cap-b').textContent=caps('w'); // each bar lists what that side has captured
  $('#clk-w').textContent=fmt(times.w);$('#clk-b').textContent=fmt(times.b);
  $('#g-move').textContent='MOVE '+game.s.full;
  $('#turn').textContent=over?'GAME OVER':busy?'AI THINKING…':(game.inCheck()?'CHECK! ':'')+(game.s.turn==='w'?'WHITE':'BLACK')+' TO MOVE';
  const m=game.moves;let h='';
  for(let i=0;i<m.length;i+=2)h+=`<li>${m[i].san}  ${m[i+1]?.san||''}</li>`;
  $('#hist').innerHTML=h;$('#hist').scrollTop=1e5;
}
const render=()=>{renderBoard();renderHud();};

// ---------- game flow ----------
function start(m,lv){
  mode=m;level=lv||level;game=new Game();sel=null;busy=false;over=false;times={w:0,b:0};token++;startedAt=Date.now();
  $('#overlay').hidden=true;show('game');render();
}
function onSquare(i){
  if(over||busy||(mode==='ai'&&game.s.turn!=='w'))return;
  const p=game.s.b[i];
  if(sel!==null){
    const ms=game.legalFrom(sel).filter(m=>m.to===i);
    if(ms.length)return ms[0].promo?askPromo(ms):play(ms[0]);
  }
  sel=p&&p[0]===game.s.turn?i:null;renderBoard();
}
function askPromo(ms){
  const me=game.s.turn;
  $('#card').innerHTML=`<h2>PROMOTE</h2><div class="promo">${'QRBN'.split('').map(q=>`<button class="ghost" data-q="${q}">${piece(me+q)}</button>`).join('')}</div>`;
  $('#overlay').hidden=false;
  $('#card').onclick=e=>{const q=e.target.closest('[data-q]')?.dataset.q;if(!q)return;$('#overlay').hidden=true;play(ms.find(m=>m.promo===q));};
}
function play(m){
  sel=null;game.play(m);render();
  if(game.result)return finish(game.result);
  if(mode==='ai'&&game.s.turn==='b')aiTurn();
}
function aiTurn(){
  busy=true;renderHud();const my=++token;
  worker??=new Worker('js/ai/worker.js',{type:'module'});
  worker.onmessage=e=>{if(my!==token)return;busy=false;play(e.data);};
  worker.postMessage({s:game.s,cfg:LEVELS[level]});
}
function finish(result){
  over=true;game.result=result;renderHud();
  const w=result.winner,ai=mode==='ai';
  stats.games++;stats[ai?'ai':'pvp']++;
  if(!w)stats.draws++;
  else if(ai){if(w==='w'){stats.won++;stats.best=Math.max(stats.best,++stats.streak);}else{stats.lost++;stats.streak=0;}}
  save('cx-stats',stats);
  const title={checkmate:'CHECKMATE',stalemate:'STALEMATE',resign:'RESIGNED'}[result.type]||'DRAW';
  const sub=w?(w==='w'?'WHITE':'BLACK')+' WINS':result.type==='draw'?'Draw agreed':result.type;
  const cap=by=>game.moves.filter(m=>m.by===by&&m.cap).map(m=>GLYPH[m.cap[1]]+TEXT).join('')||'–';
  setTimeout(()=>{
    if(!over)return;
    $('#card').onclick=e=>{if(e.target.id==='again')start(mode);if(e.target.id==='home'){$('#overlay').hidden=true;show('menu');}};
    $('#card').innerHTML=`<h2>${title}</h2><p><b>${sub}</b></p><p>Moves: ${game.moves.length} · Time: ${fmt((Date.now()-startedAt)/1000|0)}</p><p>White took ${cap('w')}<br>Black took ${cap('b')}</p><button id="again">PLAY AGAIN</button><button id="home" class="ghost">MAIN MENU</button>`;
    $('#overlay').hidden=false;
  },settings.anim?700:0);
}

// ---------- controls ----------
$('#board').addEventListener('click',e=>{const q=e.target.closest('.sq');if(q)onSquare(+q.dataset.i);});
$('#b-new').onclick=()=>start(mode);
$('#g-menu').onclick=()=>{token++;busy=false;show('menu');};
$('#b-undo').onclick=()=>{
  if(busy)return;
  if(!game.undo())return;
  if(mode==='ai'&&game.s.turn!=='w')game.undo();
  over=false;sel=null;$('#overlay').hidden=true;render();
};
$('#b-resign').onclick=()=>{
  if(over||busy||!confirm('Resign this game?'))return;
  finish({type:'resign',winner:mode==='ai'?'b':game.s.turn==='w'?'b':'w'});
};
$('#b-draw').onclick=()=>{
  if(over||busy)return;
  if(mode==='pvp')return confirm('Both players agree to a draw?')&&finish({type:'draw',winner:null});
  const aiScore=game.s.turn==='w'?-evaluate(game.s):evaluate(game.s);
  aiScore<=0?finish({type:'draw',winner:null}):alert('The AI declines the draw.');
};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.go==='pvp')start('pvp');else if(b.dataset.go)show(b.dataset.go);
  if(b.dataset.lv)start('ai',b.dataset.lv);
});
setInterval(()=>{if(!over&&$('#game').classList.contains('active')&&$('#overlay').hidden){times[game.s.turn]++;renderHud();}},1000);

// ---------- stats & settings ----------
function renderStats(){
  const rows=[['Games played',stats.games],['Won',stats.won],['Lost',stats.lost],['Draws',stats.draws],['Vs AI',stats.ai],['Local PvP',stats.pvp],['Win streak',stats.streak],['Best streak',stats.best]];
  $('#stats-body').innerHTML=rows.map(([k,v])=>`<div><b>${v}</b>${k}</div>`).join('');
}
function renderSettings(){
  const row=(k,l)=>`<label class="row">${l}<input type="checkbox" data-k="${k}" ${settings[k]?'checked':''}></label>`;
  $('#set-body').innerHTML=row('anim','Animations')+row('legal','Show legal moves')+row('coords','Show coordinates')+
    `<div class="row">Board theme<span>${['neon','classic','dark'].map(t=>`<button class="chip ${settings.theme===t?'on':''}" data-t="${t}">${t}</button>`).join(' ')}</span></div>`;
}
$('#set-body').addEventListener('click',e=>{if(e.target.dataset.t){settings.theme=e.target.dataset.t;applySettings();renderSettings();}});
$('#set-body').addEventListener('change',e=>{if(e.target.dataset.k){settings[e.target.dataset.k]=e.target.checked;applySettings();}});
function applySettings(){
  document.body.dataset.theme=settings.theme;document.body.classList.toggle('noanim',!settings.anim);
  save('cx-settings',settings);render();
}
applySettings();
