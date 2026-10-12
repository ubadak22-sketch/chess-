/* Chess rules engine (original code, MIT). Board = 64-array, index 0 = a8, ' ' = empty.
   State: {b, t:'w'|'b', c:castling rights string, e:en-passant square or -1, h:halfmove clock, n:fullmove}. */
(function(){
const D={N:[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],K:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],B:[[-1,-1],[-1,1],[1,-1],[1,1]],R:[[-1,0],[1,0],[0,-1],[0,1]]};
D.Q=D.B.concat(D.R);
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GL={K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟\uFE0E'};
const col=p=>p===p.toUpperCase()?'w':'b';
const sqn=i=>'abcdefgh'[i&7]+(8-(i>>3));
const RM={60:'KQ',4:'kq',63:'K',56:'Q',7:'k',0:'q'};
function fromFen(f){const[p,t,c,e,h,n]=f.split(' '),b=[];
 for(const ch of p.replace(/\//g,''))if(/\d/.test(ch))for(let i=0;i<+ch;i++)b.push(' ');else b.push(ch);
 return{b,t,c:c==='-'?'':c,e:e==='-'?-1:(8-e[1])*8+(e.charCodeAt(0)-97),h:+h||0,n:+n||1}}
function att(b,s,by){const r=s>>3,c=s&7,w=by==='w';
 const at=(rr,cc,set)=>rr>=0&&rr<8&&cc>=0&&cc<8&&set.includes(b[rr*8+cc]);
 const pr=w?r+1:r-1;
 if(at(pr,c-1,w?'P':'p')||at(pr,c+1,w?'P':'p'))return 1;
 for(const[d,e]of D.N)if(at(r+d,c+e,w?'N':'n'))return 1;
 for(const[d,e]of D.K)if(at(r+d,c+e,w?'K':'k'))return 1;
 for(const[list,set]of[[D.B,w?'BQ':'bq'],[D.R,w?'RQ':'rq']])for(const[d,e]of list){let rr=r+d,cc=c+e;
  while(rr>=0&&rr<8&&cc>=0&&cc<8){const x=b[rr*8+cc];if(x!==' '){if(set.includes(x))return 1;break}rr+=d;cc+=e}}
 return 0}
function gen(s){const{b,t,c,e}=s,w=t==='w',out=[];
 for(let i=0;i<64;i++){const p=b[i];if(p===' '||col(p)!==t)continue;const u=p.toUpperCase(),r=i>>3,f=i&7;
  if(u==='P'){const d=w?-1:1,o=i+d*8,pr=w?0:7,add=to=>{if(to>>3===pr)for(const q of'QRBN')out.push({f:i,t:to,p:q});else out.push({f:i,t:to})};
   if(b[o]===' '){add(o);if(r===(w?6:1)&&b[o+d*8]===' ')out.push({f:i,t:o+d*8})}
   for(const dc of[-1,1]){const cc=f+dc;if(cc<0||cc>7)continue;const to=o+dc;
    if(b[to]!==' '&&col(b[to])!==t)add(to);else if(to===e)out.push({f:i,t:to,ep:1})}}
  else if(u==='N'||u==='K'){for(const[d,x]of D[u]){const rr=r+d,cc=f+x;if(rr<0||rr>7||cc<0||cc>7)continue;const q=b[rr*8+cc];if(q===' '||col(q)!==t)out.push({f:i,t:rr*8+cc})}}
  else for(const[d,x]of D[u]){let rr=r+d,cc=f+x;while(rr>=0&&rr<8&&cc>=0&&cc<8){const q=b[rr*8+cc];if(q===' ')out.push({f:i,t:rr*8+cc});else{if(col(q)!==t)out.push({f:i,t:rr*8+cc});break}rr+=d;cc+=x}}}
 const R=w?56:0,K=w?'K':'k',Q=w?'Q':'q',Rk=w?'R':'r',en=w?'b':'w';
 if(b[R+4]===K&&(c.includes(K)||c.includes(Q))&&!att(b,R+4,en)){
  if(c.includes(K)&&b[R+7]===Rk&&b[R+5]===' '&&b[R+6]===' '&&!att(b,R+5,en)&&!att(b,R+6,en))out.push({f:R+4,t:R+6,ca:1});
  if(c.includes(Q)&&b[R]===Rk&&b[R+1]===' '&&b[R+2]===' '&&b[R+3]===' '&&!att(b,R+3,en)&&!att(b,R+2,en))out.push({f:R+4,t:R+2,ca:1})}
 return out}
function make(s,m){const b=s.b.slice(),p=b[m.f],w=s.t==='w',cap=b[m.t]!==' '||m.ep;let c=s.c,e=-1;
 b[m.t]=m.p?(w?m.p:m.p.toLowerCase()):p;b[m.f]=' ';
 if(m.ep)b[m.t+(w?8:-8)]=' ';
 if(m.ca){const a=m.t>m.f?m.t+1:m.t-2,d=m.t>m.f?m.t-1:m.t+1;b[d]=b[a];b[a]=' '}
 if(p.toUpperCase()==='P'&&Math.abs(m.t-m.f)===16)e=(m.f+m.t)/2;
 for(const q of[m.f,m.t])for(const ch of RM[q]||'')c=c.replace(ch,'');
 return{b,t:w?'b':'w',c,e,h:(cap||p.toUpperCase()==='P')?0:s.h+1,n:s.n+(w?0:1)}}
function legal(s){const k=s.t==='w'?'K':'k',o=s.t==='w'?'b':'w';
 return gen(s).filter(m=>{const n=make(s,m);return!att(n.b,n.b.indexOf(k),o)})}
const inCheck=s=>!!att(s.b,s.b.indexOf(s.t==='w'?'K':'k'),s.t==='w'?'b':'w');
const key=s=>s.b.join('')+s.t+s.c+s.e;
function status(s,keys){
 if(!legal(s).length)return inCheck(s)?{over:1,winner:s.t==='w'?'b':'w',reason:'checkmate'}:{over:1,reason:'stalemate'};
 const ps=s.b.filter(p=>p!==' '&&p.toUpperCase()!=='K');
 if(!ps.length||(ps.length===1&&'NBnb'.includes(ps[0])))return{over:1,reason:'insufficient material'};
 if(s.h>=100)return{over:1,reason:'fifty-move rule'};
 const k=key(s);if(keys.filter(x=>x===k).length>=3)return{over:1,reason:'threefold repetition'};
 return{over:0}}
const uci=m=>sqn(m.f)+sqn(m.t)+(m.p||'').toLowerCase();
const parse=(s,u)=>legal(s).find(m=>uci(m)===u);
function describe(s,m,n){const p=s.b[m.f].toUpperCase(),cap=s.b[m.t]!==' '||m.ep,chk=inCheck(n);
 const mark=legal(n).length?(chk?'+':''):(chk?'#':'');
 return{side:s.t,piece:p,from:sqn(m.f),to:sqn(m.t),cap:!!cap,promo:m.p||null,
  text:GL[p]+sqn(m.f)+(cap?'×':'–')+sqn(m.t)+(m.p?'='+m.p:'')+(m.ca?(m.t>m.f?' O-O':' O-O-O'):'')+mark}}
globalThis.Chess={START,GL,col,sqn,fromFen,legal,make,inCheck,key,status,uci,parse,describe};
if(typeof module!=='undefined')module.exports=globalThis.Chess;
})();
