'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {openDatabase,createEngine,within,fingerprint,CATEGORIES}=require('./lib');
const {chooseFolder}=require('./folder-picker');
let pickingFolder=false;
const PORT=Number(process.env.VIDEOTECA_PORT||43127);
const DATA=path.resolve(process.env.VIDEOTECA_DATA||path.join(__dirname,'datos'));
const db=openDatabase(DATA),engine=createEngine(db,DATA);
const token=crypto.randomBytes(32).toString('hex');
const origin=`http://127.0.0.1:${PORT}`;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>1024*1024)throw new Error('Solicitud demasiado grande.');}return JSON.parse(text||'{}');}
async function exists(dir){try{return(await fs.promises.stat(dir)).isDirectory();}catch{return false;}}
async function sendFile(req,res,file,type){
  let stat;try{stat=await fs.promises.stat(file);}catch{res.writeHead(404);return res.end('Archivo no disponible. Conectá la fuente o actualizá el inventario.');}
  if(!stat.isFile()){res.writeHead(404);return res.end();}
  let start=0,end=stat.size-1;
  if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}start=Number(match[1]);if(match[2])end=Number(match[2]);if(start>end||end>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}}
  const headers={'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':Math.max(0,end-start+1),'Cache-Control':'no-store'};
  if(req.headers.range)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  res.writeHead(req.headers.range?206:200,headers);
  if(!stat.size)return res.end();
  const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
const server=http.createServer(async(req,res)=>{
  try{
    // Rechaza DNS rebinding y escrituras de otras páginas web.
    if(req.headers.host!==`127.0.0.1:${PORT}`){res.writeHead(403);return res.end('Host no permitido.');}
    if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return json(res,{error:'Acceso desde otra página rechazado.'},403);
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const url=new URL(req.url,origin),p=url.pathname;
    if(req.method!=='GET'&&(req.headers['x-videoteca-token']!==token||req.headers.origin&&req.headers.origin!==origin))return json(res,{error:'Solicitud rechazada. Recargá la aplicación.'},403);
    if(req.method==='GET'&&p==='/api/state'){
      const sources=await Promise.all(db.prepare('SELECT s.*,(SELECT COUNT(*) FROM videos v WHERE v.source_id=s.id) AS count FROM sources s ORDER BY created').all().map(async s=>({...s,online:await exists(s.root)})));
      return json(res,{sources,categories:CATEGORIES,jobs:db.prepare('SELECT * FROM jobs ORDER BY created DESC LIMIT 12').all(),stats:db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes,SUM(category='Pendiente') AS pending,SUM(thumbnail IS NOT NULL) AS thumbnails,SUM(summary!='') AS analyzed,SUM(missing=1) AS missing FROM videos`).get(),duplicates:db.prepare('SELECT COUNT(*) AS groups,COALESCE(SUM(n-1),0) AS extra,COALESCE(SUM((n-1)*size),0) AS bytes FROM (SELECT size,COUNT(*) n FROM videos WHERE hash IS NOT NULL AND missing=0 GROUP BY hash HAVING COUNT(*)>1)').get()});
    }
    if(req.method==='GET'&&p==='/api/tools')return json(res,await engine.toolsStatus());
    if(req.method==='GET'&&p==='/api/videos'){
      const clauses=[],args=[];const q=(url.searchParams.get('q')||'').slice(0,500);
      if(q){clauses.push("(v.name LIKE ? ESCAPE '\\' OR v.tags LIKE ? ESCAPE '\\' OR v.notes LIKE ? ESCAPE '\\' OR v.summary LIKE ? ESCAPE '\\' OR v.transcript LIKE ? ESCAPE '\\')");const needle='%'+q.replace(/[\\%_]/g,'\\$&')+'%';args.push(needle,needle,needle,needle,needle);}
      for(const [param,field] of [['source','source_id'],['category','category']])if(url.searchParams.get(param)){clauses.push('v.'+field+'=?');args.push(url.searchParams.get(param));}
      if(url.searchParams.get('duplicates')==='1')clauses.push('v.hash IN (SELECT hash FROM videos WHERE hash IS NOT NULL AND missing=0 GROUP BY hash HAVING COUNT(*)>1) AND v.missing=0');
      const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
      const page=Math.max(0,Number(url.searchParams.get('page'))||0),limit=48;
      const total=db.prepare('SELECT COUNT(*) n FROM videos v'+where).get(...args).n;
      const rows=db.prepare('SELECT v.*,s.name source_name FROM videos v JOIN sources s ON s.id=v.source_id'+where+' ORDER BY v.name COLLATE NOCASE LIMIT ? OFFSET ?').all(...args,limit,page*limit);
      return json(res,{rows,total,page,pages:Math.ceil(total/limit)});
    }
    if(req.method==='POST'&&p==='/api/pick-folder'){
      if(pickingFolder)return json(res,{error:'Ya hay un selector de carpetas abierto. Revisá las ventanas de Windows.'},409);
      const b=await body(req);pickingFolder=true;
      try{return json(res,await chooseFolder(b.initial||''));}finally{pickingFolder=false;}
    }
    if(req.method==='POST'&&p==='/api/sources'){
      const b=await body(req),root=path.resolve(String(b.root||'').trim());
      if(!b.root||!path.isAbsolute(String(b.root).trim())||!await exists(root))throw new Error('Ingresá una ruta absoluta a una carpeta accesible. Ejemplo: C:\\Users\\TuNombre\\Videos');
      const dataRel=path.relative(DATA,root);if(dataRel===''||(!dataRel.startsWith('..')&&!path.isAbsolute(dataRel)))throw new Error('La carpeta de datos de la aplicación no puede ser una fuente.');
      db.prepare('INSERT INTO sources(id,name,root,created) VALUES(?,?,?,?)').run(crypto.randomUUID(),String(b.name||path.basename(root)||root).slice(0,100),root,new Date().toISOString());return json(res,{ok:true});
    }
    if(req.method==='POST'&&p==='/api/relocate'){
      if(engine.active)throw new Error('Esperá a que termine el trabajo antes de cambiar la ubicación.');
      const b=await body(req),source=db.prepare('SELECT * FROM sources WHERE id=?').get(b.id);if(!source)throw new Error('Fuente inexistente.');
      if(!b.root||!path.isAbsolute(b.root)||!await exists(b.root))throw new Error('La carpeta de destino no está accesible.');
      const samples=db.prepare('SELECT * FROM videos WHERE source_id=? AND missing=0 ORDER BY name LIMIT 5').all(source.id);
      if(!samples.length)throw new Error('Primero inventariá esta fuente en su ubicación original.');
      for(const v of samples){const file=within(b.root,v.rel),stat=await fs.promises.stat(file);if(stat.size!==v.size)throw new Error('La nueva ubicación no coincide con el catálogo.');if(v.hash&&await fingerprint(file)!==v.hash)throw new Error('La verificación de contenido no coincide.');}
      // Conserva cada registro; las copias sin hash requieren nuevo inventario antes de analizar.
      db.prepare('UPDATE sources SET root=? WHERE id=?').run(path.resolve(b.root),source.id);return json(res,{ok:true,checked:samples.length});
    }
    if(req.method==='POST'&&p==='/api/jobs'){
      const b=await body(req),payload={sourceId:b.sourceId||undefined,model:String(b.model||'qwen3-vl:2b-instruct-q4_K_M'),limit:Math.min(100,Math.max(1,Number(b.limit)||50)),device:b.device==='cuda'?'cuda':'cpu'};
      if(b.type==='transcribe')payload.videoIds=b.videoIds;
      return json(res,{id:engine.start(b.type,payload)});
    }
    if(req.method==='POST'&&p==='/api/job-control'){const b=await body(req);if(b.action==='pause')engine.pause(b.id);else if(b.action==='resume')engine.resume(b.id);else throw new Error('Acción inválida.');return json(res,{ok:true});}
    if(req.method==='GET'&&p==='/api/events')return json(res,db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all());
    if(req.method==='POST'&&p==='/api/video'){
      const b=await body(req);if(!CATEGORIES.includes(b.category))throw new Error('Categoría inválida.');
      db.prepare('UPDATE videos SET category=?,tags=?,notes=? WHERE id=?').run(b.category,String(b.tags||'').slice(0,2000),String(b.notes||'').slice(0,10000),b.id);return json(res,{ok:true});
    }
    if(req.method==='GET'&&p==='/api/export'){
      const videos=db.prepare('SELECT v.*,s.root AS source_root,s.name AS source_name FROM videos v JOIN sources s ON v.source_id=s.id').all();
      const csv=url.searchParams.get('format')==='csv';
      res.setHeader('Content-Disposition',`attachment; filename="videoteca-${new Date().toISOString().slice(0,10)}.${csv?'csv':'json'}"`);
      if(!csv)return json(res,{version:1,exported:new Date().toISOString(),sources:db.prepare('SELECT * FROM sources').all(),videos});
      res.setHeader('Content-Type','text/csv; charset=utf-8');
      const columns=['id','source_name','source_root','rel','size','duration','width','height','hash','category','tags','notes','summary','ai_category','ai_model','transcript','transcript_model','missing'];
      const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
      return res.end('\uFEFF'+[columns.map(cell).join(';'),...videos.map(v=>columns.map(k=>cell(v[k])).join(';'))].join('\r\n'));
    }
    if(req.method==='GET'&&p.startsWith('/thumbnail/')){const id=p.split('/')[2];if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Identificador inválido.');return sendFile(req,res,path.join(DATA,'miniaturas',id+'.jpg'),'image/jpeg');}
    if(req.method==='GET'&&p.startsWith('/video/')){const v=db.prepare('SELECT * FROM videos WHERE id=?').get(p.split('/')[2]);if(!v)throw new Error('Video inexistente.');return sendFile(req,res,engine.videoPath(v),({'.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mkv':'video/x-matroska'})[v.extension]||'application/octet-stream');}
    if(req.method==='GET'&&p==='/config.js'){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');return res.end('window.APP_TOKEN='+JSON.stringify(token)+';');}
    const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
    if(req.method==='GET'&&assets[p]){const [file,type]=assets[p];return sendFile(req,res,path.join(__dirname,'public',file),type);}
    json(res,{error:'No encontrado.'},404);
  }catch(e){json(res,{error:e.code==='SQLITE_CONSTRAINT_UNIQUE'?'Esa carpeta ya está registrada.':e.message},400);}
});
server.listen(PORT,'127.0.0.1',()=>{
  console.log(`\nVideoteca Local · ${origin}\nDatos: ${DATA}\nConservá esta ventana abierta. Ctrl+C para detener.\n`);
  if(process.argv.includes('--open')){const child=spawn('powershell.exe',['-NoProfile','-Command',`Start-Process '${origin}'`],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${PORT} ya está ocupado. Si la aplicación está abierta, visitá ${origin}.`:e.message);process.exitCode=1;});
