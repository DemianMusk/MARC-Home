'use strict';
const D=window.SUPPLEMENT, $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={native:'Native control',physics:'Physics replay',paired:'Initial / actuated',kinematic:'Kinematic preview',joint:'Joint samples'};
let mode='baseline',objectId='scotch_yoke',hidden=new Set(),positions={},selections={},playing=false,playTarget=null,progress=0,lastTime=0,viewerCell=null;
const row=()=>D.objects.find(x=>x.id===objectId),cells=()=>row()[mode];
const key=c=>mode+'/'+objectId+'/'+c.id;
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2400);}
function readHash(){const [m,c]=location.hash.slice(1).split('/');if(['baseline','api'].includes(m))mode=m;if(D.objects.some(r=>r.id===c))objectId=c;}
function selected(c){const value=selections[key(c)]??(c.tracks.length?'t:0':'v:0');const [kind,index]=value.split(':');return {kind,index:+index,value,entry:kind==='t'?c.tracks[+index]:c.views[+index]};}
function frame(c){const s=selected(c),p=positions[key(c)]??progress;if(!s.entry)return null;const n=s.kind==='t'?s.entry.frames.length:1;const i=Math.min(n-1,Math.round(p/1000*(n-1)));return {src:s.kind==='t'?s.entry.frames[i]:s.entry.src,i,n,sel:s,p};}
function status(c){if(c.state==='not_provided')return ['Not provided',''];if(c.state==='unavailable')return ['No output',''];if(c.state==='partial')return ['Partial output','amber'];if(c.tracks.length)return ['Motion available','green'];return ['Static only',''];}
function options(c){return (c.tracks.length?'<optgroup label="Recorded motion">'+c.tracks.map((t,i)=>`<option value="t:${i}">${esc(t.label)}</option>`).join('')+'</optgroup>':'')+(c.views.length?'<optgroup label="Static views">'+c.views.map((v,i)=>`<option value="v:${i}">${esc(v.label)}</option>`).join('')+'</optgroup>':'');}
function stop(){playing=false;playTarget=null;$('#play-all').textContent='▶ Play all';document.querySelectorAll('.card-play').forEach(b=>b.textContent='▶');}
function render(){
 stop();progress=0;positions={};$('#progress').value=0;$('#progress-value').textContent='0%';
 document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
 $('#object-select').value=objectId;$('#object-count').textContent=`${D.objects.findIndex(x=>x.id===objectId)+1} / ${D.objects.length}`;
 $('#reference').src=row().reference;$('#reference').alt=`Reference image: ${row().name}`;$('#object-title').textContent=row().name;
 $('#section-label').textContent=mode==='baseline'?'01 / METHOD COMPARISON':'02 / API ABLATION';
 $('#section-description').textContent=mode==='baseline'?'Seven methods, the same reference object. Inspect geometry and recorded motion.':'Kimi-K3 and GPT-6, each with and without MARC.';
 const examples=mode==='baseline'?['scotch_yoke','excavator_arm','dual_head_lamp2']:['rssr1','rssr2','scissor_lift2'];
 $('#featured').innerHTML=examples.map(c=>`<button data-case="${c}" class="${c===objectId?'active':''}">${esc(D.objects.find(x=>x.id===c).name)}</button>`).join('');
 $('#featured').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(mode,b.dataset.case));
 renderList();renderCards();
}
function renderList(){const q=$('#search').value.toLowerCase().trim();$('#object-list').innerHTML=D.objects.map((r,i)=>({r,i})).filter(({r})=>(r.name+' '+r.id).toLowerCase().includes(q)).map(({r,i})=>`<button class="${r.id===objectId?'active':''}" data-case="${r.id}"><span>${String(i+1).padStart(2,'0')}</span>${esc(r.name)}</button>`).join('');$('#object-list').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(mode,b.dataset.case));}
function renderCards(){
 $('#method-toggles').innerHTML=D.methods[mode].map(m=>`<button class="method-chip ${hidden.has(m)?'':'on'}" aria-pressed="${!hidden.has(m)}" data-method="${m}">${esc(D.labels[m])}</button>`).join('');
 $('#method-toggles').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop();hidden.has(b.dataset.method)?hidden.delete(b.dataset.method):hidden.add(b.dataset.method);renderCards();});
 const visible=cells().filter(c=>!hidden.has(c.id));$('#cards').className='cards '+mode+(visible.length===2?' two':visible.length===1?' one':'');
 $('#cards').innerHTML=visible.map(c=>{const [tag,color]=status(c);const f=frame(c);return `<article class="card ${['km','gm'].includes(c.id)?'marc':''}" data-id="${c.id}"><div class="card-head"><h3>${esc(c.label)}</h3><span class="pill ${color}">${tag}</span></div>${f?`<button class="stage" aria-label="Enlarge ${esc(c.label)}"><img src="${f.src}" alt="${esc(c.label+' — '+row().name)}" decoding="sync"><span class="expand">↗</span></button><div class="card-body"><select class="track-select" aria-label="${esc(c.label)} view or motion">${options(c)}</select><div class="card-scrub"><button class="card-play" aria-label="Play ${esc(c.label)}">▶</button><input class="card-slider" type="range" min="0" max="1000" value="${f.p}" aria-label="${esc(c.label)} sequence position"><span class="frame-count"></span></div><p class="track-caption"></p>${c.note?`<p class="cell-note">${esc(c.note)}</p>`:''}</div>`:`<div class="empty-stage"><span class="empty-icon" aria-hidden="true">◇</span><b>${c.state==='not_provided'?'Not in this result set':'No renderable output'}</b><small>${esc(c.note)}</small></div>`}</article>`;}).join('')||'<div class="empty-filter">Select a method above to display its results.</div>';
 visible.forEach(c=>{const el=$(`.card[data-id="${c.id}"]`);if(!frame(c))return;const select=el.querySelector('.track-select');select.value=selected(c).value;
 select.onchange=()=>{stop();selections[key(c)]=select.value;positions[key(c)]=0;updateCard(c);};
 el.querySelector('.stage').onclick=()=>openViewer(c);
 el.querySelector('.card-slider').oninput=e=>{stop();positions[key(c)]=+e.target.value;updateCard(c);};
 el.querySelector('.card-play').onclick=()=>{if(playing&&playTarget===c.id){stop();return;}stop();playing=true;playTarget=c.id;lastTime=performance.now();el.querySelector('.card-play').textContent='Ⅱ';};
 updateCard(c);
 });
 const withImage=visible.filter(c=>c.views.length||c.tracks.length).length,withTrack=visible.filter(c=>c.tracks.length).length;
 $('#availability').textContent=`${visible.length} panels · ${withImage} with visual output · ${withTrack} with recorded sequences`;
 const playable=visible.some(c=>selected(c).kind==='t');$('#play-all').disabled=!playable;$('#progress').disabled=!playable;
}
function updateCard(c){const el=$(`.card[data-id="${c.id}"]`),f=frame(c);if(!el||!f)return;const img=el.querySelector('.stage img');if(img.getAttribute('src')!==f.src)img.src=f.src;
 el.querySelector('.card-slider').value=f.p;el.querySelector('.card-slider').disabled=f.n<2;el.querySelector('.card-play').disabled=f.n<2;
 el.querySelector('.frame-count').textContent=f.n>1?`${f.i+1}/${f.n}`:'Still';
 const e=f.sel.entry;el.querySelector('.track-caption').textContent=f.sel.kind==='t'?`${kinds[e.kind]||'Recorded sequence'} · ${e.captions?.[f.i]?e.captions[f.i]+'. ':''}${e.note||''}`:'Static geometry view. Use the menu to switch views or select a recorded motion.';
 if(viewerCell?.id===c.id&&$('#viewer').open)updateViewer();
}
function updateAll(p){progress=p;$('#progress').value=p;$('#progress-value').textContent=Math.round(p/10)+'%';cells().forEach(c=>{positions[key(c)]=p;updateCard(c);});if(viewerCell&&$('#viewer').open)updateViewer();}
function navigate(m,c){if(m!==mode)hidden=new Set();mode=m;objectId=c;const h=`#${m}/${c}`;if(location.hash!==h){history.replaceState(null,'',h);}render();}
function tick(now){if(playing){const delta=(now-lastTime)/6000*1000*+$('#speed').value;if(playTarget){const c=cells().find(c=>c.id===playTarget);positions[key(c)]=((positions[key(c)]??progress)+delta)%1001;updateCard(c);}else updateAll((progress+delta)%1001);}lastTime=now;requestAnimationFrame(tick);}
function openViewer(c){viewerCell=c;$('#viewer').showModal();updateViewer();}
function updateViewer(){let src,title,caption,p=0,n=1;if(viewerCell){const f=frame(viewerCell);src=f.src;title=viewerCell.label+' — '+row().name;caption=f.sel.kind==='t'?`${f.sel.entry.label} · Frame ${f.i+1} of ${f.n}. ${f.sel.entry.note}`:f.sel.entry.label;p=f.p;n=f.n;$('#viewer-kind').textContent=f.sel.kind==='t'?kinds[f.sel.entry.kind]:'Static view';}else{src=row().reference;title=row().name;caption='Input reference';$('#viewer-kind').textContent='REFERENCE IMAGE';}
 const im=$('#viewer-image');if(im.getAttribute('src')!==src)im.src=src;im.alt=title;$('#viewer-title').textContent=title;$('#viewer-caption').textContent=caption;$('#viewer-slider').value=p;$('.viewer-controls').style.display=n>1?'flex':'none';
}
$('#object-select').innerHTML=D.objects.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
$('#object-select').onchange=e=>navigate(mode,e.target.value);
$('#search').oninput=renderList;
$('#prev-object').onclick=()=>{const i=D.objects.findIndex(r=>r.id===objectId);navigate(mode,D.objects[(i+D.objects.length-1)%D.objects.length].id);};
$('#next-object').onclick=()=>{const i=D.objects.findIndex(r=>r.id===objectId);navigate(mode,D.objects[(i+1)%D.objects.length].id);};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>navigate(b.dataset.mode,b.dataset.mode==='api'&&objectId==='scotch_yoke'?'rssr1':objectId));
$('#show-all').onclick=()=>{hidden.clear();renderCards();};
$('#progress').oninput=e=>{stop();updateAll(+e.target.value);};
$('#play-all').onclick=()=>{if(playing&&playTarget===null){stop();return;}stop();playing=true;playTarget=null;lastTime=performance.now();$('#play-all').textContent='Ⅱ Pause all';};
$('#reset-all').onclick=()=>{stop();updateAll(0);};
$('#reference-enlarge').onclick=()=>{viewerCell=null;$('#viewer').showModal();updateViewer();};
$('#viewer-close').onclick=()=>$('#viewer').close();
$('#viewer-slider').oninput=e=>{stop();if(viewerCell){positions[key(viewerCell)]=+e.target.value;updateCard(viewerCell);}};
function stepFrame(dir){stop();if(!viewerCell)return;const f=frame(viewerCell);positions[key(viewerCell)]=Math.min(f.n-1,Math.max(0,f.i+dir))/(f.n-1)*1000;updateCard(viewerCell);}
$('#viewer-prev').onclick=()=>stepFrame(-1);$('#viewer-next').onclick=()=>stepFrame(1);
$('#about-open').onclick=()=>{$('#about').showModal();};$('#about-close').onclick=()=>$('#about').close();
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied');}catch{toast('Use the address bar to copy this comparison link.');}};
window.addEventListener('hashchange',()=>{readHash();render();});
document.addEventListener('keydown',e=>{if($('#viewer').open&&['ArrowLeft','ArrowRight'].includes(e.key)&&e.target.tagName!=='INPUT'){e.preventDefault();stepFrame(e.key==='ArrowLeft'?-1:1);}});
readHash();render();requestAnimationFrame(tick);
