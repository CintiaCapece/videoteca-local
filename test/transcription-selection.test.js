const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {openDatabase,selectedTranscriptionVideos,createEngine}=require('../lib');
test('transcripción exige IDs explícitos, conserva selección entre fuentes y al reanudar omite completados',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'video-select-'));const db=openDatabase(dir);
  try{
    for(const id of ['a','b'])db.prepare('INSERT INTO sources(id,name,root,created) VALUES(?,?,?,?)').run(id,id,dir+id,'now');
    const add=(id,source,transcript=null,audio=1,missing=0)=>db.prepare('INSERT INTO videos(id,source_id,rel,name,size,mtime,extension,transcript,has_audio,missing) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,source,id+'.mp4',id,1,1,'.mp4',transcript,audio,missing);
    add('one','a');add('two','b');add('unselected','a');add('done','a','hecho');add('silent','a',null,0);add('missing','a',null,1,1);
    assert.deepEqual(selectedTranscriptionVideos(db,['one','two','one']).map(v=>v.id),['one','two']);
    assert.deepEqual(selectedTranscriptionVideos(db,['one','done']).map(v=>v.id),['one']);
    db.prepare('UPDATE videos SET transcript=? WHERE id=?').run('terminado','one');
    assert.deepEqual(selectedTranscriptionVideos(db,['one','two']).map(v=>v.id),['two']);
    for(const ids of [undefined,[],['no-existe'],['silent'],['missing'],Array(101).fill('two'),['two',null]])assert.throws(()=>selectedTranscriptionVideos(db,ids));
    const engine=createEngine(db,dir);assert.throws(()=>engine.start('transcribe',{}));assert.throws(()=>engine.start('transcribe',{videoIds:['done']}));assert.equal(db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
