import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExpense,localDate} from '../src/parser.js';
const options={timestamp:Date.parse('2026-11-14T15:00:00Z')};
for(const [text,amount,category] of [
  ['8500 supermercado',8500,'Alimentación'],['Gasté ocho mil quinientos en supermercado',8500,'Alimentación'],
  ['cargué veinte mil pesos de nafta',20000,'Nafta'],['Gasté $8.500,50 en higiene',8500.5,'Higiene'],
  ['Gasté 8.500 en nafta',8500,'Nafta'],['2,5 mil ropa',2500,'Ropa'],['500000 sueldo',500000,'Ingreso Fijo'],
  ['un millon doscientos mil ingreso extra',1200000,'Ingreso Extra'],['3500 otros egresos',3500,'Otros Egresos'],
  ['treinta y cinco mil en un supermercado',35000,'Alimentación'],['9000 Meli+  y  Diney+',9000,'Meli+  y  Diney+'],
]) test(text,()=>{const item=parseExpense(text,options);assert.equal(item.amount,amount);assert.equal(item.category,category);assert.equal(item.month,'2026-11');});
test('fechas locales y ayer',()=>{
  assert.equal(localDate(Date.parse('2026-11-14T01:00:00Z'),'America/Argentina/Buenos_Aires'),'2026-11-13');
  assert.equal(parseExpense('ayer 100 nafta',options).date,'2026-11-13');
  assert.equal(parseExpense('100 nafta 02/05/2026',options).date,'2026-05-02');
});
for(const text of ['-100 nafta','0 nafta','100 usd nafta','100 nafta 200 ropa','100 nafta y ropa','nafta','100 algo','100 nafta 31/02/2026','100 nafta 01/01/2027','100 nafta en octubre','100.1234 nafta','cobré 100 supermercado']) test(`rechaza ${text}`,()=>assert.throws(()=>parseExpense(text,options)));
