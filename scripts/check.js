import 'dotenv/config';
import { Telegram } from '../src/telegram.js';
import { Sheets } from '../src/sheets.js';
import { existsSync } from 'node:fs';
if(!process.env.TELEGRAM_BOT_TOKEN){console.log('Falta TELEGRAM_BOT_TOKEN en .env. Creá el bot en @BotFather y agregá el token.');process.exit(1);}
try {
  const telegram=new Telegram(process.env.TELEGRAM_BOT_TOKEN);
  const bot=await telegram.call('getMe');
  console.log(`Telegram conectado: @${bot.username}`);
  if(!process.env.TELEGRAM_USER_ID){
    console.log('Mandale /start a tu bot. Este comando no confirma ni consume las actualizaciones.');
    const updates=await telegram.call('getUpdates',{timeout:0,allowed_updates:['message','callback_query']});
    const users=new Map(updates.filter(u=>u.message?.chat?.type==='private').map(u=>[u.message.from.id,u.message.from.username||u.message.from.first_name]));
    for(const [id,name] of users) console.log(`Usuario: ${name}; TELEGRAM_USER_ID=${id}`);
    if(!users.size) console.log('Todavía no hay mensajes. Enviá /start y repetí npm run check.');
  }
  if(process.env.GOOGLE_APPLICATION_CREDENTIALS&&process.env.GOOGLE_SHEET_ID&&existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)){
    const sheets=new Sheets({credentials:process.env.GOOGLE_APPLICATION_CREDENTIALS,sheetId:process.env.GOOGLE_SHEET_ID});
    const meta=await sheets.request('?fields=sheets.properties.title');
    console.log('Google conectado. Pestañas disponibles:');
    for(const sheet of meta.sheets) console.log(`  ${sheet.properties.title}`);
    console.log('Copiá el nombre exacto del resumen en SUMMARY_SHEET. No se modificó la planilla.');
  } else console.log('Google pendiente: falta el archivo de credenciales de la cuenta de servicio o GOOGLE_SHEET_ID.');
} catch {console.error('No se pudo conectar. Revisá el token, el archivo de credenciales y el acceso de la cuenta de servicio a la planilla.');process.exitCode=1;}
