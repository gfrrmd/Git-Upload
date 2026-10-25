const $=s=>document.querySelector(s),enc=s=>s.split('/').map(encodeURIComponent).join('/');
const S={t:sessionStorage.getItem('gt')||'',repo:'',br:'',path:''};
let tm;
const say=(t,e)=>{const m=$('#msg');clearTimeout(tm);if(!t){m.classList.remove('show');return}
  m.textContent=t;m.className='show'+(e?' err':'');
  if(!/^(Mengunggah|Menyiapkan)/.test(t))tm=setTimeout(()=>m.classList.remove('show'),e?9000:5000)};
const P=$('#prog'),pi=P.firstElementChild;
const prog={ind(){P.className='on ind';pi.style.width=''},set(f){P.className='on';pi.style.width=Math.round(f*100)+'%'},
  end(){if(!P.classList.contains('ind'))pi.style.width='100%';setTimeout(()=>{P.className='';pi.style.width='0'},450)}};
const act=(f,b)=>async(...a)=>{const el=b&&$(b);el&&el.classList.add('busy');prog.ind();
  try{await f(...a)}catch(e){say(e.message,1)}finally{el&&el.classList.remove('busy');prog.end()}};
async function api(p,o={},accept){
  const r=await fetch(p.startsWith('http')?p:'https://api.github.com'+p,{...o,headers:{Authorization:'Bearer '+S.t,Accept:accept||'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok){let m=r.statusText;try{m=(await r.json()).message}catch{}throw Error(r.status+': '+m)}
  return r;
}
const J=(p,o)=>api(p,o).then(r=>r.json());
const send=(p,b,method='POST')=>J(p,{method,body:JSON.stringify(b)});
const b64=d=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob([d]))});
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4e4)};

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
    tree.push({path,mode:'100644',type:'blob',sha:b.sha});say(`Mengunggah ${++done} dari ${files.length} file...`);prog.set(.9*done/files.length)}}));
  return commitTree(tree,message,h,base);
}

const mk=(t,c,f)=>{const x=document.createElement('button');x.className=c;x.textContent=t;x.onclick=act(f);return x};
const tgt=()=>{$('#target').textContent=S.repo?`Tujuan: ${S.repo}, branch ${S.br}, folder /${$('#dest').value.trim().replace(/^\/+/,'')}`:'Pilih repositori terlebih dahulu.'};
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
  await commitTree(e,`Delete ${path} via Git-Upload`,h,base);say(`Terhapus: ${path}`);
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
  $('#rq').hidden=S.all.length<=12;$('#intro').hidden=true;$('#app').hidden=false;$('#who').hidden=false;
  const saved=sessionStorage.getItem('gr')||'';S.repo=S.all.some(r=>r.full_name===saved)?saved:'';
  fillRepos('');if(S.repo)await pickRepo(S.repo);else{tgt();say('Terhubung. Pilih repositori untuk mulai.')}
}

$('#connectBtn').onclick=act(connect,'#connectBtn');
$('#token').onkeydown=e=>e.key==='Enter'&&act(connect)();
$('#out').onclick=()=>{sessionStorage.clear();location.reload()};
$('#rq').oninput=()=>fillRepos($('#rq').value);
$('#repo').onchange=act(()=>pickRepo($('#repo').value));
$('#branch').onchange=act(()=>{S.br=$('#branch').value;tgt();return list('')});
$('#dest').oninput=tgt;$('#refresh').onclick=act(()=>list(S.path),'#refresh');
const tabs=document.querySelectorAll('[data-tab]'),panels=document.querySelectorAll('[data-p]');
tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.toggle('on',x===b));panels.forEach(p=>p.hidden=p.dataset.p!==b.dataset.tab);scrollTo({top:0})});
$('#zipBtn').onclick=act(async()=>{need();say('Menyiapkan unduhan...');
  const r=await api(`/repos/${S.repo}/zipball/${enc(S.br)}`);save(await r.blob(),`${S.repo.split('/')[1]}-${S.br.replace(/\//g,'-')}.zip`);say('Repositori terunduh.')},'#zipBtn');
$('#fBtn').onclick=act(async()=>{need();const p=clean($('#fpath').value);if(!p)throw Error('Masukkan path file, contoh: src/index.js');await dl(p)},'#fBtn');
const fi=$('#files'),dz=$('#drop'),show=()=>$('#dropText').textContent=fi.files.length?[...fi.files].map(f=>f.name).join(', '):'Seret file ke sini atau ketuk untuk memilih';
dz.onkeydown=e=>(e.key==='Enter'||e.key===' ')&&(e.preventDefault(),fi.click());
fi.onchange=show;
dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');fi.files=e.dataTransfer.files;show()};
$('#go').onclick=act(async()=>{
  need();if(!fi.files.length)throw Error('Pilih minimal satu file.');
  const raw=$('#dest').value.trim(),dir=raw?clean(raw):'';if(raw&&!dir)throw Error('Folder tujuan tidak valid.');
  const files=[];
  for(const f of fi.files){
    const buf=await f.arrayBuffer();
    if($('#mode').value==='extract'&&/\.zip$/i.test(f.name))(await unzip(buf)).forEach(([n,d])=>files.push([dir?dir+'/'+n:n,d]));
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
  const r=await send('/user/repos',{name,private:$('#nrVis').value==='1',auto_init:true});
  S.all.unshift(r);$('#rq').value='';fillRepos('');$('#nrName').value='';await pickRepo(r.full_name);$('#repo').value=r.full_name;say(`Repositori ${r.full_name} dibuat.`);
},'#nrBtn');
$('#nbBtn').onclick=act(async()=>{
  need();const name=$('#nbName').value.trim();if(!name)throw Error('Masukkan nama branch baru.');
  await send(`/repos/${S.repo}/git/refs`,{ref:'refs/heads/'+name,sha:await head()});
  $('#nbName').value='';await loadBranches(name);await list('');tgt();say(`Branch ${name} dibuat dan dipilih.`);
},'#nbBtn');
if(S.t)connect().catch(()=>{});
