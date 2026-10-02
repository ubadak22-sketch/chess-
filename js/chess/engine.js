// Pure chess rules, no DOM. Board = 64-array, index = rank*8+file, 0 = a8, 63 = h1. Pieces like 'wP','bK'.
export const FILES='abcdefgh';
const N=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIAG=[[-1,-1],[-1,1],[1,-1],[1,1]],ORTH=[[-1,0],[1,0],[0,-1],[0,1]],K=[...DIAG,...ORTH];
const opp=c=>c==='w'?'b':'w', inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;

export function initial(){
  const b=Array(64).fill(null),back='RNBQKBNR';
  for(let i=0;i<8;i++){b[i]='b'+back[i];b[8+i]='bP';b[48+i]='wP';b[56+i]='w'+back[i];}
  return{b,turn:'w',cast:{wK:1,wQ:1,bK:1,bQ:1},ep:-1,half:0,full:1};
}

/** Is square `sq` attacked by side `by`? Scans outward from the square. */
export function attacked(b,sq,by){
  const r=sq>>3,c=sq&7,at=(R,C)=>inb(R,C)?b[R*8+C]:null,pr=by==='w'?1:-1;
  for(const dc of[-1,1])if(at(r+pr,c+dc)===by+'P')return true;
  for(const[dr,dc]of N)if(at(r+dr,c+dc)===by+'N')return true;
  for(const[dr,dc]of K)if(at(r+dr,c+dc)===by+'K')return true;
  for(const[dirs,types]of[[DIAG,'BQ'],[ORTH,'RQ']])for(const[dr,dc]of dirs){
    let R=r+dr,C=c+dc;
    while(inb(R,C)){const p=b[R*8+C];if(p){if(p[0]===by&&types.includes(p[1]))return true;break;}R+=dr;C+=dc;}
  }
  return false;
}

/** Pseudo-legal moves (may leave own king in check; filtered in legal()). */
function pseudo(s){
  const{b,turn:me}=s,en=opp(me),out=[],add=(from,to,x)=>out.push({from,to,...x});
  for(let f=0;f<64;f++){
    const p=b[f];if(!p||p[0]!==me)continue;
    const r=f>>3,c=f&7,k=p[1];
    if(k==='P'){
      const d=me==='w'?-1:1,start=me==='w'?6:1,last=me==='w'?0:7,R=r+d;
      const push=to=>{if(to>>3===last)for(const q of'QRBN')add(f,to,{promo:q});else add(f,to);};
      if(!b[R*8+c]){push(R*8+c);if(r===start&&!b[(R+d)*8+c])add(f,(R+d)*8+c);}
      for(const dc of[-1,1]){
        if(c+dc<0||c+dc>7)continue;const to=R*8+c+dc;
        if(b[to]&&b[to][0]===en)push(to);else if(to===s.ep)add(f,to,{ep:1});
      }
    }else if(k==='N'||k==='K'){
      for(const[dr,dc]of k==='N'?N:K){
        if(!inb(r+dr,c+dc))continue;const q=b[(r+dr)*8+c+dc];
        if(!q||q[0]===en)add(f,(r+dr)*8+c+dc);
      }
      if(k==='K'&&f===(me==='w'?60:4)){
        // Castling: rights intact, path empty, king not in/through/into check.
        const safe=(...x)=>x.every(q=>!attacked(b,q,en));
        if(s.cast[me+'K']&&!b[f+1]&&!b[f+2]&&safe(f,f+1,f+2))add(f,f+2,{castle:'K'});
        if(s.cast[me+'Q']&&!b[f-1]&&!b[f-2]&&!b[f-3]&&safe(f,f-1,f-2))add(f,f-2,{castle:'Q'});
      }
    }else{
      for(const[dr,dc]of k==='B'?DIAG:k==='R'?ORTH:K){
        let R=r+dr,C=c+dc;
        while(inb(R,C)){const q=b[R*8+C];if(!q||q[0]===en)add(f,R*8+C);if(q)break;R+=dr;C+=dc;}
      }
    }
  }
  return out;
}

/** Returns a NEW state with move m applied (immutable, so AI and undo are trivial). */
export function apply(s,m){
  const b=s.b.slice(),p=b[m.from],me=s.turn,cast={...s.cast},cap=b[m.to];
  b[m.to]=m.promo?me+m.promo:p;b[m.from]=null;
  if(m.ep)b[m.to+(me==='w'?8:-8)]=null;
  if(m.castle){const h=m.from;if(m.castle==='K'){b[h+1]=b[h+3];b[h+3]=null;}else{b[h-1]=b[h-4];b[h-4]=null;}}
  if(p[1]==='K')cast[me+'K']=cast[me+'Q']=0;
  for(const[sq,key]of[[63,'wK'],[56,'wQ'],[7,'bK'],[0,'bQ']])if(m.from===sq||m.to===sq)cast[key]=0;
  const dbl=p[1]==='P'&&Math.abs(m.to-m.from)===16;
  return{b,turn:opp(me),cast,ep:dbl?(m.from+m.to)/2:-1,half:p[1]==='P'||cap||m.ep?0:s.half+1,full:s.full+(me==='b'?1:0)};
}

export const inCheck=s=>attacked(s.b,s.b.indexOf(s.turn+'K'),opp(s.turn));
export const legal=s=>pseudo(s).filter(m=>{const n=apply(s,m);return!attacked(n.b,n.b.indexOf(s.turn+'K'),opp(s.turn));});

const key=s=>`${s.b.join(',')}${s.turn}${Object.values(s.cast)}${s.ep}`;
/** Game-over reason for state s, or null. keys = position keys so far (for repetition). */
function status(s,keys){
  if(!legal(s).length)return inCheck(s)?'checkmate':'stalemate';
  const ps=s.b.filter(p=>p&&p[1]!=='K').map(p=>p[1]);
  if(!ps.length||(ps.length===1&&'BN'.includes(ps[0])))return'insufficient material';
  if(s.half>=100)return'fifty-move rule';
  if(keys.filter(k=>k===keys.at(-1)).length>=3)return'threefold repetition';
  return null;
}

const sq=i=>FILES[i&7]+(8-(i>>3));
function san(s,m,cap,suffix){
  if(m.castle)return(m.castle==='K'?'O-O':'O-O-O')+suffix;
  const k=s.b[m.from][1];
  return(k==='P'?(cap?FILES[m.from&7]+'x':''):k+(cap?'x':''))+sq(m.to)+(m.promo?'='+m.promo:'')+suffix;
}

/** Stateful wrapper the UI talks to. */
export class Game{
  constructor(){this.s=initial();this.stack=[];this.moves=[];this.keys=[key(this.s)];this.result=null;}
  legalFrom(f){return legal(this.s).filter(m=>m.from===f);}
  inCheck(){return inCheck(this.s);}
  play(m){
    const s=this.s,cap=s.b[m.to]||(m.ep?(s.turn==='w'?'bP':'wP'):null);
    this.stack.push(s);this.s=apply(s,m);this.keys.push(key(this.s));
    const st=status(this.s,this.keys),suf=st==='checkmate'?'#':inCheck(this.s)?'+':'';
    this.moves.push({m,cap,by:s.turn,san:san(s,m,cap,suf)});
    this.result=st?{type:st,winner:st==='checkmate'?s.turn:null}:null;
  }
  undo(){
    if(!this.stack.length)return false;
    this.s=this.stack.pop();this.moves.pop();this.keys.pop();this.result=null;return true;
  }
}
