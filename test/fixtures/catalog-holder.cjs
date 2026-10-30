'use strict';
const {openDatabase}=require('../../catalog-storage');
let db,timer;
process.on('message',message=>{
  if(message==='open'){
    try{
      db=openDatabase(process.env.CATALOG_DIR);
      if(process.env.HOLD_TRANSACTION==='1'){
        db.prepare("UPDATE jobs SET status='running' WHERE id='job'").run();
        db.exec('BEGIN IMMEDIATE');db.prepare("UPDATE videos SET notes='sin confirmar' WHERE id='video'").run();
      }
      timer=setInterval(()=>{},1000);process.send({ready:true});
    }catch(error){process.send({error:error.message},()=>process.exit(2));}
  }else if(message==='close'){clearInterval(timer);db?.close();process.exit(0);}
});
