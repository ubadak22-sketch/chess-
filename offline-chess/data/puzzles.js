/* Add puzzles by appending objects below:
   {id:'unique', level:'Easy|Medium|Hard', title:'Shown in the list', fen:'<FEN, side to move solves>', solution:['e2e4', ...]}
   solution = moves in UCI (from-square + to-square, e.g. 'e7e8q' for promotion), alternating
   your move, opponent reply, your move... The opponent replies are played automatically. */
window.PUZZLES=[
{id:'p1',title:'Mate in 1 — back rank',fen:'6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',level:'Easy',solution:['a1a8']},
{id:'p2',title:'Mate in 1 — scholar\'s mate',fen:'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',level:'Easy',solution:['h5f7']},
{id:'p3',title:'Mate in 1 — smothered mate',fen:'6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',level:'Medium',solution:['g5f7']}
];
