/* Local AI: negamax + alpha-beta + capture quiescence. Runs in a Web Worker, no network. */
importScripts('chess.js');
const V={P:100,N:320,B:330,R:500,Q:900,K:0};
function ev(s){let v=0;for(let i=0;i<64;i++){const p=s.b[i];if(p===' ')continue;const u=p.toUpperCase(),w=p===u,r=i>>3,
 cen=4-Math.max(Math.abs(r-3.5),Math.abs((i&7)-3.5)),
 x=V[u]+(u==='N'||u==='B'||u==='P'?cen*6:0)+(u==='P'?(w?6-r:r-1)*5:0);v+=w?x:-x}return v}
function qs(s,a,b){const t=(s.t==='w'?1:-1)*ev(s);if(t>=b)return b;if(t>a)a=t;
 for(const m of Chess.legal(s))if(s.b[m.t]!==' '||m.ep){const v=-qs(Chess.make(s,m),-b,-a);if(v>=b)return b;if(v>a)a=v}return a}
function nm(s,d,a,b){const ms=Chess.legal(s);if(!ms.length)return Chess.inCheck(s)?-99999-d:0;if(!d)return qs(s,a,b);
 const sc=m=>(s.b[m.t]!==' '||m.ep?10:0)+(m.p?9:0);ms.sort((x,y)=>sc(y)-sc(x));
 for(const m of ms){const v=-nm(Chess.make(s,m),d-1,-b,-a);if(v>=b)return b;if(v>a)a=v}return a}
onmessage=e=>{const{id,s,depth,noise}=e.data,ms=Chess.legal(s);
 if(!ms.length)return postMessage({id,score:Chess.inCheck(s)?-99999:0});
 let best=ms[0],bs=-Infinity;
 for(const m of ms){const v=-nm(Chess.make(s,m),depth-1,-Infinity,noise?Infinity:-bs)+(noise?Math.random()*noise:0);if(v>bs){bs=v;best=m}}
 postMessage({id,move:best,score:Math.round(bs)})};
