'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {openDatabase,createEngine,within,fingerprint}=require('../lib');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(engine){const deadline=Date.now()+15000;while(engine.active){if(Date.now()>deadline)throw new Error('El trabajo no terminó.');await delay(10);}}

test('inventario, duplicados, cambios y desconexión conservan originales e identidad',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'videoteca-test-')),root=path.join(dir,'videos'),data=path.join(dir,'data');await fs.mkdir(root);await fs.mkdir(path.join(root,'sub'));
  const a=path.join(root,'familia á.mp4'),b=path.join(root,'sub','copia.mkv');await fs.writeFile(a,'contenido-video-1');await fs.copyFile(a,b);await fs.writeFile(path.join(root,'no-video.txt'),'ignorar');
  const initial=await fingerprint(a),db=openDatabase(data),engine=createEngine(db,data);db.prepare('INSERT INTO sources(id,name,root,created) VALUES(?,?,?,?)').run('s1','Prueba',root,new Date().toISOString());
  try{
    const paused=engine.start('scan',{sourceId:'s1'});engine.pause(paused);await wait(engine);assert.equal(db.prepare('SELECT status FROM jobs WHERE id=?').get(paused).status,'paused');engine.resume(paused);await wait(engine);assert.equal(db.prepare('SELECT status FROM jobs WHERE id=?').get(paused).status,'done');
    engine.start('scan',{sourceId:'s1'});await wait(engine);let videos=db.prepare('SELECT * FROM videos').all();assert.equal(videos.length,2);const id=videos.find(v=>v.name==='familia á.mp4').id;
    db.prepare("UPDATE videos SET category='Personal y viajes',notes='recuerdo',summary='viejo',width=1920,transcript='audio viejo' WHERE id=?").run(id);
    engine.start('duplicates');await wait(engine);videos=db.prepare('SELECT * FROM videos').all();assert.equal(videos[0].hash,videos[1].hash);assert.equal(videos[0].hash,initial);assert.equal(await fingerprint(a),initial);
    engine.start('scan',{sourceId:'s1'});await wait(engine);assert.equal(db.prepare('SELECT id FROM videos WHERE name=?').get('familia á.mp4').id,id);
    await fs.writeFile(a,'contenido nuevo mas largo');engine.start('scan',{sourceId:'s1'});await wait(engine);const changed=db.prepare('SELECT * FROM videos WHERE id=?').get(id);assert.equal(changed.hash,null);assert.equal(changed.summary,'');assert.equal(changed.width,null);assert.equal(changed.transcript,null);assert.equal(changed.notes,'recuerdo');assert.equal(changed.category,'Personal y viajes');
    await fs.rename(root,root+'-off');engine.start('scan',{sourceId:'s1'});await wait(engine);assert.equal(db.prepare('SELECT SUM(missing) n FROM videos').get().n,0);assert.equal(db.prepare('SELECT status FROM jobs ORDER BY created DESC LIMIT 1').get().status,'failed');await fs.rename(root+'-off',root);
    await fs.unlink(b);engine.start('scan',{sourceId:'s1'});await wait(engine);assert.equal(db.prepare('SELECT SUM(missing) n FROM videos').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM videos').get().n,2);
    assert.throws(()=>within(root,'../escape.mp4'));assert.throws(()=>within(root,path.parse(root).root));
    db.prepare("INSERT INTO jobs(id,type,status,payload,created,updated) VALUES('stale','scan','running','{}','x','x')").run();
  }finally{db.close();}
  const reopened=openDatabase(data);assert.equal(reopened.prepare("SELECT status FROM jobs WHERE id='stale'").get().status,'interrupted');reopened.close();await fs.rm(dir,{recursive:true,force:true});
});

test('servidor HTTP: protección de escrituras, búsqueda, edición, reproducción y exportación',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'videoteca-http-')),root=path.join(dir,'videos');await fs.mkdir(root);await fs.writeFile(path.join(root,'clip.mp4'),'0123456789');
  const port=46000+Math.floor(Math.random()*1500),base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,VIDEOTECA_DATA:path.join(dir,'data'),VIDEOTECA_PORT:String(port)},stdio:'pipe',windowsHide:true});let logs='';child.stderr.on('data',x=>logs+=x);child.stdout.on('data',x=>logs+=x);
  try{
    let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/state')).ok){ready=true;break;}}catch{}await delay(40);}assert.ok(ready,logs);
    const config=await(await fetch(base+'/config.js')).text(),token=JSON.parse(config.slice(config.indexOf('=')+1,-1));
    const post=(p,b,extra={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json','X-Videoteca-Token':token,...extra},body:JSON.stringify(b)});
    assert.equal((await fetch(base+'/api/sources',{method:'POST',body:'{}'})).status,403);
    assert.equal((await fetch(base+'/config.js',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
    assert.equal((await post('/api/sources',{}, {origin:'http://other.example'})).status,403);
    assert.equal((await post('/api/sources',{name:'Disco de prueba',root})).status,200);
    const source=(await(await fetch(base+'/api/state')).json()).sources[0];await post('/api/jobs',{type:'scan',sourceId:source.id});
    let state;for(let i=0;i<100;i++){state=await(await fetch(base+'/api/state')).json();if(state.jobs[0]?.status==='done')break;await delay(20);}assert.equal(state.stats.count,1);
    let videos=await(await fetch(base+'/api/videos')).json();const video=videos.rows[0];assert.equal((await post('/api/video',{id:video.id,category:'Clases y cursos',tags:'redes',notes:'=formula'})).status,200);
    videos=await(await fetch(base+'/api/videos?q=redes')).json();assert.equal(videos.total,1);assert.equal((await(await fetch(base+'/api/videos?q='+encodeURIComponent("' OR 1=1 --"))).json()).total,0);
    const range=await fetch(base+'/video/'+video.id,{headers:{range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'2345');
    assert.equal((await fetch(base+'/video/'+video.id,{headers:{range:'bytes=20-30'}})).status,416);
    const exported=await(await fetch(base+'/api/export')).json();assert.equal(exported.videos[0].tags,'redes');const csv=await(await fetch(base+'/api/export?format=csv')).text();assert.ok(csv.includes("'=formula"));
    assert.equal((await post('/api/transcript',{id:video.id,text:'[00:00:00] Texto corregido.'})).status,200);
    const corrected=(await(await fetch(base+'/api/videos')).json()).rows[0];assert.equal(corrected.transcript,'[00:00:00] Texto corregido.');assert.equal(corrected.transcript_model,'Corregida manualmente');assert.equal(corrected.minutes,null);
    assert.equal(await fs.readFile(path.join(root,'clip.mp4'),'utf8'),'0123456789');
  }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});await fs.rm(dir,{recursive:true,force:true});}
});
