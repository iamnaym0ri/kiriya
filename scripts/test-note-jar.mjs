import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, like } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import { NOTE_JAR_NOTES } from "../server/content/noteJar.js";
import { chooseNote, pullNote, readNoteJar, noteHistory, keepNote } from "../server/lib/noteJar.js";
import { saveCheckin } from "../server/lib/checkin.js";
import { birthdayInfo } from "../server/lib/birthday.js";
const client = new PGlite(), db = drizzle({ client, schema });
await migrate(db, { migrationsFolder: new URL("../server/db/migrations", import.meta.url).pathname });
const day="2026-09-16",options={day,now:new Date("2026-09-16T02:00:00Z"),random:()=>.3};
const blank=()=>({revision:0,seen:[],ever:[],recent:[],last:null,daily:null});
try {
  await test("Jar library is substantial, distinct and second-person, with grounded fan-note bylines",()=>{
    assert(NOTE_JAR_NOTES.length>=280);
    const canonical=text=>text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
    assert.equal(new Set(NOTE_JAR_NOTES.map(n=>canonical(n.text))).size,NOTE_JAR_NOTES.length);
    assert.equal(new Set(NOTE_JAR_NOTES.map(n=>n.id)).size,NOTE_JAR_NOTES.length);
    assert(NOTE_JAR_NOTES.every(n=>n.text.length>=50&&n.text.length<400));
    assert(NOTE_JAR_NOTES.filter(n=>n.voice==="maomao").every(n=>n.byline.includes("Maomao-inspired")));
  });
  await test("Every note can be pulled before repetition; the complete library never imposes a daily stop",()=>{
    let state=blank();
    for(let i=0;i<NOTE_JAR_NOTES.length;i++){
      const {note,reset}=chooseNote(state,{random:()=>.3,feeling:"sad",energy:0});
      assert(!reset);assert(!state.seen.includes(note.id));
      state={...state,seen:[...state.seen,note.id],lastNote:note.id,recent:[note.theme,...state.recent].slice(0,4)};
    }
    const next=chooseNote(state,{random:()=>.3});assert(next.reset);assert.notEqual(next.note.id,state.lastNote);
  });
  await test("Feeling and low battery steer selection without using presentation or address",()=>{
    for(const feeling of ["sad","anxious","overwhelmed","angry","happy","content","excited","playful"]){
      const {note}=chooseNote(blank(),{feeling,energy:2,random:()=>.3});assert(note.feelings.includes(feeling),feeling);
    }
    const calm=chooseNote(blank(),{energy:0,random:()=>.3}).note;
    assert(["rest","soft","space","steady"].includes(calm.theme));
  });
  await test("A read consumes nothing; first daily note and saved cards persist across later pulls/days",async()=>{
    assert.equal((await readNoteJar(db,day)).current,null);
    await saveCheckin(db,day,{mood:"night",address:"they/them",energy:0,feeling:"sad"});
    const first=await pullNote(db,randomUUID(),options);assert(first.note.feelings.includes("sad"));
    const saved=await keepNote(db,first.id,true);assert(saved.saved);
    const second=await pullNote(db,randomUUID(),options);assert.notEqual(second.note.id,first.note.id);
    const again=await readNoteJar(db,day);assert.equal(again.daily.id,first.id);assert(again.daily.saved);assert.equal(again.current.id,second.id);
    assert.equal((await readNoteJar(db,"2026-09-17")).daily,null);
    const tomorrow=await pullNote(db,randomUUID(),{...options,day:"2026-09-17"});
    assert.equal((await readNoteJar(db,"2026-09-17")).daily.id,tomorrow.id);
    assert((await noteHistory(db,{saved:true})).items.some(n=>n.id===first.id));
    assert.equal(await keepNote(db,randomUUID(),true),null);
  });
  await test("Concurrent repeated requests recover the same delivery without consuming additional notes",async()=>{
    const id=randomUUID(),before=(await readNoteJar(db,day)).pulled;
    const results=await Promise.all(Array.from({length:8},()=>pullNote(db,id,options)));
    assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(new Set(results.map(r=>r.note.id)).size,1);
    assert.equal((await readNoteJar(db,day)).pulled,before+1);
    assert.equal((await pullNote(db,id,options)).ordinal,results[0].ordinal);
  });
  await test("Concurrent distinct pulls claim different notes and sequential ordinals",async()=>{
    const before=(await readNoteJar(db,day)).pulled;
    const results=await Promise.all(Array.from({length:10},()=>pullNote(db,randomUUID(),options)));
    assert.equal(new Set(results.map(r=>r.note.id)).size,10);assert.equal(new Set(results.map(r=>r.ordinal)).size,10);
    assert.equal((await readNoteJar(db,day)).pulled,before+10);
  });
  await test("Dated history paginates without gaps, favourites do not reset seen history, and snapshots survive content changes",async()=>{
    for(let i=0;i<15;i++)await pullNote(db,randomUUID(),options);
    const first=await noteHistory(db);assert.equal(first.items.length,24);assert(first.next);
    const second=await noteHistory(db,{before:first.next});assert(second.items.length>0);
    assert.equal(new Set([...first.items,...second.items].map(n=>n.id)).size,first.items.length+second.items.length);
    const total=(await readNoteJar(db,day)).pulled;assert.equal(first.items.length+second.items.length,total);
    const note=first.items[0];await keepNote(db,note.id,true);await keepNote(db,note.id,false);
    assert.equal((await readNoteJar(db,day)).pulled,total);
    assert.equal((await db.select().from(schema.kv).where(eq(schema.kv.key,"notejar:pull:"+note.id)))[0].value.note.text,note.note.text);
  });
  await test("Admin preview leaves daily selection, delivery history and favourites untouched",async()=>{
    const before=await readNoteJar(db,day),history=await noteHistory(db);
    const preview=await pullNote(db,randomUUID(),{...options,preview:true});assert(preview.preview);
    assert.deepEqual(await readNoteJar(db,day),before);assert.deepEqual(await noteHistory(db),history);
  });
  await test("A fully read jar continues honestly with revisited notes and preserves prior history",async()=>{
    const [row]=await db.select().from(schema.kv).where(eq(schema.kv.key,"notejar:state"));
    const ids=NOTE_JAR_NOTES.map(n=>n.id);
    await db.update(schema.kv).set({value:{...row.value,seen:ids,ever:ids}}).where(eq(schema.kv.key,"notejar:state"));
    const next=await pullNote(db,randomUUID(),options);assert(next.revisited);assert.notEqual(next.note.id,row.value.lastNote);
    assert.equal((await db.select().from(schema.kv).where(like(schema.kv.key,"notejar:pull:%"))).length,row.value.revision+1);
  });
  await test("Birthday returns every September 15 and stops the next day, including future years",()=>{
    for(const year of [2026,2027,2028,2030]){
      assert(!birthdayInfo(`${year}-09-14`).isBirthday);assert(birthdayInfo(`${year}-09-15`).isBirthday);assert(!birthdayInfo(`${year}-09-16`).isBirthday);
    }
  });
} finally {await client.close();}
