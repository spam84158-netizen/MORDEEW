const major=Number(process.versions.node.split('.')[0]);
if(major>=23){
 console.error('\n[VØRAXIS MD] Node.js '+process.versions.node+' n’est pas compatible avec le cœur obfusqué de cette version.');
 console.error('[VØRAXIS MD] Utilise Node.js 20 ou 22 (nodejs-lts dans Termux).\n');
 process.exit(78);
}
require('./index.js');
