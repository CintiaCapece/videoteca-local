'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const SCHEMA_VERSION=1;

function processExists(pid){
  if(!Number.isInteger(pid)||pid<=0)return true;
  try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}
}

function acquireInstance(dir){
  const lease=new DatabaseSync(path.join(dir,'instancia.sqlite'));
  const token=crypto.randomUUID();let owned=false;
  try{
    lease.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS instance(id INTEGER PRIMARY KEY CHECK(id=1),pid INTEGER NOT NULL,token TEXT NOT NULL);');
    const previous=lease.prepare('SELECT pid FROM instance WHERE id=1').get();
    if(previous&&processExists(previous.pid))throw new Error('Este catálogo ya está abierto en otro proceso (PID '+previous.pid+'). Cerrá esa instancia antes de iniciar otra.');
    lease.prepare('INSERT INTO instance(id,pid,token) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET pid=excluded.pid,token=excluded.token').run(process.pid,token);
    lease.exec('COMMIT');owned=true;
  }catch(error){try{lease.exec('ROLLBACK');}catch{}lease.close();throw error;}
  return {release(){if(!owned)return;owned=false;try{lease.prepare('DELETE FROM instance WHERE id=1 AND token=?').run(token);}finally{lease.close();}}};
}

function sha256(file){
  const hash=crypto.createHash('sha256'),buffer=Buffer.alloc(1024*1024),fd=fs.openSync(file,'r');
  try{let length;while((length=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,length));}finally{fs.closeSync(fd);}
  return hash.digest('hex');
}

function inspectSnapshot(file){
  let db;
  try{
    db=new DatabaseSync(file,{readOnly:true});
    if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok'))throw new Error('El respaldo no pasó la comprobación de integridad.');
    const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    const counts={};for(const table of ['sources','videos','jobs'])counts[table]=tables.has(table)?db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n:null;
    return {schemaVersion:db.prepare('PRAGMA user_version').get().user_version,counts};
  }finally{db?.close();}
}

function backupCatalog(db,dir,reason='manual'){
  if(!['manual','antes-migracion'].includes(reason))throw new Error('Motivo de respaldo inválido.');
  const folder=path.join(dir,'respaldos');fs.mkdirSync(folder,{recursive:true});
  const created=new Date().toISOString(),name='catalogo-'+created.replace(/[:.]/g,'-')+'-'+reason+'-'+crypto.randomUUID().slice(0,8)+'.sqlite';
  const target=path.join(folder,name);
  try{db.prepare('VACUUM INTO ?').run(target);}catch(error){try{fs.unlinkSync(target);}catch{}throw new Error('No se pudo crear el respaldo del catálogo: '+error.message);}
  const metadata={format:1,created,reason,file:name,bytes:fs.statSync(target).size,sha256:sha256(target),...inspectSnapshot(target)};
  fs.writeFileSync(target+'.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
  return {...metadata,relative:path.join('respaldos',name),manifest:path.join('respaldos',name+'.json')};
}

function verifyBackup(file){
  const target=path.resolve(file),manifest=JSON.parse(fs.readFileSync(target+'.json','utf8'));
  if(manifest.format!==1||manifest.file!==path.basename(target)||typeof manifest.sha256!=='string'||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('El manifiesto del respaldo no es válido.');
  if(fs.statSync(target).size!==manifest.bytes||sha256(target)!==manifest.sha256)throw new Error('El respaldo cambió o está incompleto: no coincide su SHA-256.');
  const inspected=inspectSnapshot(target);
  if(inspected.schemaVersion>SCHEMA_VERSION)throw new Error('El respaldo pertenece a una versión más nueva. Actualizá la aplicación.');
  if(inspected.schemaVersion!==manifest.schemaVersion||['sources','videos','jobs'].some(table=>inspected.counts[table]!==manifest.counts?.[table]))throw new Error('El manifiesto no coincide con el contenido del respaldo.');
  return {...manifest,verified:true};
}

function restoreCatalog(file,destination){
  const checked=verifyBackup(file),targetDir=path.resolve(destination);
  if(fs.existsSync(targetDir)&&fs.readdirSync(targetDir).length)throw new Error('El destino debe ser una carpeta nueva o vacía. No se sobrescribe ningún catálogo.');
  fs.mkdirSync(targetDir,{recursive:true});
  const marker=path.join(targetDir,'.restauracion-en-curso');fs.writeFileSync(marker,'Restauración aún no confirmada.\n',{flag:'wx'});
  const target=path.join(targetDir,'catalogo.sqlite');
  fs.copyFileSync(path.resolve(file),target,fs.constants.COPYFILE_EXCL);
  if(sha256(target)!==checked.sha256)throw new Error('La copia no coincide con el respaldo verificado. Conservá el original y usá otra carpeta vacía.');
  const inspected=inspectSnapshot(target);
  if(inspected.schemaVersion!==checked.schemaVersion||['sources','videos','jobs'].some(table=>inspected.counts[table]!==checked.counts[table]))throw new Error('No se pudo confirmar la copia restaurada.');
  fs.unlinkSync(marker);
  return {restored:true,directory:targetDir,...inspected};
}

function openDatabase(dir){
  fs.mkdirSync(dir,{recursive:true});
  if(fs.existsSync(path.join(dir,'.restauracion-en-curso')))throw new Error('Esta carpeta contiene una restauración incompleta. Usá otra carpeta vacía y verificá el respaldo.');
  const lease=acquireInstance(dir);let db;
  try{
    db=new DatabaseSync(path.join(dir,'catalogo.sqlite'));
    db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version>SCHEMA_VERSION)throw new Error('El catálogo pertenece a una versión más nueva. Actualizá la aplicación antes de abrirlo.');
    if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok'))throw new Error('El catálogo no pasó la comprobación de integridad. Conservá la carpeta datos y recuperá un respaldo antes de continuar.');
    const hasCatalog=Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='videos'").get());
    if(version<SCHEMA_VERSION&&hasCatalog)backupCatalog(db,dir,'antes-migracion');
    db.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');
    try{
      if(version<SCHEMA_VERSION){
      db.exec(`CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,root TEXT NOT NULL UNIQUE,created TEXT NOT NULL,last_scan TEXT);
        CREATE TABLE IF NOT EXISTS videos(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(id),rel TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,mtime REAL NOT NULL,extension TEXT NOT NULL,duration REAL,width INTEGER,height INTEGER,has_audio INTEGER,hash TEXT,thumbnail TEXT,category TEXT NOT NULL DEFAULT 'Pendiente',tags TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',summary TEXT NOT NULL DEFAULT '',ai_category TEXT,ai_evidence TEXT,ai_model TEXT,ai_date TEXT,probe_error TEXT,transcript TEXT,transcript_model TEXT,missing INTEGER NOT NULL DEFAULT 0,UNIQUE(source_id,rel));
        CREATE INDEX IF NOT EXISTS videos_size ON videos(size); CREATE INDEX IF NOT EXISTS videos_hash ON videos(hash);
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,type TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,message TEXT NOT NULL DEFAULT '',errors INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,job_id TEXT,created TEXT NOT NULL,message TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS job_progress(job_id TEXT PRIMARY KEY,info TEXT NOT NULL);`);
      const columns=new Set(db.prepare('PRAGMA table_info(videos)').all().map(c=>c.name));
      for(const name of ['transcript_segments','minutes','minutes_model'])if(!columns.has(name))db.exec('ALTER TABLE videos ADD COLUMN '+name+' TEXT');
      }
      db.exec(`UPDATE jobs SET status='interrupted',message='Interrumpido al cerrar. Podés reanudarlo.' WHERE status IN ('running','queued','pausing'); PRAGMA user_version=${SCHEMA_VERSION}; COMMIT;`);
    }catch(error){db.exec('ROLLBACK');throw error;}
    const close=db.close.bind(db);let closed=false;
    db.close=()=>{if(closed)return;closed=true;try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{try{close();}finally{lease.release();}}};
    return db;
  }catch(error){try{db?.close();}finally{lease.release();}throw error;}
}
module.exports={openDatabase,backupCatalog,verifyBackup,restoreCatalog,SCHEMA_VERSION};
