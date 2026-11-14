import { GoogleAuth } from 'google-auth-library';
import { categories, normalize } from './parser.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export const quoteSheet = title => `'${title.replace(/'/g,"''")}'`;
export const headers=['ID','Fecha','Mes','Tipo','Categoría','Monto','Moneda','Descripción'];
export function summaryFormula(base,category,month,separator=',') {
  if(typeof base==='string'&&base.trim()==='') base='';
  if(typeof base==='string'&&base.includes("'Movimientos'!")) {
    if(!base.includes(`"${month}"`)||!base.includes(`"${category}"`)) throw new Error('La fórmula vinculada pertenece a otro año o categoría. Revisá el resumen antes de continuar.');
    const original=/^=\(([\s\S]*)\)\+SUMIFS\(/.exec(base);
    if(!original) throw new Error('La fórmula vinculada tiene una estructura desconocida.');
    base=`=${original[1]}`;
  }
  if(base!=null&&base!==''&&typeof base!=='number'&&!(typeof base==='string'&&base.startsWith('='))) throw new Error('Hay un importe guardado como texto en el resumen. Convertí esa celda a número antes de conectar.');
  let initial=String(typeof base==='string'&&base.startsWith('=')?base.slice(1):Number(base||0));
  if(separator===';'&&/^-?\d+\.\d+$/.test(initial)) initial=initial.replace('.',',');
  return `=(${initial})+SUMIFS(${["'Movimientos'!F:F","'Movimientos'!E:E",`"${category}"`,"'Movimientos'!C:C",`"${month}"`].join(separator)})`;
}
export class Sheets {
  constructor(config){
    this.config=config;
    this.auth=new GoogleAuth({keyFile:config.credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']});
    this.base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}`;
  }
  async request(path='',method='GET',data){
    const client=await this.auth.getClient();
    const result=await client.request({url:this.base+path,method,data,timeout:60000,retry:false});
    return result.data;
  }
  async values(range,render='FORMULA') {
    return (await this.request(`/values/${encodeURIComponent(range)}?valueRenderOption=${render}`)).values||[];
  }
  async setup(){
    const meta=await this.request('?fields=properties.locale,sheets.properties');
    const locale=(meta.properties?.locale||'en_US').replace('_','-');
    const decimal=new Intl.NumberFormat(locale).formatToParts(1.5).find(p=>p.type==='decimal')?.value;
    const separator=decimal===','?';':',';
    const summary=meta.sheets.find(s=>s.properties.title===this.config.summary);
    if(!summary) throw new Error('No existe SUMMARY_SHEET. Revisá el nombre exacto de la pestaña.');
    const rows=await this.values(`${quoteSheet(this.config.summary)}!A1:M100`);
    if(!rows.slice(0,10).some(row=>String(row[0]||'').includes(String(this.config.year)))) throw new Error('El año del resumen no coincide con SUMMARY_YEAR.');
    const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    if(!rows.some(row=>months.every((m,i)=>normalize(String(row[i+1]||''))===m))) throw new Error('Se esperaban los meses de enero a diciembre en las columnas B:M.');
    const changes=[];
    for(const category of categories){
      const matches=rows.map((r,i)=>normalize(String(r[0]||''))===normalize(category)?i:-1).filter(i=>i>=0);
      if(matches.length!==1) throw new Error(`No se encontró una única fila para ${category}.`);
      const index=matches[0];
      for(let m=1;m<=12;m++){
        const current=rows[index][m];
        let formula;
        try{formula=summaryFormula(current,category,`${this.config.year}-${String(m).padStart(2,'0')}`,separator);}
        catch(error){throw new Error(`${quoteSheet(this.config.summary)}!${String.fromCharCode(65+m)}${index+1}: ${error.message}`);}
        if(current!==formula) changes.push({range:`${quoteSheet(this.config.summary)}!${String.fromCharCode(65+m)}${index+1}`,values:[[formula]]});
      }
    }
    // Respaldo anterior a la primera modificación; también preserva las fórmulas originales.
    if(changes.length) await writeFile(join(this.config.dataDir,`resumen-backup-${Date.now()}.json`),JSON.stringify({sheet:this.config.summary,rows},null,2),{mode:0o600});
    if(!meta.sheets.some(s=>s.properties.title==='Movimientos')) await this.request(':batchUpdate','POST',{requests:[{addSheet:{properties:{title:'Movimientos'}}}]});
    const existing=await this.values("'Movimientos'!A1:H1");
    if(existing.length&&JSON.stringify(existing[0])!==JSON.stringify(headers)) throw new Error('La pestaña Movimientos ya existe con columnas distintas. Renombrala antes de iniciar.');
    if(!existing.length) await this.request(`/values/${encodeURIComponent("'Movimientos'!A1:H1")}?valueInputOption=RAW`,'PUT',{values:[headers]});
    if(changes.length) await this.request('/values:batchUpdate','POST',{valueInputOption:'USER_ENTERED',data:changes});
  }
  async append(id,item){
    const ids=await this.values("'Movimientos'!A:A",'UNFORMATTED_VALUE');
    if(ids.some(row=>String(row[0])===String(id))) return;
    // RAW evita que un texto dictado o escrito sea ejecutado como fórmula.
    await this.request(`/values/${encodeURIComponent("'Movimientos'!A:H")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,'POST',{
      values:[[String(id),item.date,item.month,item.type,item.category,item.amount,item.currency,item.description]],
    });
  }
}
