'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');const {PassThrough}=require('node:stream');
const {chooseFolder,parseSelection}=require('../folder-picker');
test('selector conserva rutas con espacios, Unicode y red; cancelar no elige nada',()=>{
  for(const root of ['C:\\Videos familiares\\Música','\\\\NAS\\Videos\\2026'])assert.equal(parseSelection('\uFEFF'+JSON.stringify({root})).root,root);
  assert.deepEqual(parseSelection('{"root":null}'),{root:null});assert.throws(()=>parseSelection('{"root":"relativa"}'));
});
test('la ruta inicial se pasa como dato y se usa STA sin intérprete de comandos',async()=>{
  const initial='C:\\Videos con espacios\\$(test)';
  const result=await chooseFolder(initial,{platform:'win32',spawn:(exe,args,opts)=>{
    assert.equal(exe,'powershell.exe');assert.ok(args.includes('-STA'));assert.equal(opts.shell,false);assert.equal(opts.env.VIDEOTECA_PICKER_INITIAL,initial);assert.ok(!args.some(a=>a.includes(initial)));
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
    process.nextTick(()=>{child.stdout.write(JSON.stringify({root:initial}));child.emit('close',0);});return child;
  }});assert.equal(result.root,initial);
});
