import { DatabaseSync } from 'node:sqlite';
export class Store {
  constructor(path) {
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY,chat TEXT NOT NULL,payload TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',result TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_try INTEGER NOT NULL DEFAULT 0);`);
  }
  offset(){return Number(this.db.prepare("SELECT value FROM meta WHERE key='offset'").get()?.value||0);}
  receive(update,allowedId){
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const m=update.message;
      if(m&&m.from?.id===allowedId&&m.chat.type==='private') this.db.prepare('INSERT OR IGNORE INTO jobs(id,chat,payload) VALUES (?,?,?)').run(update.update_id,String(m.chat.id),JSON.stringify(m));
      const q=update.callback_query;
      if(q?.from?.id===allowedId&&q.message?.chat?.type==='private') {
        const match=/^(confirm|cancel):(\d+)$/.exec(q.data||'');
        if(match) this.db.prepare("UPDATE jobs SET state=?,next_try=0 WHERE id=? AND chat=? AND state='waiting'").run(match[1]==='confirm'?'ready':'cancelled',Number(match[2]),String(q.message.chat.id));
      }
      this.db.prepare("INSERT INTO meta(key,value) VALUES ('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(update.update_id+1));
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  next(){return this.db.prepare("SELECT * FROM jobs WHERE state IN ('pending','preview','ready','saved','cancelled','invalid') AND next_try<=? ORDER BY id LIMIT 1").get(Date.now());}
  set(id,state,result){this.db.prepare('UPDATE jobs SET state=?,result=COALESCE(?,result),next_try=0,attempts=0 WHERE id=?').run(state,result==null?null:JSON.stringify(result),id);}
  retry(job){this.db.prepare('UPDATE jobs SET attempts=attempts+1,next_try=? WHERE id=?').run(Date.now()+Math.min(300000,2000*2**Math.min(job.attempts,8)),job.id);}
}
