/* IndexedDB wrapper. Stores: games (compact: start FEN + UCI move list), kv (stats, settings). */
const DB=(()=>{let db;
 const open=()=>db?Promise.resolve(db):new Promise((ok,no)=>{const r=indexedDB.open('offline-chess',1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('games',{keyPath:'id',autoIncrement:true});r.result.createObjectStore('kv')};
  r.onsuccess=()=>ok(db=r.result);r.onerror=()=>no(r.error)});
 const tx=(st,mode,fn)=>open().then(d=>new Promise((ok,no)=>{const q=fn(d.transaction(st,mode).objectStore(st));q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)}));
 return{get:k=>tx('kv','readonly',s=>s.get(k)),set:(k,v)=>tx('kv','readwrite',s=>s.put(JSON.parse(JSON.stringify(v)),k)),
  putGame:g=>tx('games','readwrite',s=>s.put(g)),game:id=>tx('games','readonly',s=>s.get(id)),games:()=>tx('games','readonly',s=>s.getAll())}})();
