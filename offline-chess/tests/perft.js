// Run: node tests/perft.js  — verifies move generation against known perft counts.
const C=require('../js/chess.js');
const perft=(s,d)=>d?C.legal(s).reduce((n,m)=>n+perft(C.make(s,m),d-1),0):1;
const T=[[C.START,[20,400,8902]],
['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039]],
['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812]],
['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467]]];
let ok=true;for(const[f,e]of T)e.forEach((x,i)=>{const r=perft(C.fromFen(f),i+1);if(r!==x){ok=false;console.log('FAIL',f,'depth',i+1,'got',r,'want',x)}});
console.log(ok?'perft OK':'perft FAILED');process.exit(ok?0:1);
