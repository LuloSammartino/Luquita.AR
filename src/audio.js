import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
export async function transcribe(telegram,fileId,config){
  const dir=await mkdtemp(join(tmpdir(),'luquita-'));
  try {
    const file=join(dir,'audio.ogg');
    await writeFile(file,await telegram.download(fileId),{mode:0o600});
    const {stdout}=await run(config.python,['scripts/transcribe.py',file],{
      windowsHide:true,timeout:20*60*1000,maxBuffer:1024*1024,
      env:{...process.env,WHISPER_MODEL:config.model,PYTHONIOENCODING:'utf-8'},
    });
    const {text}=JSON.parse(stdout);
    if(!text?.trim()) throw new Error('No se detectó voz en el audio.');
    return text;
  } finally {await rm(dir,{recursive:true,force:true});}
}
