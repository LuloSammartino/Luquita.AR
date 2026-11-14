import test from 'node:test';
import assert from 'node:assert/strict';
import {Sheets,summaryFormula,quoteSheet} from '../src/sheets.js';
import {categories} from '../src/parser.js';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('preserva valores y fórmulas anteriores sin acumular dos veces',()=>{
  assert.match(summaryFormula(80000,'Nafta','2026-11'),/^=\(80000\)\+SUMIFS/);
  assert.match(summaryFormula('=SUM(A1:A2)','Nafta','2026-11'),/^=\(SUM\(A1:A2\)\)/);
  const formula=summaryFormula(80000,'Nafta','2026-11');
  assert.equal(summaryFormula(formula,'Nafta','2026-11'),formula);
  assert.throws(()=>summaryFormula(formula,'Nafta','2027-11'));
  assert.throws(()=>summaryFormula('$80.000','Nafta','2026-11'));
  assert.equal(summaryFormula('  ','Nafta','2026-11'),summaryFormula(0,'Nafta','2026-11'));
  assert.equal(quoteSheet("Mi ' resumen"),"'Mi '' resumen'");
});
test('respuesta perdida tras append: el reintento no duplica el movimiento',async()=>{
  const sheets=new Sheets({sheetId:'test'});let ids=[],writes=0;
  sheets.values=async()=>ids;
  sheets.request=async(path,method,data)=>{writes++;assert.ok(path.includes('valueInputOption=RAW'));ids.push([data.values[0][0]]);throw new Error('Se perdió la respuesta');};
  const item={date:'2026-11-14',month:'2026-11',type:'Gasto',category:'Nafta',amount:100,currency:'ARS',description:'=HYPERLINK("x")'};
  await assert.rejects(sheets.append(123,item));
  await sheets.append(123,item);
  assert.equal(writes,1);
});
test('adapta y repara separadores regionales sin duplicar la base',()=>{
  const original=summaryFormula(1234.5,'Nafta','2026-11');
  const corrected=summaryFormula(original,'Nafta','2026-11',';');
  assert.equal(corrected,'=(1234,5)+SUMIFS(\'Movimientos\'!F:F;\'Movimientos\'!E:E;"Nafta";\'Movimientos\'!C:C;"2026-11")');
  assert.equal(summaryFormula(corrected,'Nafta','2026-11',';'),corrected);
  assert.equal(summaryFormula('=SUM(A1;A2)','Nafta','2026-11',';').startsWith('=(SUM(A1;A2))+'),true);
});
test('configura el resumen sin perder la base y no vuelve a envolver sus fórmulas',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'luquita-sheet-'));
  try{
    const rows=[['PRESUPUESTO 2026'],[],[],[],[],['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],['INGRESOS'],...categories.map(c=>[c,100])];
    const sheets=new Sheets({sheetId:'test',summary:'Resumen',year:2026,dataDir});
    let movements=false,header=[],batches=0;
    sheets.values=async range=>range.includes('A1:M100')?rows:header;
    sheets.request=async(path,method,data)=>{
      if(!method)return {sheets:[{properties:{title:'Resumen'}},...(movements?[{properties:{title:'Movimientos'}}]:[])]};
      if(path===':batchUpdate'){movements=true;return {};}
      if(method==='PUT'){header=data.values;return {};}
      if(path==='/values:batchUpdate'){
        batches++;
        for(const change of data.data){const match=/!([B-M])(\d+)$/.exec(change.range);rows[Number(match[2])-1][match[1].charCodeAt(0)-65]=change.values[0][0];}
      }
      return {};
    };
    await sheets.setup();
    assert.equal(batches,1);assert.ok(movements);assert.match(rows[7][1],/^=\(100\)/);
    assert.equal((await readdir(dataDir)).length,1);
    await sheets.setup();assert.equal(batches,1);
  }finally{await rm(dataDir,{recursive:true,force:true});}
});
