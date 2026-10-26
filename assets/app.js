const $=s=>document.querySelector(s),enc=s=>s.split('/').map(encodeURIComponent).join('/');
const S={t:sessionStorage.getItem('gt')||'',repo:'',br:'',path:''};
const D=$('#dock'),bar=D.querySelector('.pb i');let tm;
const hide=()=>{clearTimeout(tm);D.classList.remove('show')};
function dock(s,t,sub='',pct=null){
  clearTimeout(tm);D.dataset.s=s;D.classList.add('show');$('#dkT').textContent=t;$('#dkS').textContent=sub;
  $('#dkP').textContent=pct==null||s!=='busy'?'':Math.round(pct*100)+'%';
  D.classList.toggle('ind',s==='busy'&&pct==null);
  if(s==='busy'){bar.style.transition='width .3s ease';bar.style.width=pct==null?'':Math.round(pct*100)+'%'}
  else{const ms=s==='err'?9000:5000;bar.style.transition='none';bar.style.width='100%';void bar.offsetWidth;
    bar.style.transition=`width ${ms}ms linear`;bar.style.width='0%';tm=setTimeout(hide,ms)}
}
const say=(t,e)=>{if(!t)return hide();
  const m=e&&/failed to fetch|networkerror|load failed/i.test(t)?'Gagal terhubung ke GitHub. Periksa koneksi internet kamu.':t;
  dock(e?'err':'ok',e?'Terjadi masalah':'Berhasil',m)};
const step=(t,sub,pct)=>dock('busy',t,sub,pct);
D.onclick=()=>D.dataset.s!=='busy'&&hide();
const act=(f,b,label)=>async(...a)=>{
  const el=b&&$(b);el&&el.classList.add('busy');
  const w=setTimeout(()=>{if(D.dataset.s!=='busy'||!D.classList.contains('show'))step(label||'Memproses')},200);
  try{await f(...a)}catch(e){say(e.message,1)}
  finally{clearTimeout(w);el&&el.classList.remove('busy');if(D.dataset.s==='busy')hide()}};
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.btn,.tabs button,.tx,.lk,.ib');if(!b)return;
  const r=b.getBoundingClientRect(),s=document.createElement('span'),d=Math.max(r.width,r.height)*2;
  s.className='rip';s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  b.append(s);setTimeout(()=>s.remove(),600)});
async function api(p,o={},accept){
  const r=await fetch(p.startsWith('http')?p:'https://api.github.com'+p,{...o,headers:{Authorization:'Bearer '+S.t,Accept:accept||'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok){let m=r.statusText;try{m=(await r.json()).message}catch{}throw Error(r.status+': '+m)}
  return r;
}
const J=(p,o)=>api(p,o).then(r=>r.json());
const send=(p,b,method='POST')=>J(p,{method,body:JSON.stringify(b)});
const b64=d=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob([d]))});
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4e4)};

function clean(p){
  const x=p.replace(/\\/g,'/').split('/').filter(s=>s&&s!=='.');
  if(!x.length||x.includes('..')||x[0]==='__MACOSX'||x.includes('.git')||/^(\.ds_store|thumbs\.db)$/i.test(x.at(-1)))return null;
  return x.join('/');
}
async function unzip(buf){
  const v=new DataView(buf),u=new Uint8Array(buf);let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw Error('File zip tidak valid.');
  const n=v.getUint16(e+10,true);let p=v.getUint32(e+16,true);const out=[];
  for(let k=0;k<n;k++){
    const fl=v.getUint16(p+8,true),m=v.getUint16(p+10,true),cs=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
    const name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
    if(name.endsWith('/'))continue;
    if(fl&1)throw Error('Zip berpassword tidak didukung.');
    const s=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true),raw=u.subarray(s,s+cs);
    let d;
    if(m===0)d=raw;else if(m===8)d=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw Error('Metode kompresi zip tidak didukung.');
    const c=clean(name);if(c)out.push([c,d]);
  }
  if(out.length&&out.every(([n])=>n.includes('/'))&&new Set(out.map(([n])=>n.split('/')[0])).size===1)out.forEach(o=>o[0]=o[0].split('/').slice(1).join('/'));
  return out;
}

const need=()=>{if(!S.repo||!S.br)throw Error('Pilih repositori dan branch terlebih dahulu.')};
const head=async()=>(await J(`/repos/${S.repo}/git/ref/heads/${enc(S.br)}`)).object.sha;
async function commitTree(tree,message,h,base){
  const t=await send(`/repos/${S.repo}/git/trees`,{base_tree:base,tree});
  const c=await send(`/repos/${S.repo}/git/commits`,{message,tree:t.sha,parents:[h]});
  await send(`/repos/${S.repo}/git/refs/heads/${enc(S.br)}`,{sha:c.sha},'PATCH');
  return c.sha;
}
async function commitFiles(files,message){
  const h=await head(),base=(await J(`/repos/${S.repo}/git/commits/${h}`)).tree.sha,tree=[];let i=0,done=0;
  await Promise.all(Array.from({length:4},async()=>{while(i<files.length){
    const [path,d]=files[i++],b=await send(`/repos/${S.repo}/git/blobs`,{content:await b64(d),encoding:'base64'});
    tree.push({path,mode:'100644',type:'blob',sha:b.sha});step('Mengunggah file',`${++done} dari ${files.length} file`,.05+.85*done/files.length)}}));
  step('Membuat commit','',.95);
  return commitTree(tree,message,h,base);
}

const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=d=>{let c=-1;for(let i=0;i<d.length;i++)c=crcT[(c^d[i])&255]^(c>>>8);return(c^-1)>>>0};
function makeZip(files){
  const te=new TextEncoder(),parts=[],cen=[];let off=0;
  for(const [n,d] of files){
    const nb=te.encode(n),c=crc32(d),h=new DataView(new ArrayBuffer(30)),e=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);
    h.setUint32(14,c,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nb.length,true);
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(14,0x21,true);
    e.setUint32(16,c,true);e.setUint32(20,d.length,true);e.setUint32(24,d.length,true);e.setUint16(28,nb.length,true);e.setUint32(42,off,true);
    parts.push(h,nb,d);cen.push(e,nb);off+=30+nb.length+d.length;
  }
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);
  end.setUint32(12,cen.reduce((s,x)=>s+x.byteLength,0),true);end.setUint32(16,off,true);
  return new Blob([...parts,...cen,end],{type:'application/zip'});
}
const mk=(t,c,f)=>{const x=document.createElement('button');x.className=c;x.textContent=t;x.onclick=act(f);return x};
const syncPick=()=>{const r=$('#repo'),b=$('#branch');
  $('#repoV').textContent=r.value||'Pilih repositori';$('#brV').textContent=b.value||'-';$('#brBtn').disabled=!r.value};
function openPick(sel,title){
  const sh=$('#sheet'),ul=$('#shL'),q=$('#shQ'),opts=[...sel.options].filter(o=>o.value);
  const close=()=>{sh.classList.remove('open');document.body.style.overflow='';setTimeout(()=>sh.hidden=true,300)};
  const draw=f=>{ul.replaceChildren();opts.filter(o=>o.text.toLowerCase().includes(f.trim().toLowerCase())).forEach((o,i)=>{
    const li=document.createElement('li'),b=document.createElement('button');b.type='button';
    b.className=o.value===sel.value?'sel':'';b.textContent=o.text;li.style.setProperty('--i',Math.min(i,10));
    b.onclick=()=>{close();if(sel.value!==o.value){sel.value=o.value;sel.dispatchEvent(new Event('change'))}};li.append(b);ul.append(li)});
    if(!ul.children.length){const li=document.createElement('li');li.className='none';li.textContent='Tidak ada hasil';ul.append(li)}};
  $('#shT').textContent=title;q.hidden=opts.length<=8;q.value='';q.oninput=()=>draw(q.value);draw('');
  $('.shd').onclick=close;document.body.style.overflow='hidden';sh.hidden=false;void sh.offsetWidth;sh.classList.add('open');
  setTimeout(()=>ul.querySelector('.sel')?.scrollIntoView({block:'center'}),60);
}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#sheet').classList.contains('open'))$('.shd').click();if($('#tsheet').classList.contains('open'))tClose()});
const tgt=()=>syncPick();
async function list(p=''){
  need();S.path=p;
  const d=await J(`/repos/${S.repo}/contents${p?'/'+enc(p):''}?ref=${encodeURIComponent(S.br)}`);
  const a=(Array.isArray(d)?d:[d]).sort((x,y)=>(x.type==='dir'?0:1)-(y.type==='dir'?0:1)||x.name.localeCompare(y.name));
  $('#crumb').textContent='/'+p;const ul=$('#rows');ul.replaceChildren();
  const add=(label,type,path,up)=>{
    const li=document.createElement('li');li.style.setProperty('--i',Math.min(ul.children.length,12));
    const b=mk(type==='dir'&&!up?label+'/':label,'lk '+(type==='dir'?'dir':''),()=>type==='dir'?list(path):dl(path));li.append(b);
    if(!up){const w=document.createElement('span');w.className='ac';
      if(type!=='dir')w.append(mk('Unduh','tx',()=>dl(path)));
      w.append(mk('Hapus','tx d',()=>del(path,type)));li.append(w)}
    ul.append(li)};
  if(p)add('..','dir',p.split('/').slice(0,-1).join('/'),true);
  a.forEach(i=>add(i.name,i.type,i.path));
  if(!a.length){const li=document.createElement('li');li.className='empty';li.textContent='Folder ini kosong. Unggah file untuk memulai.';ul.append(li)}
}
async function dl(path){
  const r=await api(`/repos/${S.repo}/contents/${enc(path)}?ref=${encodeURIComponent(S.br)}`,{},'application/vnd.github.raw+json');
  save(await r.blob(),path.split('/').pop());say('Terunduh: '+path);
}
async function del(path,type){
  if(!confirm(`Hapus ${path}${type==='dir'?' beserta seluruh isinya':''}?`))return;
  const h=await head(),base=(await J(`/repos/${S.repo}/git/commits/${h}`)).tree.sha;
  const t=await J(`/repos/${S.repo}/git/trees/${base}?recursive=1`);
  const e=t.tree.filter(x=>x.type==='blob'&&(x.path===path||x.path.startsWith(path+'/'))).map(x=>({path:x.path,mode:'100644',type:'blob',sha:null}));
  if(!e.length)throw Error('Tidak ditemukan: '+path);
  step('Menghapus',path,.6);await commitTree(e,`Delete ${path} via Git-Upload`,h,base);say(`Terhapus: ${path}`);
  await list(S.path.startsWith(path)?path.split('/').slice(0,-1).join('/'):S.path);
}
async function loadBranches(select){
  const b=await J(`/repos/${S.repo}/branches?per_page=100`),sel=$('#branch');
  sel.replaceChildren();b.forEach(x=>sel.add(new Option(x.name,x.name)));
  S.br=select||(await J(`/repos/${S.repo}`)).default_branch;sel.value=S.br;
}
async function pickRepo(name){
  S.repo=name;sessionStorage.setItem('gr',name);$('#rows').replaceChildren();$('#branch').replaceChildren();S.br='';
  if(name){await loadBranches();await list('');say('')}tgt();
}
const fillRepos=q=>{const s=$('#repo'),cur=S.repo;s.replaceChildren(new Option('Pilih repositori...',''));
  S.all.filter(r=>r.full_name.toLowerCase().includes(q.trim().toLowerCase())).forEach(r=>s.add(new Option(r.full_name+(r.private?' (privat)':''),r.full_name)));
  s.value=[...s.options].some(o=>o.value===cur)?cur:''};
async function connect(){
  S.t=$('#token').value.trim()||S.t;if(!S.t)throw Error('Tempel token GitHub terlebih dahulu.');
  const me=await J('/user').catch(e=>{S.t='';sessionStorage.removeItem('gt');throw Error('Token ditolak. '+e.message)});
  sessionStorage.setItem('gt',S.t);$('#token').value='';
  $('#login').textContent=me.login;$('#avatar').src=me.avatar_url;
  S.all=[];for(let p=1;p<=5;p++){const r=await J(`/user/repos?per_page=100&sort=updated&page=${p}`);S.all.push(...r);if(r.length<100)break}
  $('#intro').hidden=true;$('#app').hidden=false;$('#who').hidden=false;
  const saved=sessionStorage.getItem('gr')||'';S.repo=S.all.some(r=>r.full_name===saved)?saved:'';
  fillRepos('');if(S.repo)await pickRepo(S.repo);else{tgt();say('Terhubung. Pilih repositori untuk mulai.')}
}

$('#connectBtn').onclick=act(connect,'#connectBtn','Menghubungkan ke GitHub');
$('#token').onkeydown=e=>e.key==='Enter'&&act(connect)();
$('#out').onclick=()=>{sessionStorage.clear();location.reload()};
$('#repo').onchange=act(()=>pickRepo($('#repo').value),null,'Memuat repositori');
$('#branch').onchange=act(()=>{S.br=$('#branch').value;tgt();return list('')});
$('#repoBtn').onclick=()=>openPick($('#repo'),'Pilih repositori');$('#brBtn').onclick=()=>openPick($('#branch'),'Pilih branch');
$('#dest').oninput=tgt;$('#refresh').onclick=act(()=>list(S.path),'#refresh');
const tabs=document.querySelectorAll('[data-tab]'),panels=document.querySelectorAll('[data-p]');
tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.toggle('on',x===b));panels.forEach(p=>p.hidden=p.dataset.p!==b.dataset.tab);scrollTo({top:0})});
$('#zipBtn').onclick=act(async()=>{
  need();step('Menyiapkan unduhan','Membaca isi repositori');
  const h=await head(),c=await J(`/repos/${S.repo}/git/commits/${h}`),t=await J(`/repos/${S.repo}/git/trees/${c.tree.sha}?recursive=1`);
  if(t.truncated)throw Error('Repositori terlalu besar untuk diunduh lewat browser.');
  const items=t.tree.filter(x=>x.type==='blob');
  if(!items.length)throw Error('Repositori ini belum berisi file.');
  if(items.length>2000||items.reduce((s,x)=>s+(x.size||0),0)>300*1048576)throw Error('Repositori terlalu besar (maksimal 2000 file atau 300 MB).');
  const root=`${S.repo.split('/')[1]}-${S.br.replace(/\//g,'-')}`,files=[];let i=0,done=0;
  await Promise.all(Array.from({length:6},async()=>{while(i<items.length){
    const x=items[i++],r=await api(`/repos/${S.repo}/git/blobs/${x.sha}`,{},'application/vnd.github.raw+json');
    files.push([`${root}/${x.path}`,new Uint8Array(await r.arrayBuffer())]);
    step('Mengunduh repositori',`${++done} dari ${items.length} file`,.9*done/items.length)}}));
  step('Menyusun file zip','',.95);
  save(makeZip(files),root+'.zip');say(`Repositori terunduh (${files.length} file).`);
},'#zipBtn','Menyiapkan unduhan');
$('#fBtn').onclick=act(async()=>{need();const p=clean($('#fpath').value);if(!p)throw Error('Masukkan path file, contoh: src/index.js');await dl(p)},'#fBtn');
const fi=$('#files'),dz=$('#drop'),show=()=>{const n=fi.files.length;$('#dropText').textContent=n?`${n} file dipilih: ${[...fi.files].map(f=>f.name).join(', ')}`:'Seret file ke sini atau ketuk untuk memilih';dz.classList.toggle('has',n>0);dz.classList.remove('pop');void dz.offsetWidth;if(n)dz.classList.add('pop')};
dz.onkeydown=e=>(e.key==='Enter'||e.key===' ')&&(e.preventDefault(),fi.click());
fi.onchange=show;
dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');fi.files=e.dataTransfer.files;show()};
$('#go').onclick=act(async()=>{
  need();if(!fi.files.length)throw Error('Pilih minimal satu file.');
  const raw=$('#dest').value.trim(),dir=raw?clean(raw):'';if(raw&&!dir)throw Error('Folder tujuan tidak valid.');
  const files=[];
  for(const f of fi.files){
    step('Membaca file',f.name);const buf=await f.arrayBuffer();
    if(document.querySelector('[name=mode]:checked').value==='extract'&&/\.zip$/i.test(f.name))(await unzip(buf)).forEach(([n,d])=>files.push([dir?dir+'/'+n:n,d]));
    else{const n=clean(f.name);if(n)files.push([dir?dir+'/'+n:n,new Uint8Array(buf)])}
  }
  if(!files.length)throw Error('Tidak ada file yang bisa diunggah.');
  if(files.length>3000)throw Error('Terlalu banyak file (maksimal 3000).');
  const sha=await commitFiles(files,`Upload ${files.length} file(s) via Git-Upload`);
  say(`Berhasil mengunggah ${files.length} file ke ${S.repo} (${S.br}) di /${dir}. Commit ${sha.slice(0,7)}.`);
  fi.value='';show();await list(S.path);
},'#go');
$('#nrBtn').onclick=act(async()=>{
  const name=$('#nrName').value.trim();if(!/^[\w.-]+$/.test(name))throw Error('Nama repositori hanya boleh huruf, angka, strip, garis bawah, dan titik.');
  const r=await send('/user/repos',{name,private:document.querySelector('[name=vis]:checked').value==='1',auto_init:true});
  S.all.unshift(r);fillRepos('');$('#nrName').value='';await pickRepo(r.full_name);$('#repo').value=r.full_name;say(`Repositori ${r.full_name} dibuat.`);
},'#nrBtn');
$('#nbBtn').onclick=act(async()=>{
  need();const name=$('#nbName').value.trim();if(!name)throw Error('Masukkan nama branch baru.');
  await send(`/repos/${S.repo}/git/refs`,{ref:'refs/heads/'+name,sha:await head()});
  $('#nbName').value='';await loadBranches(name);await list('');tgt();say(`Branch ${name} dibuat dan dipilih.`);
},'#nbBtn');
const G=window.gutheme,ts=$('#tsheet');
const syncTheme=()=>{document.querySelectorAll('[name=tm]').forEach(r=>r.checked=r.value===G.T.mode);
  document.querySelectorAll('#sw button').forEach(b=>b.classList.toggle('on',!G.T.hex&&b.dataset.n===G.T.acc));
  $('#tc').value=G.T.hex||(G.PAL.find(x=>x[0]===G.T.acc)||G.PAL[0])[1]};
function tClose(){ts.classList.remove('open');document.body.style.overflow='';setTimeout(()=>ts.hidden=true,300)}
G.PAL.forEach(p=>{const b=document.createElement('button');b.type='button';b.dataset.n=p[0];b.style.setProperty('--c',p[1]);
  b.setAttribute('aria-label',p[0]);b.title=p[0];b.onclick=()=>{G.set({acc:p[0],hex:''});syncTheme()};$('#sw').append(b)});
document.querySelectorAll('[name=tm]').forEach(r=>r.onchange=()=>G.set({mode:r.value}));
$('#tc').oninput=e=>{G.set({hex:e.target.value});syncTheme()};
$('#themeBtn').onclick=()=>{syncTheme();document.body.style.overflow='hidden';ts.hidden=false;void ts.offsetWidth;ts.classList.add('open')};
ts.querySelector('.shd').onclick=tClose;$('#tdone').onclick=tClose;
document.querySelectorAll('.fq>button').forEach(b=>b.onclick=()=>{const o=b.parentElement.classList.toggle('open');b.setAttribute('aria-expanded',o)});
$('#tokv').onclick=()=>{const t=$('#token'),s=t.type==='password';t.type=s?'text':'password';$('#tokv').textContent=s?'Sembunyikan':'Tampilkan'};
if(S.t)connect().catch(()=>{});
