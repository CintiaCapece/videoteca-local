'use strict';
const {spawn}=require('node:child_process');
const {progressReader}=require('./stream-progress');
function paused(){return new Error('PAUSED');}
// Settle only after close: the caller must not release job ownership while its child runs.
function run(command,args,timeout=120000,onProgress=null,signal=null){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(paused());return;}
    let child;
    try{child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});}catch(error){reject(error);return;}
    let out='',err='',failure=null,killer=null;
    const stop=error=>{
      if(failure)return;failure=error;
      if(process.platform==='win32'&&child.pid){
        const kill=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',shell:false});
        killer=new Promise(done=>{kill.once('error',()=>{child.kill();done();});kill.once('close',code=>{if(code!==0)child.kill();done();});});
      }else child.kill('SIGKILL');
    };
    const abort=()=>stop(paused());
    const timer=setTimeout(()=>stop(new Error('Tiempo de espera agotado.')),timeout);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    const read=onProgress?progressReader(onProgress):null;
    child.stdout.on('data',chunk=>{if(failure)return;out+=chunk;if(out.length>8*1024*1024)stop(new Error('Salida demasiado grande.'));});
    child.stderr.on('data',chunk=>{if(failure)return;err=(err+chunk).slice(-8000);try{read?.(chunk);}catch(error){stop(error);}});
    child.once('error',error=>{failure=failure||error;});
    child.once('close',async code=>{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);await killer;
      if(signal?.aborted)reject(paused());else if(failure)reject(failure);else if(code!==0)reject(new Error(err||command+': código '+code));else resolve(out);
    });
  });
}
module.exports={run};
