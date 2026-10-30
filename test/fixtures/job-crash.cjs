const path=require('node:path');
const {openDatabase,createEngine}=require('../../lib');
const dir=process.argv[2],db=openDatabase(dir);
let engine;engine=createEngine(db,dir,{toolsStatus:async()=>({whisper:true}),run:async(cmd,args)=>{const id=path.basename(args[2],'.mp4');if(id==='b'){process.send({id:engine.active.id});await new Promise(()=>{});}return JSON.stringify({text:'nuevo '+id,model:'test',segments:[]});}});
engine.start('transcribe',{videoIds:['a','b','c'],overwrite:true});
setInterval(()=>{},1000);
