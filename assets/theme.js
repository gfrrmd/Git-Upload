(()=>{
const PAL=[['Biru','#1d4ed8','#6b8cff'],['Ungu','#6d28d9','#a78bfa'],['Hijau','#15803d','#4ade80'],['Teal','#0f766e','#2dd4bf'],['Oranye','#c2410c','#fb923c'],['Merah','#be123c','#fb7185'],['Pink','#be185d','#f472b6'],['Grafit','#334155','#cbd5e1']];
const mq=matchMedia('(prefers-color-scheme:dark)'),T={mode:'auto',acc:'Biru',hex:''};
try{Object.assign(T,JSON.parse(localStorage.getItem('gu-theme')||'{}'))}catch(e){}
const ch=(h,i)=>parseInt(h.slice(i,i+2),16);
const lum=h=>{const[r,g,b]=[1,3,5].map(i=>ch(h,i)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b};
const mix=(h,p)=>'#'+[1,3,5].map(i=>Math.round(ch(h,i)*(1-p)+255*p).toString(16).padStart(2,'0')).join('');
function apply(){
  const dark=T.mode==='dark'||(T.mode==='auto'&&mq.matches),R=document.documentElement,p=PAL.find(x=>x[0]===T.acc)||PAL[0];
  const ac=/^#[0-9a-f]{6}$/i.test(T.hex)?(dark?mix(T.hex,.25):T.hex):(dark?p[2]:p[1]);
  R.dataset.mode=T.mode;R.style.setProperty('--ac',ac);R.style.setProperty('--acf',lum(ac)>.19?'#0b1020':'#fff');
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=dark?'#0e121a':'#f4f6f9';
  try{localStorage.setItem('gu-theme',JSON.stringify(T))}catch(e){}
}
window.gutheme={PAL,T,apply,set(p){Object.assign(T,p);apply()}};
mq.addEventListener('change',apply);apply();
})();
