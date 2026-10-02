// Runs the search off the main thread so the UI never freezes.
import{chooseMove}from'./ai.js';
onmessage=e=>postMessage(chooseMove(e.data.s,e.data.cfg));
