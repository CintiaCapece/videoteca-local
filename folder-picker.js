'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
function parseSelection(text){
  const result=JSON.parse(text.replace(/^\uFEFF/,'').trim());
  if(result.root===null)return {root:null};
  if(typeof result.root!=='string'||!path.win32.isAbsolute(result.root))throw new Error('El selector no devolvió una carpeta válida.');
  return {root:result.root};
}
function chooseFolder(initial='',options={}){
  if((options.platform||process.platform)!=='win32')return Promise.reject(new Error('El selector está disponible en Windows. Podés escribir la ruta manualmente.'));
  return new Promise((resolve,reject)=>{
    const child=(options.spawn||spawn)('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'Elegir-carpeta.ps1')],{windowsHide:true,shell:false,env:{...process.env,VIDEOTECA_PICKER_INITIAL:String(initial).slice(0,32000)},stdio:['ignore','pipe','pipe']});
    let output='',error='',finished=false;
    const end=(err,value)=>{if(finished)return;finished=true;clearTimeout(timer);err?reject(err):resolve(value);};
    const timer=setTimeout(()=>{child.kill();end(new Error('Se cerró el selector por tiempo de espera. Volvé a intentarlo.'));},300000);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',x=>{output+=x;});child.stderr.on('data',x=>{error=(error+x).slice(-2000);});
    child.once('error',()=>end(new Error('No se pudo abrir el selector de carpetas de Windows.')));
    child.once('close',code=>{if(code!==0)return end(new Error('No se pudo elegir la carpeta. '+error));try{end(null,parseSelection(output));}catch(e){end(e);}});
  });
}
module.exports={chooseFolder,parseSelection};
