const {test}=require('node:test');const assert=require('node:assert/strict');const {progressReader}=require('../stream-progress');
test('progreso funciona entre fragmentos y descarta logs y porcentajes inválidos',()=>{
  const values=[];const read=progressReader(v=>values.push(v));
  const line='VIDEOTECA_PROGRESS '+JSON.stringify({phase:'transcribing',percent:42.5,eta:20})+'\n';
  read(Buffer.from('aviso\n'+line.slice(0,12)));read(Buffer.from(line.slice(12)));
  read(Buffer.from('VIDEOTECA_PROGRESS {"phase":"transcribing","percent":999}\nVIDEOTECA_PROGRESS error\n'));
  assert.equal(values.length,1);assert.equal(values[0].percent,42.5);assert.equal(values[0].eta,20);
});
