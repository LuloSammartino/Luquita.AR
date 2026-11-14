import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
const update=(id,user=42,type='private')=>({update_id:id,message:{from:{id:user},chat:{id:42,type},text:'8500 supermercado'}});
test('cola durable, deduplicación y confirmación autorizada',()=>{
  const dir=mkdtempSync(join(tmpdir(),'luquita-test-'));let store=new Store(join(dir,'queue.db'));
  try {
    store.receive(update(1),42);store.receive(update(1),42);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM jobs').get().n,1);
    store.receive(update(2,99),42);store.receive(update(3,42,'group'),42);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM jobs').get().n,1);
    assert.equal(store.offset(),4);
    store.set(1,'waiting',{amount:8500});store.db.close();store=new Store(join(dir,'queue.db'));
    const callback=(id,user,data)=>({update_id:id,callback_query:{from:{id:user},message:{chat:{id:42,type:'private'}},data}});
    store.receive(callback(4,99,'confirm:1'),42);
    assert.equal(store.next(),undefined);
    store.receive(callback(5,42,'confirm:1'),42);
    assert.equal(store.next().state,'ready');
    store.receive(callback(6,42,'cancel:1'),42);
    assert.equal(store.next().state,'ready');
    store.retry(store.next());assert.equal(store.next(),undefined);
  } finally {store.db.close();rmSync(dir,{recursive:true,force:true});}
});
