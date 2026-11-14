import test from 'node:test';
import assert from 'node:assert/strict';
import {Telegram,telegramError} from '../src/telegram.js';

test('conserva el código y la descripción del conflicto de Telegram',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>({status:409,json:async()=>({ok:false,error_code:409,description:'Conflict: terminated by other getUpdates request'})});
    const t=new Telegram(' token ');
    assert.equal(t.token,'token');
    await assert.rejects(t.call('getUpdates'),error=>error.code===409&&error.message.includes('other getUpdates request'));
  }finally{globalThis.fetch=original;}
});
test('el diagnóstico incluye la causa de red y oculta el token',()=>{
  const error=new Error('fetch failed: https://api.telegram.org/botSECRETO/getUpdates',{cause:Object.assign(new Error('Connection timed out'),{code:'ETIMEDOUT'})});
  const message=telegramError(error,'SECRETO');
  assert.ok(message.includes('ETIMEDOUT'));
  assert.ok(message.includes('Connection timed out'));
  assert.ok(!message.includes('SECRETO'));
});
