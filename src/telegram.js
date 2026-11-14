export function telegramError(error,token=''){
  const detail=[error.message,error.cause?.code,error.cause?.message].filter(Boolean).join(' · ');
  return (token?detail.split(token).join('[TOKEN]'):detail).slice(0,1200);
}
export class Telegram {
  constructor(token){this.token=token.trim();}
  async call(method,data={}){
    const response=await fetch(`https://api.telegram.org/bot${this.token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(65000)});
    const result=await response.json();
    if(!result.ok){
      const error=new Error(`Telegram ${method}: ${result.error_code||response.status} — ${result.description||'Sin descripción'}`);
      error.code=result.error_code||response.status;
      throw error;
    }
    return result.result;
  }
  send(chat,text,reply_markup){return this.call('sendMessage',{chat_id:chat,text,reply_markup});}
  async download(fileId){
    const file=await this.call('getFile',{file_id:fileId});
    if(file.file_size>20*1024*1024) throw new Error('El audio supera 20 MB.');
    const response=await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`,{signal:AbortSignal.timeout(120000)});
    if(!response.ok) throw new Error('No se pudo descargar el audio.');
    const data=Buffer.from(await response.arrayBuffer());
    if(data.length>20*1024*1024) throw new Error('El audio supera 20 MB.');
    return data;
  }
}
