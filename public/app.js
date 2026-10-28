'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=n=>{if(!n)return'0 B';const i=Math.min(4,Math.floor(Math.log(n)/Math.log(1024)));return(n/1024**i).toLocaleString('es-AR',{maximumFractionDigits:1})+' '+['B','KB','MB','GB','TB'][i];};
const duration=n=>n==null?'Sin datos':`${Math.floor(n/3600)?Math.floor(n/3600)+':':''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(Math.floor(n)%60).padStart(2,'0')}`;
let state={sources:[],categories:[],jobs:[]},source='',duplicates=false,page=0,rows=[],pages=0,queryTimer,toastTimer,listVersion=0;
const selectedVideos=new Map();
function updateSelection(){
  $('selectionCount').textContent=selectedVideos.size?`${selectedVideos.size} videos seleccionados · la selección se conserva al cambiar de página o filtro`:'Marcá videos para analizar con IA o transcribir.';
  $('clearSelection').disabled=!selectedVideos.size;
  const audio=forAction('transcribe').length,visual=forAction('ai').length;
  $('transcribeButton').textContent=selectedVideos.size?`♫ Transcribir (${audio})`:'♫ Transcribir';
  $('minutesButton').textContent=selectedVideos.size?`▤ Generar minuta (${forAction('minutes').length})`:'▤ Generar minuta';
  $('aiButton').textContent=selectedVideos.size?`✦ Analizar con IA (${visual})`:'✦ Analizar con IA';
}
function eligible(v){return !v.missing&&state.sources.find(s=>s.id===v.source_id)?.online;}
function forAction(type){return [...selectedVideos.values()].filter(v=>eligible(v)&&(type==='ai'?!v.summary:type==='minutes'?Boolean(v.transcript?.trim()):v.has_audio!==0));}
function transcriptionStatus(detail){
  const phases={loading:'Cargando el modelo',preparing:'Preparando audio y detectando voz',transcribing:'Transcribiendo',complete:'Guardando transcripción'};
  const percent=Number.isFinite(detail.percent)?Math.min(100,Math.max(0,detail.percent)):null;
  const elapsed=duration(detail.elapsed||0),eta=Number.isFinite(detail.eta)?' · Restante estimado: '+duration(detail.eta):'';
  return '<p class="transcription-status">'+esc(phases[detail.phase]||'Procesando')+(percent===null?'':': <strong>'+percent.toFixed(1)+'%</strong>')+' · Tiempo: '+elapsed+esc(eta)+'</p><progress '+(percent===null?'':'value="'+percent+'" max="100"')+' aria-label="Progreso del video actual"></progress>';
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function api(url,body){const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Videoteca-Token':window.APP_TOKEN},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(value.error||'No se pudo completar la operación.');return value;}
function guarded(fn){return async(...args)=>{try{await fn(...args);}catch(e){toast(e.message);}};}
function openSource(){$('sourceDialog').showModal();}
for(const id of ['addSource','addTop','addEmpty'])$(id).onclick=openSource;
$('browseSource').onclick=guarded(async()=>{
  const button=$('browseSource'),form=$('sourceForm'),status=$('folderPickerStatus');
  button.disabled=true;button.textContent='Selector abierto…';status.textContent='Elegí una carpeta en la ventana de Windows. Puede aparecer detrás del navegador.';
  try{
    const result=await api('/api/pick-folder',{initial:form.elements.root.value});
    if(result.root){form.elements.root.value=result.root;if(!form.elements.name.value.trim())form.elements.name.value=result.root.replace(/[\\/]+$/,'').split(/[\\/]/).pop()||result.root;status.textContent='Carpeta seleccionada. Podés agregarla e inventariarla.';}
    else status.textContent='Selección cancelada. Podés volver a elegir o escribir la ruta.';
  }finally{button.disabled=false;button.textContent='Elegir carpeta…';if(status.textContent.startsWith('Elegí una carpeta'))status.textContent='No se pudo completar la selección. Podés escribir la ruta manualmente.';}
});
document.addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))e.target.closest('dialog').close();});
$('sourceForm').onsubmit=guarded(async e=>{e.preventDefault();const form=e.target,b=Object.fromEntries(new FormData(form));const button=form.querySelector('[type=submit]');button.disabled=true;try{await api('/api/sources',b);$('sourceDialog').close();form.reset();await refresh();const added=state.sources.find(s=>s.root.toLowerCase()===b.root.trim().replace(/\\$/,'').toLowerCase())||state.sources.at(-1);source=added.id;await loadVideos();await start('scan');}finally{button.disabled=false;}});
async function refresh(){state=await api('/api/state');$('navCount').textContent=state.stats.count;$('statCount').textContent=Number(state.stats.count).toLocaleString('es-AR');$('statBytes').textContent=bytes(state.stats.bytes);$('statPending').textContent=Number(state.stats.pending||0).toLocaleString('es-AR');$('statAI').textContent=state.stats.analyzed||0;
  $('sources').innerHTML=state.sources.map(s=>`<div class="source-item"><span class="dot ${s.online?'':'off'}" title="${s.online?'Conectada':'No disponible'}"></span><button class="source-button ${source===s.id?'selected':''}" data-source="${s.id}" title="${esc(s.root)}">${esc(s.name)} · ${s.count}</button><button class="relocate" data-relocate="${s.id}" title="Cambiar ubicación de esta fuente" aria-label="Cambiar ubicación">↗</button></div>`).join('');
  $('allNav').classList.toggle('selected',!source&&!duplicates);$('dupeNav').classList.toggle('selected',duplicates);
  if(!$('category').dataset.ready){$('category').insertAdjacentHTML('beforeend',state.categories.map(c=>`<option>${esc(c)}</option>`).join(''));$('category').dataset.ready='1';}
  $('viewTitle').textContent=duplicates?'Duplicados exactos':source?state.sources.find(s=>s.id===source)?.name||'Videos':'Todos los videos';
  const job=state.jobs[0];if(job?.status==='done'&&job.errors)job.status='done_with_errors';$('jobPanel').classList.toggle('has-errors',Boolean(job?.errors));$('jobPanel').hidden=!job;if(job){const active=['running','queued'].includes(job.status);const names={scan:'Inventario',metadata:'Miniaturas y datos',duplicates:'Duplicados SHA-256',ai:'Análisis visual',transcribe:'Transcripción',minutes:'Minuta de reunión'};const statuses={running:'En curso',queued:'Iniciando',done:'Finalizado',done_with_errors:'Finalizado con errores',paused:'Pausado',interrupted:'Interrumpido',failed:'Revisar'};
    $('jobPanel').innerHTML=`<div class="job-line"><strong>${names[job.type]} · ${statuses[job.status]} ${job.total?`(${job.progress}/${job.total})`:''}</strong><div>${active?`<button data-job="${job.id}" data-action="pause">Pausar</button>`:['paused','interrupted','failed','done_with_errors'].includes(job.status)?`<button data-job="${job.id}" data-action="resume">${job.status==='done_with_errors'?'Reintentar pendientes':'Reanudar'}</button>`:''}${job.errors||job.status==='failed'?'<button id="showErrors">Ver incidencias</button>':''}</div></div><p>${esc(job.message)}</p>${active&&job.type==='transcribe'&&job.detail?transcriptionStatus(job.detail):active?`<progress ${job.total&&job.type!=='scan'?`value="${job.progress}" max="${job.total}"`:''}></progress>`:''}<div id="jobErrors"></div>`;
  }
  $('scanButton').disabled=!source;
}
async function loadVideos(){const version=++listVersion;const p=new URLSearchParams({q:$('search').value,category:$('category').value,source,duplicates:duplicates?'1':'0',page:String(page)});const data=await api('/api/videos?'+p);if(version!==listVersion)return;rows=data.rows;pages=data.pages;
  $('resultCount').textContent=`${data.total.toLocaleString('es-AR')} videos${duplicates?` · ${state.duplicates?.groups||0} grupos en la biblioteca`:''}`;
  $('empty').hidden=data.total!==0;$('grid').hidden=data.total===0;
  if(!data.total){$('empty').querySelector('h2').textContent=state.sources.length?'No hay videos en esta vista':'Tu biblioteca empieza acá';$('empty').querySelector('p').innerHTML=state.sources.length?'Probá otro filtro o inventariá una fuente.<br>La búsqueda consulta nombres, etiquetas, notas y descripciones.':'Agregá una carpeta con videos y creá el primer inventario.<br>Podés sumar discos externos y un NAS más adelante.';$('addEmpty').hidden=state.sources.length>0;}
  $('grid').innerHTML=rows.map(v=>{const s=state.sources.find(s=>s.id===v.source_id);return`<button class="card" data-video="${v.id}"><div class="cover">${v.thumbnail?`<img loading="lazy" src="/thumbnail/${v.id}?v=${v.mtime}" alt="Vista previa de ${esc(v.name)}">`:'▷'}${v.missing||!s?.online?'<span class="offline">No disponible</span>':''}<span class="duration">${duration(v.duration)}</span></div><div class="card-body"><div class="card-title" title="${esc(v.name)}">${esc(v.name)}</div><div class="card-meta"><span>${esc(v.source_name)}</span><span>${v.width?v.width+' × '+v.height+' · ':''}${bytes(v.size)}</span></div><div class="card-foot"><span class="badge ${v.category==='Pendiente'?'pending':''}">${esc(v.category)}</span><span class="ai-mark">${v.summary?'✦ IA parcial':v.hash?'SHA-256 ✓':''}</span></div></div></button>`;}).join('');
  for(const v of rows)if(selectedVideos.has(v.id)){if(eligible(v))selectedVideos.set(v.id,v);else selectedVideos.delete(v.id);}
  for(const card of $('grid').querySelectorAll('.card')){
    const v=rows.find(v=>v.id===card.dataset.video),wrapper=document.createElement('article');wrapper.className='selectable-video';card.before(wrapper);wrapper.append(card);
    const label=document.createElement('label');label.className='video-selection';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.selectVideo=v.id;checkbox.checked=selectedVideos.has(v.id);checkbox.disabled=!eligible(v);checkbox.setAttribute('aria-label','Seleccionar video: '+v.name);
    label.append(checkbox,document.createTextNode(eligible(v)?'Seleccionar video':'Video no disponible'));wrapper.append(label);
  }
  updateSelection();
  $('pageLabel').textContent=pages?`${page+1} / ${pages}`:'0 / 0';$('prev').disabled=page===0;$('next').disabled=page+1>=pages;
}
async function reload(){await refresh();await loadVideos();}
$('sources').onclick=guarded(async e=>{const item=e.target.closest('[data-source]');if(item){source=item.dataset.source;duplicates=false;page=0;await reload();}const relocate=e.target.closest('[data-relocate]');if(relocate){const s=state.sources.find(x=>x.id===relocate.dataset.relocate);const root=prompt('Nueva ruta de la misma biblioteca. Se comprobarán hasta 5 archivos; esto no copia ni mueve videos.',s.root);if(root&&root!==s.root){const result=await api('/api/relocate',{id:s.id,root});toast(`Ubicación actualizada. ${result.checked} archivos comprobados; no es una verificación completa de la migración.`);await reload();}}});
$('allNav').onclick=guarded(async()=>{source='';duplicates=false;page=0;await reload();});
$('dupeNav').onclick=guarded(async()=>{source='';duplicates=true;page=0;await reload();});
$('search').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(guarded(async()=>{page=0;await loadVideos();}),250);};
$('category').onchange=guarded(async()=>{page=0;await loadVideos();});
$('prev').onclick=guarded(async()=>{page--;await loadVideos();});$('next').onclick=guarded(async()=>{page++;await loadVideos();});
async function start(type,extra={}){await api('/api/jobs',{type,sourceId:source||undefined,...extra});await refresh();toast('Trabajo iniciado. Podés seguir explorando el catálogo.');}
$('scanButton').onclick=guarded(()=>start('scan'));$('metadataButton').onclick=guarded(()=>start('metadata'));$('hashButton').onclick=guarded(()=>start('duplicates'));
$('jobPanel').onclick=guarded(async e=>{const b=e.target.closest('[data-job]');if(b){b.disabled=true;await api('/api/job-control',{id:b.dataset.job,action:b.dataset.action});toast(b.dataset.action==='pause'?'Pausa solicitada; se completará la operación actual.':'Reanudando los archivos pendientes.');await refresh();}if(e.target.id==='showErrors'){const events=await api('/api/events');$('jobErrors').className='job-errors';$('jobErrors').textContent=events.filter(x=>x.job_id===state.jobs[0].id).map(x=>x.message).join('\n')||'No hay incidencias registradas.';}});
async function showTools(){const tools=await api('/api/tools');$('toolStatus').innerHTML=[['FFmpeg · miniaturas',tools.ffmpeg],['ffprobe · metadatos',tools.ffprobe],['Ollama · IA local',tools.ollama],['Python + faster-whisper · audio',tools.whisper]].map(([name,ok])=>`<div class="tool-row"><span>${name}</span><strong>${ok?'Disponible ✓':'Sin instalar'}</strong></div>`).join('')+(tools.models.length?'<p class="hint">Modelos: '+tools.models.map(esc).join(', ')+'</p>':'');return tools;}
$('toolsButton').onclick=guarded(async()=>{$('toolsDialog').showModal();await showTools();});$('refreshTools').onclick=guarded(showTools);
let aiIds=[];
function selectionList(type,prefix){const videos=forAction(type),skipped=selectedVideos.size-videos.length;$(prefix+'Selection').textContent=`Se procesarán únicamente estos ${videos.length} videos.`+(skipped?` Se omiten ${skipped} seleccionados que ya están procesados o no corresponden a esta tarea.`:'');$(prefix+'List').replaceChildren(...videos.map(v=>{const li=document.createElement('li');li.textContent=v.name+' · '+v.source_name;return li;}));return videos.map(v=>v.id);}
$('aiButton').onclick=guarded(async()=>{if(!forAction('ai').length){toast('Marcá videos disponibles que todavía no tengan análisis visual.');return;}toast('Comprobando herramientas locales…');const tools=await api('/api/tools');if(!tools.ffmpeg||!tools.ffprobe||!tools.ollama){$('toolsDialog').showModal();await showTools();return;}$('modelSelect').innerHTML=tools.models.map(m=>`<option ${m.includes('2b-instruct')?'selected':''}>${esc(m)}</option>`).join('');if(!tools.models.length)throw new Error('Instalá primero el modelo en Ollama. Consultá LEEME.md.');aiIds=selectionList('ai','ai');$('aiDialog').showModal();});
$('aiForm').onsubmit=guarded(async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target)),button=e.target.querySelector('[type=submit]');button.disabled=true;try{await start('ai',{sourceId:undefined,model:b.model,videoIds:aiIds});$('aiDialog').close();$('clearSelection').click();}finally{button.disabled=false;}});
$('exportButton').onclick=()=>$('exportDialog').showModal();
$('clearSelection').onclick=()=>{selectedVideos.clear();for(const input of $('grid').querySelectorAll('[data-select-video]'))input.checked=false;updateSelection();};
$('selectPage').onclick=()=>{for(const v of rows.filter(eligible)){if(selectedVideos.size>=100&&!selectedVideos.has(v.id)){toast('Podés seleccionar hasta 100 videos por trabajo.');break;}selectedVideos.set(v.id,v);}for(const input of $('grid').querySelectorAll('[data-select-video]'))input.checked=selectedVideos.has(input.dataset.selectVideo);updateSelection();};
$('grid').addEventListener('change',e=>{const id=e.target.dataset.selectVideo;if(!id)return;if(e.target.checked){if(selectedVideos.size>=100){e.target.checked=false;toast('Podés seleccionar hasta 100 videos por trabajo.');return;}selectedVideos.set(id,rows.find(v=>v.id===id));}else selectedVideos.delete(id);updateSelection();});
let transcribeIds=[];
$('transcribeButton').onclick=guarded(async()=>{if(!forAction('transcribe').length){toast('Marcá videos con audio para transcribir o volver a transcribir.');return;}toast('Comprobando transcripción local…');const tools=await api('/api/tools');if(!tools.whisper){$('toolsDialog').showModal();await showTools();return;}transcribeIds=selectionList('transcribe','transcribe');$('transcribeDialog').showModal();});
$('transcribeForm').onsubmit=guarded(async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await start('transcribe',{sourceId:undefined,videoIds:transcribeIds,device:b.device,profile:b.profile,language:b.language,overwrite:true});$('transcribeDialog').close();$('clearSelection').click();}finally{button.disabled=false;}});
$('grid').onclick=guarded(async e=>{const card=e.target.closest('[data-video]');if(!card)return;const v=rows.find(x=>x.id===card.dataset.video),s=state.sources.find(x=>x.id===v.source_id);
  $('detailContent').innerHTML=`<div class="dialog-heading"><h2>${esc(v.name)}</h2><button class="close" data-close>×</button></div>${!v.missing&&s?.online?`<video controls preload="none" ${v.thumbnail?`poster="/thumbnail/${v.id}"`:''} src="/video/${v.id}"></video><p class="hint">La reproducción depende del códec y del navegador. Si no se reproduce, abrí el archivo desde su ubicación con tu reproductor habitual.</p>`:'<div class="notice">Fuente desconectada o archivo no encontrado. Tus etiquetas y análisis se conservan.</div>'}<div class="details-meta"><span>${duration(v.duration)}</span><span>${bytes(v.size)}</span><span>${v.width?v.width+' × '+v.height:'Resolución pendiente'}</span></div><p class="path">${esc(s?.root)}${s?.root.endsWith('\\')?'':'\\'}${esc(v.rel)}</p><form id="editForm"><label>Categoría<select name="category" id="editCategory">${state.categories.map(c=>`<option ${v.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Etiquetas (separadas por comas)<input name="tags" value="${esc(v.tags)}" placeholder="Ej.: vacaciones, familia, 2024"></label><label>Notas<input name="notes" value="${esc(v.notes)}" placeholder="Agregá contexto para encontrarlo después"></label>${v.summary?`<div class="notice">✦ Análisis parcial de 5 fotogramas · ${esc(v.ai_model)}<br>Categoría sugerida: <strong>${esc(v.ai_category)}</strong> <button type="button" id="applySuggestion">Usar sugerencia</button></div><div class="description">${esc(v.summary)}</div>`:''}${v.hash?`<p class="hint">SHA-256: ${esc(v.hash)}</p>`:''}<div class="dialog-footer"><button type="button" data-close>Cerrar</button><button type="submit" class="primary">Guardar clasificación</button></div></form>`;
  $('editForm').onsubmit=guarded(async event=>{event.preventDefault();await api('/api/video',{id:v.id,...Object.fromEntries(new FormData(event.target))});$('detailDialog').close();toast('Clasificación guardada.');await reload();});
  if($('applySuggestion'))$('applySuggestion').onclick=()=>{$('editCategory').value=v.ai_category;};$('detailDialog').showModal();
  if(v.transcript!==null){const section=document.createElement('section');const title=document.createElement('h3');title.textContent='Transcripción · '+v.transcript_model;const text=document.createElement('div');text.className='description';text.textContent=v.transcript||'No se detectó voz.';section.append(title,text);appendTranscriptReview(section,v);$('editForm').before(section);}
  if(v.minutes)appendMinutes(v);
});
$('detailDialog').addEventListener('close',()=>{const video=$('detailDialog').querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}});

let minutesIds=[];
$('minutesButton').onclick=guarded(async()=>{
  if(!forAction('minutes').length){toast('Seleccioná videos con una transcripción completa. Podés corregirla antes de generar la minuta.');return;}
  const tools=await api('/api/tools');if(!tools.ollama||!tools.models.length){$('toolsDialog').showModal();await showTools();return;}
  $('minutesModel').innerHTML=tools.models.map(m=>`<option ${m==='qwen3:4b'?'selected':''}>${esc(m)}</option>`).join('');
  $('minutesVisual').innerHTML=tools.models.map(m=>`<option ${m.includes('qwen3-vl:2b')?'selected':''}>${esc(m)}</option>`).join('');
  minutesIds=selectionList('minutes','minutes');$('minutesDialog').showModal();
});
$('minutesForm').onsubmit=guarded(async e=>{
  e.preventDefault();const b=Object.fromEntries(new FormData(e.target)),button=e.target.querySelector('[type=submit]');button.disabled=true;
  try{await start('minutes',{sourceId:undefined,videoIds:minutesIds,model:b.model,visualModel:b.visualModel,readScreen:b.readScreen==='on'});$('minutesDialog').close();$('clearSelection').click();}finally{button.disabled=false;}
});
function seekButton(second){return `<button type="button" class="minute-seek" data-second="${Number(second)||0}">${duration(Number(second)||0)}</button>`;}
function enableSeeking(section){section.addEventListener('click',guarded(async e=>{const button=e.target.closest('[data-second]');if(!button)return;const video=$('detailDialog').querySelector('video');if(!video){toast('Conectá la fuente para reproducir este momento.');return;}video.currentTime=Number(button.dataset.second);await video.play();}));}
function appendTranscriptReview(section,v){
  const segments=JSON.parse(v.transcript_segments||'[]').filter(s=>s.review);
  const details=document.createElement('details');details.innerHTML=`<summary>Revisar y corregir transcripción${segments.length?' · '+segments.length+' tramos dudosos':''}</summary><p class="review-notice">La transcripción automática puede contener errores. Estas señales no detectan todos los errores. Corregir el texto invalida la minuta anterior para evitar que use una versión vieja.</p><div>${segments.map(s=>`<p>${seekButton(s.start)}${esc(s.text)}</p>`).join('')}</div><textarea class="transcript-edit" aria-label="Corregir transcripción"></textarea><button type="button" class="save-transcript">Guardar corrección</button>`;
  details.querySelector('textarea').value=v.transcript||'';
  details.querySelector('.save-transcript').onclick=guarded(async()=>{await api('/api/transcript',{id:v.id,text:details.querySelector('textarea').value});$('detailDialog').close();toast('Corrección guardada. Ya podés generar nuevamente la minuta.');await reload();});
  enableSeeking(details);section.append(details);
}
function appendMinutes(v){
  let report;try{report=JSON.parse(v.minutes);}catch{return;}
  const section=document.createElement('section');section.className='minutes-report';
  const labels={temas:'Temas tratados',decisiones:'Decisiones explícitas',acciones:'Acciones y compromisos',pendientes:'Preguntas y pendientes',nombres:'Nombres detectados'};
  const evidence=item=>(item.evidence||[]).map(ev=>`<div class="minute-evidence">${seekButton(ev.second)}${esc(ev.quote)} · ${ev.type==='screen'?'Lectura de pantalla':'Transcripción'}</div>`).join('');
  section.innerHTML='<h2>Borrador de minuta</h2><p class="review-notice">'+esc(report.notice)+'</p><p class="hint">'+esc(report.model)+' · '+esc(report.transcriptModel||'')+' · '+(report.screenSamples||0)+' muestras de pantalla'+(report.rejected?' · '+report.rejected+' elementos descartados por citas inválidas':'')+'</p>'+Object.entries(labels).map(([key,label])=>'<h3>'+label+'</h3>'+((report[key]||[]).length?(report[key]||[]).map(item=>'<p>'+esc(item.text)+(key==='nombres'?' · '+(item.kind==='visible'?'Nombre leído en pantalla; revisar etiqueta':'Nombre mencionado; asistencia no confirmada'):'')+'</p>'+evidence(item)).join(''):'<p class="muted">No se encontró evidencia suficiente en el material procesado.</p>')).join('');
  const download=document.createElement('button');download.type='button';download.textContent='Exportar minuta (.md)';download.onclick=()=>{
    const text=['# Borrador de minuta: '+v.name,report.notice,...Object.entries(labels).flatMap(([key,label])=>['\n## '+label,...(report[key]||[]).map(item=>'- '+item.text+'\n'+(item.evidence||[]).map(ev=>'  - ['+duration(ev.second)+'] '+ev.quote).join('\n'))])].join('\n\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='minuta-'+v.id+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };section.append(download);enableSeeking(section);$('editForm').before(section);
}
guarded(reload)();
let polling=false;setInterval(async()=>{if(polling)return;polling=true;try{const wasActive=state.jobs.some(j=>['running','queued'].includes(j.status));await refresh();if(wasActive||state.jobs.some(j=>['running','queued'].includes(j.status)))await loadVideos();}catch(e){$('resultCount').textContent='Sin conexión con la aplicación. Mantené abierta la ventana de inicio.';}finally{polling=false;}},3000);
