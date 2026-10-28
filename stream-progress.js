'use strict';
const {StringDecoder}=require('node:string_decoder');
function progressReader(callback){
  const decoder=new StringDecoder('utf8');let pending='';
  return chunk=>{
    pending+=decoder.write(chunk);const lines=pending.split('\n');pending=lines.pop().slice(-65536);
    for(const line of lines){if(!line.startsWith('VIDEOTECA_PROGRESS '))continue;try{
      const value=JSON.parse(line.slice(19));
      if(!['loading','preparing','transcribing','complete'].includes(value.phase))continue;
      if(value.percent!==null&&(!Number.isFinite(value.percent)||value.percent<0||value.percent>100))continue;
      callback(value);
    }catch{}}
  };
}
module.exports={progressReader};
