'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {openDatabase}=require('../catalog-storage');

test('puerto ocupado rechaza el inicio antes de abrir o migrar datos',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'videoteca-startup-')),data=path.join(root,'datos-no-creados');
  const occupied=net.createServer(socket=>socket.end());await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
  const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,VIDEOTECA_PORT:String(occupied.address().port),VIDEOTECA_DATA:data},stdio:'pipe',windowsHide:true});let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
  const watchdog=setTimeout(()=>child.kill('SIGKILL'),10000);
  try{const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,1,logs);assert.match(logs,/ya está ocupado/);assert.equal(fs.existsSync(data),false);}finally{clearTimeout(watchdog);await new Promise(resolve=>occupied.close(resolve));const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('videoteca-startup-'));fs.rmSync(resolved,{recursive:true,force:true});}
});

test('un archivo corrupto o una restauración incompleta no se abren ni se reemplazan',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'videoteca-startup-'));
  try{const file=path.join(root,'catalogo.sqlite'),content=Buffer.from('catalogo inválido, conservar');fs.writeFileSync(file,content);assert.throws(()=>openDatabase(root));assert.deepEqual(fs.readFileSync(file),content);fs.writeFileSync(path.join(root,'.restauracion-en-curso'),'incompleto');assert.throws(()=>openDatabase(root),/restauración incompleta/);assert.deepEqual(fs.readFileSync(file),content);}finally{const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('videoteca-startup-'));fs.rmSync(resolved,{recursive:true,force:true});}
});
