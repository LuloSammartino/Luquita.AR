export const categories = ['Ingreso Fijo','Ingreso Extra','Alquiler','Expensas','Gas','Luz','Cable e internet','Celular','Suscripciones mensuales','Meli+  y  Diney+','Impuestos','Obra Social/ Prepaga','Seguro','Nafta','Peaje','Educación','Otros Egresos','Alimentación','Deporte','Clases ocio/salud','Salida entretenimiento','Higiene','Ropa','Belleza','Reparaciones hogar','Vicios','Regalos','Vacaciones','Pokemon','Ahorro','Invertir','Otros'];
export const normalize = s => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const aliases = {
  'Ingreso Fijo':['sueldo','salario'], 'Ingreso Extra':['ingreso extra'],
  'Alimentación':['supermercado','super','comida','verduleria','carniceria','almacen'],
  'Nafta':['combustible'], 'Deporte':['gimnasio','gym'],
  'Salida entretenimiento':['salida','cine','restaurante','bar','cena'],
  'Celular':['telefono'], 'Cable e internet':['internet','wifi','cable'],
  'Obra Social/ Prepaga':['prepaga','obra social'], 'Educación':['facultad','universidad'],
};
const words = Object.fromEntries('cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve'.split(' ').map((w,i)=>[w,i]));
Object.assign(words,{un:1,una:1,veintiun:21,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100,doscientos:200,trescientos:300,cuatrocientos:400,quinientos:500,seiscientos:600,setecientos:700,ochocientos:800,novecientos:900});
function wordAmount(tokens) {
  let total=0, group=0;
  for (const token of tokens) {
    if (token==='y') continue;
    if (token==='mil') { total+=(group||1)*1000; group=0; }
    else if (['millon','millones'].includes(token)) { total=(total+group||1)*1e6; group=0; }
    else group+=words[token];
  }
  return total+group;
}
export function localDate(timestamp,timeZone) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function parseExpense(text,{timestamp=Date.now(),timeZone='America/Argentina/Buenos_Aires',year=2026}={}) {
  let normalized=normalize(text);
  if (/\b(dolar|dolares|usd|eur|euros)\b/.test(normalized)) throw new Error('Por ahora registro únicamente pesos argentinos (ARS).');
  let date=localDate(timestamp,timeZone);
  const explicit=normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (explicit) {
    const [,d,m,y]=explicit;
    date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const check=new Date(date+'T12:00:00Z');
    if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0,10)!==date) throw new Error('Fecha inválida. Usá DD/MM/AAAA.');
    normalized=normalized.replace(explicit[0],'');
  } else if (/\bayer\b/.test(normalized)) date=new Date(new Date(date+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10);
  else if (/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|anteayer|semana pasada|mes pasado)\b/.test(normalized)) throw new Error('Para otra fecha indicá DD/MM/AAAA, o usá “ayer”.');
  if (Number(date.slice(0,4))!==Number(year)) throw new Error(`El resumen está configurado para ${year}. Indicá una fecha de ese año.`);
  const matches=[...normalized.matchAll(/\d+(?:[.,]\d+)*(?:\s*(?:mil|k)\b)?/g)];
  let amount;
  if (matches.length===1) {
    const raw=matches[0][0];
    let value=raw.replace(/\s*(mil|k)$/,'');
    if (value.includes(',')) value=value.replace(/\./g,'').replace(',','.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value=value.replace(/\./g,'');
    amount=Number(value)*(/(?:mil|k)$/.test(raw)?1000:1);
    if (/[-−]\s*$/.test(normalized.slice(0,matches[0].index))) throw new Error('El monto debe ser positivo.');
  } else if (matches.length>1) throw new Error('Mandame un solo monto por mensaje y la fecha como DD/MM/AAAA.');
  else {
    const runs=[]; let run=[];
    for (const token of [...(normalized.match(/[a-z]+/g)||[]),'!']) {
      if (token in words || ['mil','millon','millones'].includes(token) || (token==='y' && run.length)) run.push(token);
      else if (run.length) { while(run.at(-1)==='y') run.pop(); if(run.length) runs.push(run); run=[]; }
    }
    const meaningful=runs.filter(r=>!(r.length===1 && ['un','una'].includes(r[0])));
    if (meaningful.length!==1) throw new Error('No pude identificar un único monto. Ejemplo: “8500 supermercado”.');
    amount=wordAmount(meaningful[0]);
  }
  if (!Number.isFinite(amount)||amount<=0||amount>1e10||Math.abs(amount*100-Math.round(amount*100))>0.001) throw new Error('Monto inválido: usá un valor positivo con hasta dos decimales.');
  const found=categories.filter(category=>[normalize(category),...(aliases[category]||[])].some(name=>new RegExp(`(?:^|[^a-z])${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^a-z])`).test(normalized)));
  const specific=found.filter(c=>c!=='Otros'||!found.includes('Otros Egresos'));
  if(specific.length!==1) throw new Error('Indicá una sola categoría. Escribí /categorias para ver las opciones.');
  const category=specific[0];
  if (/\b(cobre|ingreso|sueldo|salario)\b/.test(normalized)&&!category.startsWith('Ingreso')) throw new Error('Para ingresos usá “Ingreso Fijo” o “Ingreso Extra”.');
  return {date,month:date.slice(0,7),category,amount:Math.round(amount*100)/100,currency:'ARS',type:category.startsWith('Ingreso')?'Ingreso':'Gasto',description:text.slice(0,2000)};
}
