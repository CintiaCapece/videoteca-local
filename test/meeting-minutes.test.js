const {test}=require('node:test');const assert=require('node:assert/strict');
const {transcriptRecords,chunks,validateExtraction,buildMinutes}=require('../meeting-minutes');
test('minuta conserva tiempos y descarta citas inventadas y nombres sin evidencia literal',()=>{
  const records=transcriptRecords('[00:01:20] María propone revisar la configuración.\n[00:02:00] Acordamos probar el viernes.');
  assert.equal(records[0].second,80);assert.equal(records[1].second,120);assert.equal(chunks(records,30).length,2);
  const checked=validateExtraction({temas:[{texto:'Revisión de configuración',evidencias:[{id:'t0',cita:'revisar la configuración'}]},{texto:'Tema inventado',evidencias:[{id:'t0',cita:'Comprar servidores'}]}],decisiones:[],acciones:[],pendientes:[],nombres:[{nombre:'María',evidencias:[{id:'t0',cita:'María propone'}]},{nombre:'Pedro',evidencias:[{id:'t0',cita:'María propone'}]}]},records);
  assert.equal(checked.result.temas.length,1);assert.equal(checked.result.nombres.length,1);assert.equal(checked.result.nombres[0].kind,'mencionado');assert.equal(checked.rejected,2);
});
test('resumen procesa todo el texto por fragmentos y no acepta una minuta sin transcripción',async()=>{
  const records=transcriptRecords('[00:00:00] Hablamos de redes.\n[00:03:00] La prueba queda pendiente.');let calls=0;
  const report=await buildMinutes({records,model:'test',request:async()=>{calls++;return {temas:[{texto:'Redes',evidencias:[{id:'t0',cita:'Hablamos de redes.'}]}],decisiones:[],acciones:[],pendientes:[],nombres:[]};}});
  assert.equal(calls,1);assert.equal(report.temas[0].evidence[0].second,0);assert.equal(report.decisiones.length,0);
  await assert.rejects(buildMinutes({records:[],model:'test'}),/Primero transcribí/);
});
