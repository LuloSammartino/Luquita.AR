import 'dotenv/config';
import { resolve } from 'node:path';
export function config(){
  const required=['TELEGRAM_BOT_TOKEN','TELEGRAM_USER_ID','GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_SHEET_ID','SUMMARY_SHEET'];
  for(const name of required) if(!process.env[name]?.trim()) throw new Error(`Falta ${name}. Copiá .env.example a .env y completalo.`);
  const userId=Number(process.env.TELEGRAM_USER_ID), year=Number(process.env.SUMMARY_YEAR||2026);
  if(!Number.isSafeInteger(userId)||userId<=0) throw new Error('TELEGRAM_USER_ID debe ser un identificador numérico positivo.');
  if(!Number.isInteger(year)||year<2000||year>2100) throw new Error('SUMMARY_YEAR inválido.');
  return {token:process.env.TELEGRAM_BOT_TOKEN,userId,year,credentials:process.env.GOOGLE_APPLICATION_CREDENTIALS,
    sheetId:process.env.GOOGLE_SHEET_ID,summary:process.env.SUMMARY_SHEET,
    dataDir:resolve(process.env.DATA_DIR||'data'),timeZone:process.env.TIME_ZONE||'America/Argentina/Buenos_Aires',
    python:process.env.PYTHON_BIN||'python',model:process.env.WHISPER_MODEL||'base',audio:process.env.ENABLE_AUDIO!=='false'};
}
