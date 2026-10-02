// Replaceable AI: export chooseMove(state, {depth, noise}) -> move. Negamax + alpha-beta.
import{legal,apply,inCheck}from'../chess/engine.js';
const V={P:100,N:320,B:330,R:500,Q:900,K:0};

/** Static score from the side-to-move's view: material + centre control + pawn advancement. */
export function evaluate(s){
  let v=0;
  for(let i=0;i<64;i++){
    const p=s.b[i];if(!p)continue;
    const r=i>>3,c=i&7,t=p[1];let x=V[t];
    if(t!=='K'&&t!=='R')x+=(4-Math.max(Math.abs(r-3.5),Math.abs(c-3.5)))*6;
    if(t==='P')x+=(p[0]==='w'?6-r:r-1)*5;
    v+=p[0]==='w'?x:-x;
  }
  return s.turn==='w'?v:-v;
}

// Captures (most valuable victim first) and promotions are searched first so pruning bites harder.
function order(s,ms){
  const score=m=>{const v=s.b[m.to];return(v?10*V[v[1]]-V[s.b[m.from][1]]:0)+(m.promo?800:0);};
  return ms.map(m=>[score(m),m]).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
}

function search(s,depth,alpha,beta){
  const ms=legal(s);
  if(!ms.length)return inCheck(s)?-99999-depth:0;
  if(!depth)return evaluate(s);
  let best=-Infinity;
  for(const m of order(s,ms)){
    best=Math.max(best,-search(apply(s,m),depth-1,-beta,-alpha));
    alpha=Math.max(alpha,best);if(alpha>=beta)break;
  }
  return best;
}

/** noise (centipawns) randomises weaker levels; depth is the real strength knob. */
export function chooseMove(s,{depth,noise}){
  let best=null,bestScore=-Infinity,alpha=-Infinity;
  for(const m of order(s,legal(s))){
    const v=-search(apply(s,m),depth-1,-Infinity,noise?Infinity:-alpha);
    const score=v+Math.random()*noise;
    if(score>bestScore){bestScore=score;best=m;}
    if(!noise)alpha=Math.max(alpha,v);
  }
  return best;
}
