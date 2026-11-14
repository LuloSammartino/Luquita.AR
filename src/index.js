import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { config } from './config.js';
import { Store } from './store.js';
import { Sheets } from './sheets.js';
import { Telegram,telegramError } from './telegram.js';
import { transcribe } from './audio.js';
import { parseExpense,categories } from './parser.js';
import { DatabaseSync } from 'node:sqlite';

const help='Soy Luquita. Mandame un gasto o ingreso, por texto o audio.\nEjemplos:\n• 8500 supermercado\n• Gasté veinte mil pesos en nafta\n• 500000 sueldo\n• 3500 higiene 14/11/2026\n\nSiempre te pido confirmar antes de guardar. Para corregir, cancelá y mandá otro mensaje.\n/categorias — categorías disponibles\n/pendientes — registros en espera\n/ayuda — ver esta ayuda';
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n);
const c=config();
await mkdir(c.dataDir,{recursive:true});
// SQLite libera este bloqueo incluso si el proceso se cierra abruptamente.
const instanceLock=new DatabaseSync(join(c.dataDir,'instance.lock.sqlite'));
try{instanceLock.exec('BEGIN EXCLUSIVE');}
catch{instanceLock.close();throw new Error('Ya hay otra instancia usando este DATA_DIR. Cerrala antes de iniciar otra.');}
const store=new Store(join(c.dataDir,'luquita.sqlite'));
const telegram=new Telegram(c.token), sheets=new Sheets(c);
let running=true, sheetsReady=false;
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{running=false;console.log('Cerrando después de la operación actual…');});

async function poll(){
  while(running){
    try {
      const updates=await telegram.call('getUpdates',{offset:store.offset(),timeout:30,allowed_updates:['message','callback_query']});
      for(const update of updates){
        store.receive(update,c.userId);
        if(update.callback_query?.from?.id===c.userId) await telegram.call('answerCallbackQuery',{callback_query_id:update.callback_query.id,text:'Solicitud recibida.'}).catch(()=>{});
      }
    } catch(error){
      console.error(`No se pudo consultar Telegram: ${telegramError(error,c.token)}. Reintento en 5 segundos.`);
      if(error.code===409) console.error('Conflicto de recepción: verificá que no haya otra instancia del bot o un webhook activo.');
      if(error.code===401||error.code===404) console.error('Revisá TELEGRAM_BOT_TOKEN en las variables de entorno del servidor.');
      await sleep(5000);
    }
  }
}
async function processJob(job){
  const m=JSON.parse(job.payload);
  if(job.state==='pending'){
    if(m.text?.startsWith('/')){
      const command=m.text.split(/\s/)[0].split('@')[0];
      let answer=help;
      if(command==='/categorias') answer=categories.join('\n');
      if(command==='/pendientes'){
        const rows=store.db.prepare("SELECT id,state,result FROM jobs WHERE state NOT IN ('done') AND id<>? ORDER BY id LIMIT 30").all(job.id);
        answer=rows.length?rows.map(r=>`#${r.id}: ${r.state}${r.result?` · ${JSON.parse(r.result).category||''}`:''}`).join('\n'):'No hay movimientos pendientes.';
      }
      store.set(job.id,'invalid',{message:answer});return;
    }
    let text=m.text;
    if(!text&&(m.voice||m.audio)){
      const audio=m.voice||m.audio;
      if(!c.audio){store.set(job.id,'invalid',{message:'Los audios están desactivados. Mandame el gasto por texto.'});return;}
      if(audio.duration>180||audio.file_size>20*1024*1024){store.set(job.id,'invalid',{message:'Mandame un audio de hasta 3 minutos y 20 MB.'});return;}
      text=await transcribe(telegram,audio.file_id,c);
    }
    if(!text){store.set(job.id,'invalid',{message:'Mandame texto o una nota de voz.'});return;}
    try {store.set(job.id,'preview',parseExpense(text,{timestamp:m.date*1000,timeZone:c.timeZone,year:c.year}));}
    catch(error){store.set(job.id,'invalid',{message:error.message+'\nVolvé a enviarlo corregido.'});}
  } else if(job.state==='preview'){
    const item=JSON.parse(job.result);
    // Estado primero: un clic inmediato en el botón no debe perderse.
    store.set(job.id,'waiting');
    try {await telegram.send(job.chat,`¿Registro este movimiento?\n${item.type}: ${money(item.amount)}\n${item.category} · ${item.date}\n\n${item.description}`,{inline_keyboard:[[{text:'Confirmar',callback_data:`confirm:${job.id}`},{text:'Cancelar',callback_data:`cancel:${job.id}`}]]});}
    catch(error){store.db.prepare("UPDATE jobs SET state='preview' WHERE id=? AND state='waiting'").run(job.id);throw error;}
  } else if(job.state==='ready'){
    if(!sheetsReady){await sheets.setup();sheetsReady=true;}
    await sheets.append(job.id,JSON.parse(job.result));
    store.set(job.id,'saved');
  } else {
    const item=job.result?JSON.parse(job.result):{};
    const message=job.state==='saved'?`Guardado en Google Sheets ✅\n${money(item.amount)} · ${item.category} · ${item.date}`:job.state==='cancelled'?'Cancelado. Podés enviarlo nuevamente corregido.':item.message;
    await telegram.send(job.chat,message);
    store.set(job.id,'done');
  }
}
async function worker(){
  while(running){
    const job=store.next();
    if(!job){await sleep(500);continue;}
    try{await processJob(job);}
    catch(error){
      store.retry(job);
      console.error(`Operación #${job.id} pendiente (${job.state}). Reintento automático; revisá credenciales, conectividad o Python si persiste.`);
      console.error(String(error.response?.data?.error?.message||error.message||'Error desconocido').split(c.token).join('[TOKEN]').slice(0,1000));
      if(job.attempts===0) await telegram.send(job.chat,`La operación #${job.id} sigue pendiente por un problema al procesarla. La voy a reintentar automáticamente. Todavía no tengo confirmación de que se haya completado.`).catch(()=>{});
    }
  }
}
// Una confirmación cuyo envío fue interrumpido puede necesitar reenviarse.
// shortcut: confirmaciones Telegram pueden repetirse ante una caída; el gasto se deduplica por ID.
store.db.prepare("UPDATE jobs SET state='preview' WHERE state='waiting'").run();
console.log('Luquita iniciada. Cola local persistente; solo se acepta el usuario configurado.');
await Promise.all([poll(),worker()]);
store.db.close();
instanceLock.exec('ROLLBACK');
instanceLock.close();
