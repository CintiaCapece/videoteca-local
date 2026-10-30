'use strict';
const {verifyBackup,restoreCatalog}=require('./catalog-storage');
const [backup,destination,...extra]=process.argv.slice(2);
if(!backup||extra.length){console.error('Uso: node recuperar-catalogo.js "respaldo.sqlite" ["carpeta-nueva-o-vacia"]\nSin destino: sólo verifica. Con destino: restaura allí, sin reemplazar el catálogo actual.');process.exitCode=1;}
else try{console.log(JSON.stringify(destination?restoreCatalog(backup,destination):verifyBackup(backup),null,2));}catch(error){console.error('No se pudo recuperar el catálogo: '+error.message);process.exitCode=1;}
