const {test}=require('node:test');const assert=require('node:assert/strict');const {describeFrame}=require('../vision-response');
const categories=['Pendiente','Otros'];
test('reintenta JSON truncado y devuelve únicamente campos validados',async()=>{
  const requests=[];let index=0;
  const answer=await describeFrame({url:'http://localhost',model:'local',image:'test',categories,fetchImpl:async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>index++?{response:'{"descripcion":"Una pantalla.","categoria":"Otros"}',done_reason:'stop'}:{response:'{"descripcion":"sin cerrar',done_reason:'length'}};}});
  assert.deepEqual(answer,{description:'Una pantalla.',category:'Otros'});assert.equal(requests.length,2);assert.equal(requests[0].format.type,'object');assert.ok(requests[1].options.num_predict>requests[0].options.num_predict);
});
test('dos respuestas inválidas dan error claro, sin guardar una descripción inventada',async()=>{
  let calls=0;await assert.rejects(describeFrame({url:'http://localhost',model:'local',image:'test',categories,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({response:'{"descripcion":"test","categoria":"inventada"}'})};}}),/dos intentos/);assert.equal(calls,2);
});
