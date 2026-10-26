const U=['model','chinchin'],M='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),W='Mon Tue Wed Thu Fri Sat Sun'.split(' ');
const $=s=>document.querySelector(s),f=$('#f'),dlg=$('#dlg');
const ls=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch(e){}};
const pad=n=>String(n).padStart(2,'0'),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,pd=s=>{const[y,m,d]=s.split('-');return new Date(y,m-1,d)};
const add=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return iso(d)},today=()=>iso(new Date());
const fd=s=>{const d=pd(s);return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`};
const hm0=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`,hm=m=>hm0(m)+(m>=1440?'<sup>+1</sup>':''),pt=v=>{const[h,m]=v.split(':');return h*60+ +m};
const dur=m=>m>=60?`${Math.floor(m/60)}h${m%60?' '+m%60+'m':''}`:`${m}m`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`),key=t=>t.trim().toLowerCase();
const S={date:today(),view:'day',mob:ls('mob')||'tabs',who:ls('who')||U[0],tasks:[],stats:{titles:[],total:{}},ci:new Map(),nm:new Map(),tok:0,tm:'none',ed:null,cl:new Set(JSON.parse(ls('cl')||'[]'))};
const api=(m,b,q='')=>fetch('/api/tasks'+q,{method:m,body:b&&JSON.stringify(b),headers:{'Content-Type':'application/json'}}).then(r=>r.json());
const wk=()=>{const o=(pd(S.date).getDay()+6)%7;return [...Array(7)].map((_,i)=>add(S.date,i-o))};
const UK='\0u',col=k=>{if(k==UK)return 'var(--unk)';let i=S.ci.get(k);if(i==null){i=0;for(const c of k)i=(i*31+c.charCodeAt(0))%997}return `hsl(${(i*137.508+18)%360} 44% 54%)`};

const tl=ts=>{const tm=ts.filter(t=>t.s>=0&&!t.par).sort((a,b)=>a.s-b.s),end=Math.max(1440,...tm.map(t=>Math.max(t.s,t.e))),o=Array(end).fill(null),sg=[];
  tm.map(t=>({t,s:t.s,e:t.e>=0?t.e:tm.find(x=>x.s>t.s)?.s??end})).sort((a,b)=>(a.t.d|0)-(b.t.d|0)).forEach(x=>o.fill(x.t,x.s,Math.min(x.e,end)));
  o.forEach((t,m)=>{if(!t)return;const l=sg.at(-1);l&&l.t==t&&l.e==m?l.e++:sg.push({t,id:t.id,k:key(t.title),n:t.title.trim(),d:t.d,s:m,e:m+1})});const un=[];if(tm.length)o.forEach((t,m)=>{if(t)return;const l=un.at(-1);l&&l.e==m?l.e++:un.push({k:UK,n:'Unknown',d:1,s:m,e:m+1})});return {end,sg,un}};
const agg=sg=>{const m={};sg.forEach(x=>(m[x.k]??={k:x.k,n:x.n,d:0}).d+=x.e-x.s);return Object.values(m).sort((a,b)=>b.d-a.d)};
const lane=(sg,end)=>`<div class=bar>${sg.map(x=>`<i${x.d?'':' class=f'} title="${esc(x.n)} · ${hm0(x.s)}–${hm0(x.e)}" style="left:${x.s/end*100}%;width:${(x.e-x.s)/end*100}%;background:${col(x.k)}"></i>`).join('')}</div>`;
const bar=({end,sg,un=[]},sm,n)=>`<div class=bars style="--h:${end/60}">${n!=null&&n<end?`<u style="left:${n/end*100}%"></u>`:''}${lane([...un,...sg],end)}</div>`+
  (sm?'':`<div class=scale>${[...Array(Math.floor(end/360)+1)].map((_,i)=>`<span style="left:${i*360/end*100}%">${pad(i*6%24)}</span>`).join('')}</div>`);
const svg=(pc,sz,txt,tk)=>`<svg class=ring viewBox="0 0 42 42" width=${sz} height=${sz}><circle class=trk cx=21 cy=21 r=15.9155 />${pc.map(x=>`<circle${x.d?'':' class=f'} cx=21 cy=21 r=15.9155 style="stroke:${col(x.k)}" stroke-dasharray="${x.l} ${100-x.l}" stroke-dashoffset="${25-x.a}"/>`).join('')}${tk?'<path class=tk d="M21 .6v1.6M41.4 21h-1.6M21 41.4v-1.6M.6 21h1.6"/>':''}${txt?`<text x=21 y=23.2>${txt}</text>`:''}</svg>`;
const ring=(sg,sz=120,lb=1,un=[])=>{const T=sg.reduce((s,x)=>s+x.e-x.s,0),pc=[];[...un,...sg].forEach(x=>(x.s>=1440?[[x.s-1440,x.e-1440]]:x.e>1440?[[x.s,1440],[0,x.e-1440]]:[[x.s,x.e]]).forEach(([a,b])=>pc.push({k:x.k,d:x.d,a:a/14.4,l:(b-a)/14.4})));return svg(pc,sz,lb&&(T?dur(T):'—'),1)};
const pie=(a,sz)=>{const T=a.reduce((s,x)=>s+x.d,0);let o=0;return svg(a.map(x=>{const r={k:x.k,d:1,a:o,l:x.d/T*100};o+=r.l;return r}),sz,T?dur(T):'—')};
const li=(x,v,c='')=>`<li${c}><b style="background:${col(x.k)}"></b><span>${esc(x.n)||'<i>untitled</i>'}</span><em>${v}</em></li>`;
const lg=a=>{const T=a.reduce((s,x)=>s+x.d,0);return a.length?`<ul class=lg>${a.map(x=>li(x,`${dur(x.d)} · ${Math.round(x.d/T*100)}%`)).join('')}</ul>`:'<p class="lg empty">No timed tasks yet</p>'};

const subs=t=>S.tasks.filter(x=>x.par==t.id),pc=t=>col(key(t.title));
const subSg=(P,l)=>{const tm=l.filter(x=>x.s>=0).sort((a,b)=>a.s-b.s);return tm.map((x,i)=>({x,s:x.s,e:x.e>=0?x.e:tm.slice(i+1).find(y=>y.s>x.s)?.s??P.e})).map(g=>({...g,s:Math.max(g.s,P.s),e:Math.min(g.e,P.e)})).filter(g=>g.e>g.s)};
const sbar=P=>{const g=P.e>=0?subSg(P,subs(P)):[];return g.length?`<div class=sbar title="Subtasks">${g.map((x,i)=>`<i title="${esc(x.x.title)} · ${hm0(x.s)}–${hm0(x.e)}" style="left:${(x.s-P.s)/(P.e-P.s)*100}%;width:${(x.e-x.s)/(P.e-P.s)*100}%;background:${pc(P)};opacity:${x.x.d?.3:i%2?.55:.85}"></i>`).join('')}</div>`:''};
const subRow=(P,x)=>`<div class="sr${x.d?' sdn':''}" style="--c:${pc(P)}"><button class="cb${x.d?' on':''}" data-cb=${x.id} aria-label=Done></button><input class=si data-f=title data-sid=${x.id} value="${esc(x.title)}" placeholder="Subtask" enterkeyhint=done autocomplete=off>${P.e>=0?`<button class="tbtn${x.s<0?' none':''}" data-tt=${x.id}>${x.s<0?'+ time':hm(x.s)+(x.e>=0?' – '+hm(x.e):'')}</button>`:''}<button class="xb red" data-del=${x.id} aria-label=Delete>×</button></div>`;
const nowM=()=>{const d=new Date(),m=d.getHours()*60+d.getMinutes();return S.date==today()?m:S.date==add(today(),-1)?m+1440:null};
const sv=t=>{const l=subs(t);if(!l.length)return '';const o=!S.cl.has(t.id);
  return `<div class=sh><button class="sc${o?' ex':''}" data-tg=${t.id} aria-expanded=${o}><i>›</i>${l.filter(x=>x.d).length}/${l.length} subtasks</button>${sbar(t)}</div>`+(o?`<div class=sl style="--c:${pc(t)}">${l.map(x=>`<div class="sli${x.d?' sdn':''}"><button class="cb${x.d?' on':''}" data-cb=${x.id} aria-label=Done></button><span>${esc(x.title)||'<i>Untitled</i>'}</span>${x.s>=0?`<em>${hm(x.s)}${x.e>=0?'–'+hm(x.e):''}</em>`:''}</div>`).join('')}</div>`:'')};
const item=(t,c)=>{const cb=`<button class="cb${t.d?' on':''}" data-cb=${t.id} aria-label=Done></button>`,cl=`it${t.s<0?' nt':''}${subs(t).length?' hs':''}${t.d?' dn':''}${c.includes(t.id)?' now':''}${S.sel?.has(t.id)?' sel':''}`,st=`data-id=${t.id} style="--c:${t.s>=0?col(key(t.title)):'transparent'}"`;
  return t.id==S.open?`<li class="${cl} open" ${st}><div class=exh>${cb}${t.s>=0?`<button class=tbtn data-tt=${t.id}>${hm(t.s)}${t.e>=0?' – '+hm(t.e):''}</button>`:`<button class="tbtn none" data-tt=${t.id}>+ Add time</button>`}<span class=sp></span><button class="xb red" data-del=${t.id}>Delete</button><button class=xb data-done=1>Done</button></div>`+
    `<input class=et data-f=title value="${esc(t.title)}" placeholder="Title" enterkeyhint=done autocomplete=off><textarea class=ed data-f=detail rows=2 placeholder="Add details…">${esc(t.detail)}</textarea><div class=subs>${sbar(t)}${subs(t).map(x=>subRow(t,x)).join('')}<button class=sadd data-as=${t.id}>+ subtask</button></div></li>`
  :`<li class="${cl}" ${st}>${S.sel?'<i class=ck></i>':cb}${t.s>=0?`<time>${hm(t.s)}${t.e>=0?`<i></i><span>${hm(t.e)}</span>`:''}</time>`:''}<div><b>${esc(t.title)||'<i>Untitled</i>'}</b>${t.detail?`<p>${esc(t.detail)}</p>`:''}${sv(t)}</div></li>`};
const dayCol=u=>{const ts=S.tasks.filter(t=>t.user==u&&!t.par),t=tl(ts),a=agg(t.sg),n=nowM(),c=n==null?[]:t.sg.filter(x=>x.s<=n&&n<x.e).map(x=>x.id);
  return `<section class=col data-u=${u}><h2>${u}</h2><div class=sum>${bar(t,0,n)}<div class=rw>${ring(t.sg,120,1,t.un)}${lg(a.length?[...a,{k:UK,n:'Unknown',d:t.end-a.reduce((s,x)=>s+x.d,0)}]:a)}</div></div><ul class=list>${ts.map(x=>item(x,c)).join('')}</ul><div class=acts><button class=add data-u=${u}>+ add a task</button>${ts.some(x=>x.s>=0)?`<button class=srt data-srt=${u} title="Sort by time">⇅<span> Sort by time</span></button>`:''}${ts.length?`<button class=srt data-sel=1 title="Select">☑<span> Select</span></button>`:''}</div></section>`};
const weekCol=u=>{const ds=wk();
  const rows=ds.map((d,i)=>{const t=tl(S.tasks.filter(x=>x.user==u&&x.date==d)),a=agg(t.sg),T=a.reduce((s,x)=>s+x.d,0);
    return `<div class="wr${d==S.date?' on':''}" data-d=${d}><span class=wd>${W[i]}<small>${pd(d).getDate()} ${M[pd(d).getMonth()]}</small></span>${ring(t.sg,40,0,t.un)}<div class=wb>${bar(t,1)}<small>${T?dur(T)+' · '+a.slice(0,3).map(x=>esc(x.n)).join(', '):'—'}</small></div></div>`}).join('');
  const tot=o=>Object.entries(o?.[u]||{}).map(([k,d])=>({k,n:S.nm.get(k)||k,d})).sort((a,b)=>b.d-a.d),mt=tot(S.stats.total);
  return `<section class=col data-u=${u}><h2>${u}<small>${fd(ds[0])} – ${fd(ds[6])}</small></h2><div class=sum>${rows}</div><div class=sum><h3>All time</h3><div class=rw>${pie(mt,140)}${lg(mt)}</div></div></section>`};

const render=()=>{Object.assign(document.body.dataset,{mob:S.mob,who:S.who,view:S.view});
  $('#dl').textContent=fd(S.date);$('#today').disabled=S.date==today();
  document.querySelectorAll('[data-v],[data-m],[data-w]').forEach(b=>b.classList.toggle('on',[S.view,S.mob,S.who].includes(b.dataset.v||b.dataset.m||b.dataset.w)));
  $('#app').innerHTML=`<div class=cols>${U.map(S.view=='day'?dayCol:weekCol).join('')}</div>`;document.querySelectorAll('.it.open .ed').forEach(sz);
  $('#selbar').hidden=!S.sel;document.body.toggleAttribute('data-sel',!!S.sel);if(S.sel)$('#sc').textContent=`${S.sel.size} selected`
  if(pp){const e=performance.now()-pp.t,b=e<450&&document.querySelector(`[data-cb="${pp.id}"]`);if(b)b.classList.add(pp.c),b.style.setProperty('--dl',-e+'ms');else if(e>=450)pp=null}};
let pp=null;
const sz=x=>{x.style.height='auto';x.style.height=x.scrollHeight+2+'px'},busy=()=>dlg.open||lp?.on||document.activeElement?.matches('#app input,#app textarea');
const load=async()=>{const k=++S.tok,[t,s]=await Promise.all([api('GET',null,'?dates='+(S.view=='day'?[S.date]:wk()).join(',')),fetch('/api/stats').then(r=>r.json())]);
  if(k!=S.tok)return;S.tasks=t;S.stats=s;S.ci=new Map(s.titles.map((x,i)=>[key(x),i]));S.nm=new Map(s.titles.map(x=>[key(x),x]));render()};
const sortT=async u=>{const g=[[]];S.tasks.filter(t=>t.user==u&&!t.par).forEach(t=>t.s>=0?g.push([t]):g.at(-1).push(t));
  await fetch('/api/order',{method:'POST',body:JSON.stringify({date:S.date,ids:[g[0],...g.slice(1).sort((a,b)=>a[0].s-b[0].s)].flat().map(t=>t.id)})});load()};
const go=d=>{S.date=d;S.open=null;S.sel?.clear();$('#cal').hidden=true;load()};

const cal=async m=>{S.cal=m;const d=pd(m),y=d.getFullYear(),mo=d.getMonth(),o=(d.getDay()+6)%7,ds=[...Array(new Date(y,mo+1,0).getDate())].map((_,i)=>iso(new Date(y,mo,i+1)));
  const has=new Set((await api('GET',null,'?dates='+ds.join(','))).map(t=>t.date)),td=today();
  $('#cal').innerHTML=`<div class=ch><button data-cm=-1>‹</button><b>${M[mo]} ${y}</b><button data-cm=1>›</button></div><div class=cg>${W.map(w=>`<span>${w[0]}</span>`).join('')}${'<span></span>'.repeat(o)}${ds.map(x=>`<button data-cd=${x} class="${x==S.date?'on':''} ${x==td?'td':''} ${has.has(x)?'dot':''}">${+x.slice(8)}</button>`).join('')}</div>`;$('#cal').hidden=false};

const setTm=m=>{S.tm=m;$('#ts').hidden=m=='none';$('#te').hidden=m!='range';$('#zm').hidden=m=='none';document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==m));drawPk()};
const pk={ps:new Map},cur=()=>({s:S.tm=='none'?-1:tv(f.s.value,f.sn.checked,-1),e:S.tm=='range'?tv(f.e.value,f.en.checked,-1):-1});
const lim=()=>{const P=S.ed.par&&S.tasks.find(x=>x.id==S.ed.par),c=cur();pk.P=P;pk.lo=P?P.s:0;pk.hi=P?P.e:Math.min(2880,Math.ceil(Math.max(1440,tl(S.tasks.filter(x=>x.user==S.ed.user&&x.id!=S.ed.id)).end,c.s,c.e+180)/60)*60);pk.mw=Math.min(30,pk.hi-pk.lo);pk.emax=P?P.e:2879};
const win=(v0,vw)=>{const W=pk.hi-pk.lo;vw=Math.min(W,Math.max(pk.mw,vw));pk.vw=vw;pk.v0=Math.max(pk.lo,Math.min(v0,pk.hi-vw))};
const initWin=()=>{lim();const c=cur(),W=pk.hi-pk.lo,sp=c.s>=0&&c.e>=0?c.e-c.s:0,vw=Math.min(W,sp?sp*2:c.s>=0&&!pk.P?360:W);win((c.s<0?(pk.lo+pk.hi)/2:c.e>=0?(c.s+c.e)/2:c.s)-vw/2,vw)};
const drawPk=()=>{const el=$('#pk');if(!S.ed||(el.hidden=S.tm=='none'))return;lim();win(pk.v0??pk.lo,pk.vw||pk.hi-pk.lo);const P=pk.P,{v0,vw}=pk,c=cur(),ppm=Math.max(60,(el.clientWidth||400)-20)/vw,
  q=pk.q=[1,5,15,30,60].find(x=>x*ppm>=18)||60;pk.mn=Math.min(q,15);pk.smax=pk.emax-pk.mn;
  const sg=(a,b,st)=>{const x=Math.max(a,v0),y=Math.min(b,v0+vw);return y>x?`<i style="left:${(x-v0)/vw*100}%;width:${(y-x)/vw*100}%;${st}"></i>`:''},
  pin=(k,v)=>v>=v0&&v<=v0+vw?`<em class="pin ${k}" style="left:${(v-v0)/vw*100}%"><span>${hm0(v)}</span></em>`:'',
  ot=P?subSg(P,subs(P).filter(x=>x.id!=S.ed.id)).map(g=>({s:g.s,e:g.e,k:key(P.title)})):tl(S.tasks.filter(x=>x.user==S.ed.user&&x.id!=S.ed.id)).sg,own=!P&&S.ed.e>=0?subSg(S.ed,subs(S.ed)):[],
  ls=[1,5,10,15,30,60,120,180,360].find(x=>x*ppm>=58)||360,eg=P?[pk.lo,pk.hi].filter(m=>m>=v0&&m<=v0+vw):[],
  tk=[...Array(Math.floor(vw/ls)+2)].map((_,j)=>(Math.ceil(v0/ls)+j)*ls).filter(m=>m<=v0+vw&&!eg.some(g=>Math.abs(g-m)<ls*.5)).concat(eg),pos=m=>`left:${(m-v0)/vw*100}%`;
  el.dataset.m=S.tm;
  el.innerHTML=`<div class=pr>${tk.map(m=>`<s style="${pos(m)}"></s>`).join('')}${ot.map(x=>sg(x.s,x.e,`background:${col(x.k)}`)).join('')}${own.map(x=>sg(x.s,x.e,'').replace('<i','<i class=sb')).join('')}${c.s>=0&&c.e>=0?sg(c.s,c.e,'').replace('<i','<i class=sel'):''}${pin('s',c.s)}${pin('e',c.e)}</div>`+
    `<div class=scale>${tk.map(m=>`<span style="${pos(m)}">${hm0(m)}</span>`).join('')}</div>`};
addEventListener('resize',()=>dlg.open&&drawPk());
const setT=(s,e)=>{s=Math.max(pk.lo,Math.min(pk.smax,s));f.s.value=hm0(s);f.sn.checked=s>=1440;if(e!=null){e=Math.min(pk.emax,Math.max(e,s+pk.mn));f.e.value=hm0(e);f.en.checked=e>=1440}drawPk()};
const pkB=()=>$('#pk .pr').getBoundingClientRect(),pkF=x=>{const b=pkB();return Math.min(1,Math.max(0,(x-b.left)/b.width))};
const pkM=e=>Math.round((pk.v0+pkF(e.clientX)*pk.vw)/pk.q)*pk.q;
const zoomAt=(k,x)=>{const fr=pkF(x),m=pk.v0+fr*pk.vw;win(m-fr*pk.vw*k,pk.vw*k);drawPk()};
const pkMove=e=>{const m=pkM(e),{s:s0,e:e0}=pk.d.c;if(pk.d.box){const n=Math.max(pk.lo,Math.min(pk.emax-(e0-s0),s0+m-pk.d.a));pk.d.mv=1;return setT(n,n+e0-s0)}if(pk.d.p)return pk.d.mv=1,S.tm=='fixed'||e0<0?setT(m):pk.d.p=='s'?setT(Math.min(m,e0-pk.mn),e0):setT(s0,Math.max(m,s0+pk.mn));if(S.tm=='fixed')return setT(m);if(m!=pk.d.a)pk.d.mv=1;if(pk.d.mv)setT(Math.min(pk.d.a,m),Math.max(pk.d.a,m))};
const pkEdge=()=>{if(pk.raf)return;const t=()=>{const d=pk.d,e=pk.last;pk.raf=0;if(!d||!e||!(d.mv||d.p||S.tm=='fixed'))return;const b=pkB(),k=e.clientX<b.left+24?-1:e.clientX>b.right-24?1:0,o=pk.v0;if(!k)return;win(o+k*pk.vw*.012,pk.vw);if(pk.v0!=o){drawPk();pkMove(e)}pk.raf=requestAnimationFrame(t)};pk.raf=requestAnimationFrame(t)};
const pkPz=()=>{const[a,b]=[...pk.ps.values()];return {d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1,x:(a.clientX+b.clientX)/2}};
$('#pk').onpointerdown=e=>{pk.ps.set(e.pointerId,e);$('#pk').setPointerCapture(e.pointerId);
  if(pk.ps.size>1){if(pk.d)setT(pk.d.c.s,pk.d.c.e>=0?pk.d.c.e:null);pk.d=null;const z=pkPz();pk.pz={d:z.d,vw:pk.vw,m:pk.v0+pkF(z.x)*pk.vw};return}
  const m=pkM(e),pn=e.target.closest('.pin'),c=cur(),raw=pk.v0+pkF(e.clientX)*pk.vw;pk.d={a:m,mv:0,c,p:pn?.classList[1],box:!pn&&S.tm=='range'&&c.s>=0&&c.e>=0&&raw>=c.s&&raw<=c.e};pk.last=e;if(S.tm=='fixed'&&!pk.d.p)setT(m)};
$('#pk').onpointermove=e=>{if(pk.ps.has(e.pointerId))pk.ps.set(e.pointerId,e);
  if(pk.pz){if(pk.ps.size>1){const z=pkPz(),vw=pk.pz.vw*pk.pz.d/z.d;win(pk.pz.m-pkF(z.x)*vw,vw);drawPk()}return}
  if(!pk.d)return;pk.last=e;pkMove(e);pkEdge()};
$('#pk').onpointerup=$('#pk').onpointercancel=e=>{pk.ps.delete(e.pointerId);if(pk.pz){if(pk.ps.size<2)pk.pz=null;return}const d=pk.d;pk.d=null;if(!d||S.tm!='range'||d.mv||d.p)return;const m=d.a,{s,e:en}=d.c;
  s<0?setT(m,m+Math.max(30,pk.q)):en<0?setT(Math.min(m,s),Math.max(m,s)):Math.abs(m-s)<=Math.abs(m-en)?setT(Math.min(m,en-pk.mn),en):setT(s,m)};
let wl=null,wt=0;
addEventListener('wheel',e=>{if(!dlg.open||$('#qd').open)return;e.preventDefault();if($('#pk').hidden)return;
  let x=e.deltaX,y=e.deltaY;if(e.shiftKey&&!x)x=y,y=0;const n=performance.now();if(!wl||n-wt>150)wl=e.ctrlKey||Math.abs(y)>=Math.abs(x)?'y':'x';wt=n;
  if(wl=='x'){win(pk.v0+x/pkB().width*pk.vw,pk.vw);drawPk()}else zoomAt(Math.exp(Math.max(-60,Math.min(60,y))*(e.ctrlKey?.012:.003)),e.clientX)},{passive:false});
let hp=0;addEventListener('popstate',()=>{if(!dlg.open)return;hp=1;$('#qd').open&&$('#qd').close();dlg.close()});
dlg.addEventListener('close',()=>{if(hp){hp=0;return}if(history.state?.p)history.back()});
f.oninput=drawPk;
const openTime=t=>{S.ed=t;const P=t.par&&S.tasks.find(x=>x.id==t.par),n=new Date();$('#dh').textContent=(P?(P.title||'Untitled')+' › ':'')+(t.title||'Untitled');
  let v=t.s>=0?t.s:P?Math.max(P.s,...subs(P).filter(x=>x.s>=0&&x.id!=t.id).map(x=>x.e>=0?x.e:x.s)):S.date==today()?Math.round((n.getHours()*60+n.getMinutes())/15)*15:540,e=t.e;
  if(P){if(v>=P.e)v=P.s;if(t.s<0)e=P.e}
  f.s.value=hm0(v);f.sn.checked=v>=1440;f.e.value=e>=0?hm0(e):'';f.en.checked=e>=1440;setTm(e>=0?'range':'fixed');dlg.showModal();history.pushState({p:1},'');initWin();drawPk()};
const save=async t=>{await t._p;return api('POST',t)};
const addT=(u,par)=>{const t=par?{id:0,user:u,date:S.date,ord:0,title:'',detail:'',s:-1,e:-1,par}:nw(u);t.id=-Date.now();const tmp=t.id;S.tasks.push(t);if(!par)S.open=tmp;render();$(par?`[data-sid="${tmp}"]`:'.it.open .et')?.focus();
  t._p=api('POST',{...t,id:0}).then(r=>{t.id=r.id;t.ord=r.ord;if(S.open==tmp)S.open=r.id;document.querySelectorAll(`[data-id="${tmp}"],[data-tt="${tmp}"],[data-del="${tmp}"],[data-cb="${tmp}"],[data-sid="${tmp}"]`).forEach(x=>['id','tt','del','cb','sid'].forEach(k=>x.dataset[k]&&(x.dataset[k]=r.id)))})};
const close=async()=>{document.activeElement?.blur?.();const t=S.tasks.find(x=>x.id==S.open);S.open=null;
  const es=t?subs(t).filter(x=>!x.title.trim()):[];S.tasks=S.tasks.filter(x=>!es.includes(x));
  if(t&&!t.title.trim()&&!t.detail.trim()&&!subs(t).length){S.tasks=S.tasks.filter(x=>x!==t);render();await t._p;await api('DELETE',null,'/'+t.id);load()}else{render();es.length&&(await Promise.all(es.map(async x=>{await x._p;return api('DELETE',null,'/'+x.id)})),load())}};
const bulk=b=>fetch('/api/bulk',{method:'POST',body:JSON.stringify(b)}).then(load);
const rf=(cs,m)=>{const put=[],del=[];cs.forEach(({t,ns,ne})=>subs(t).forEach(x=>{if(x.s<0)return;if(ns<0||ne<0)return put.push({...x,s:-1,e:-1});
  const d=m=='l'?ns-t.s:m=='r'?ne-t.e:0,s=x.s+d,e=x.e>=0?x.e+d:-1,a=Math.max(s,ns),b=Math.min(e,ne);
  if(e<0?s<ns||s>=ne:b<=a)return del.push(x.id);const y={...x,s:e<0?s:a,e:e<0?-1:b};(y.s!=x.s||y.e!=x.e)&&put.push(y)}));return {put,del}};
const ask=cs=>new Promise(r=>{const q=$('#qd');q.querySelectorAll('[data-q]').forEach(b=>{const n=rf(cs,b.dataset.q).del.length;b.querySelector('small').textContent=n?`${n} removed`:'none removed'});
  q.returnValue='';q.onclose=()=>r(q.returnValue||null);q.showModal()});
const resub=async(t,ns,ne)=>{const none={put:[],del:[]};if(t.par||t.e<0||(t.s==ns&&t.e==ne)||!subs(t).some(x=>x.s>=0))return none;
  const cs=[{t,ns,ne}],m=ns<0||ne<0||(ns==t.s&&ne>=t.e)||(ne==t.e&&ns<=t.s)?'s':await ask(cs);return m&&rf(cs,m)};
const apply=r=>{r.put.forEach(y=>Object.assign(S.tasks.find(x=>x.id==y.id),{s:y.s,e:y.e}));S.tasks=S.tasks.filter(x=>!r.del.includes(x.id))};
const shift=async d=>{const ts=S.tasks.filter(t=>S.sel.has(t.id)&&t.s>=0);if(!ts.length)return;d=Math.max(-Math.min(...ts.map(t=>t.s)),Math.min(d,2879-Math.max(...ts.map(t=>Math.max(t.s,t.e)))));
  if(!d)return;const cs=ts.filter(t=>t.e>=0&&subs(t).some(x=>x.s>=0)).map(t=>({t,ns:t.s+d,ne:t.e+d})),m=cs.length?await ask(cs):'l';if(!m)return;const r=rf(cs,m);
  ts.forEach(t=>{t.s+=d;if(t.e>=0)t.e+=d});apply(r);render();bulk({put:[...ts,...r.put],del:r.del})};
const bulkDel=()=>{const ids=[...S.sel];if(ids.length){S.sel.clear();S.tasks=S.tasks.filter(t=>!ids.includes(t.id)&&!ids.includes(t.par));render();bulk({del:ids})}};
const nw=u=>{const l=S.tasks.filter(t=>t.user==u&&!t.par).at(-1),t={id:0,user:u,date:S.date,ord:0,title:'',detail:'',s:-1,e:-1};
  if(l?.s>=0){if(l.e>=0){t.s=l.e;t.e=Math.min(2879,l.e+l.e-l.s)}else t.s=Math.min(2879,l.s+30)}return t};
const tv=(v,n,def)=>v?pt(v)+(n?1440:0):def;

f.onsubmit=async e=>{e.preventDefault();let s=-1,en=-1;
  if(S.tm!='none')s=tv(f.s.value,f.sn.checked,0);if(S.tm=='range'){en=tv(f.e.value,f.en.checked,s);if(en<s)en+=1440}
  const t=S.ed,P=t.par&&S.tasks.find(x=>x.id==t.par);if(P&&s>=0){s=Math.max(P.s,Math.min(s,P.e-1));if(en>=0)en=Math.min(P.e,Math.max(en,s+1))}
  const r=await resub(t,s,en);if(!r)return;Object.assign(t,{s,e:en});dlg.close();apply(r);render();await save(t);r.put.length+r.del.length?bulk(r):load()};
$('#cx').onclick=()=>dlg.close();
dlg.onclick=e=>{if(e.target==dlg)dlg.close()};
document.addEventListener('change',e=>{const el=e.target.closest('[data-f]'),t=el&&S.tasks.find(x=>x.id==(el.dataset.sid||S.open));if(t){t[el.dataset.f]=el.value.trim();save(t)}});
document.addEventListener('input',e=>e.target.matches('.ed')&&sz(e.target));
let lp=null;const hap=()=>{try{navigator.vibrate?.(10)}catch(e){}$('#hap').click()};
$('#app').addEventListener('pointerdown',e=>{const it=e.target.closest('.it:not(.open)');if(!it||S.sel||e.button)return;
  lp={it,x:e.clientX,y:e.clientY,tm:setTimeout(()=>{lp.on=S.lp=1;hap();lp.oy=lp.y-it.getBoundingClientRect().top;lp.ids=[...it.parentNode.children].map(x=>x.dataset.id).join();it.classList.add('drag')},380)}});
addEventListener('pointermove',e=>{if(!lp)return;if(!lp.on){if(Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>8)clearTimeout(lp.tm),lp=null;return}
  const it=lp.it,y=e.clientY,p=it.previousElementSibling,n=it.nextElementSibling,mid=x=>{const r=x.getBoundingClientRect();return r.top+r.height/2};
  if(p&&y-lp.oy<mid(p)-it.offsetHeight/2+8)p.before(it),hap();else if(n&&y-lp.oy+it.offsetHeight>mid(n)+it.offsetHeight/2-8)n.after(it),hap();
  const sc=it.closest('.col'),o=getComputedStyle(sc).overflowY=='auto'?sc:null,r=o?o.getBoundingClientRect():{top:0,bottom:innerHeight};if(y<r.top+60)(o||window).scrollBy(0,-10);else if(y>r.bottom-60)(o||window).scrollBy(0,10);it.style.transform='';it.style.transform=`translateY(${y-lp.oy-it.getBoundingClientRect().top}px)`});
const endLp=()=>{if(!lp)return;clearTimeout(lp.tm);const l=lp;lp=null;if(!l.on)return;const it=l.it,ids=[...it.parentNode.children].map(x=>x.dataset.id);it.classList.remove('drag');it.style.transform='';setTimeout(()=>S.lp=0,350);
  if(ids.join()!=l.ids){hap();fetch('/api/order',{method:'POST',body:JSON.stringify({date:S.date,ids:ids.map(Number)})}).then(load)}};
addEventListener('pointerup',endLp);addEventListener('pointercancel',endLp);
addEventListener('touchmove',e=>lp?.on&&e.preventDefault(),{passive:false});addEventListener('contextmenu',e=>lp&&e.preventDefault());

const th=v=>{document.documentElement.dataset.th=v;document.querySelectorAll('#th button').forEach(b=>b.classList.toggle('on',b.dataset.th==v))};th(ls('th')||'auto');
document.onclick=async e=>{if(e.target.closest('#hap'))return;if(S.lp)return S.lp=0;if(S.open&&!e.target.closest('.it.open,#dlg,#qd'))close();
  const b=e.target.closest('button,.it,.wr,[data-cd]');if(!b){if(!e.target.closest('#cal'))$('#cal').hidden=true;return}const d=b.dataset;
  if(b.id=='prev')go(add(S.date,-1));else if(b.id=='next')go(add(S.date,1));else if(b.id=='today')go(today());
  else if(b.id=='dl')$('#cal').hidden?cal(S.date.slice(0,8)+'01'):$('#cal').hidden=true;
  else if(d.cm){const x=pd(S.cal);cal(iso(new Date(x.getFullYear(),x.getMonth()+ +d.cm,1)))}
  else if(d.cd)go(d.cd);
  else if(d.v){S.view=d.v;load()}else if(d.m){S.mob=d.m;ls('mob',d.m);render()}else if(d.w){S.who=d.w;ls('who',d.w);render()}
  else if(d.th){th(d.th);ls('th',d.th)}
  else if(d.t)setTm(d.t);
  else if(d.z){const b=pkB();zoomAt(d.z>0?.6:1/.6,b.left+b.width/2)}
  else if(d.tg){const i=+d.tg;S.cl.has(i)?S.cl.delete(i):S.cl.add(i);ls('cl',JSON.stringify([...S.cl]));render()}
  else if(d.cb){const t=S.tasks.find(x=>x.id==+d.cb);t.d=t.d?0:1;hap();pp={id:t.id,c:t.d?'pop':'un',t:performance.now()};render();await save(t);load()}
  else if(d.tt)openTime(S.tasks.find(x=>x.id==+d.tt));
  else if(d.del){const t=S.tasks.find(x=>x.id==+d.del);if(!t.par)S.open=null;S.tasks=S.tasks.filter(x=>x!==t&&x.par!=t.id);render();await t._p;await api('DELETE',null,'/'+t.id);load()}
  else if(d.done)close();
  else if(d.sel){S.sel=new Set;S.open=null;render()}else if(d.sh)shift(+d.sh);else if(d.sd)bulkDel();else if(d.sx){S.sel=null;render()}
  else if(d.srt)sortT(d.srt);
  else if(d.as){const p=S.tasks.find(x=>x.id==+d.as);addT(p.user,p.id)}
  else if(b.classList.contains('add'))addT(d.u);
  else if(d.id){const i=+d.id;if(S.sel){S.sel.has(i)?S.sel.delete(i):S.sel.add(i);render()}else if(S.open!=i){S.open=i;render()}}
  else if(d.d){S.view='day';go(d.d)}};
document.onkeydown=e=>{if(e.key=='Enter'&&e.target.matches('.et,.si'))return e.target.blur();if(e.key=='Escape'&&S.open&&!dlg.open)return close();if(dlg.open||e.target.matches('input,textarea'))return;if(e.key=='ArrowLeft')go(add(S.date,-1));if(e.key=='ArrowRight')go(add(S.date,1))};
setInterval(()=>!document.hidden&&!busy()&&load(),15000);
document.addEventListener('visibilitychange',()=>!document.hidden&&!busy()&&load());
load();
