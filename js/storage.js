// Tiny localStorage wrapper: values are merged over defaults so new keys never break old saves.
export const load=(k,d)=>{try{return{...d,...JSON.parse(localStorage.getItem(k))}}catch{return d}};
export const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
