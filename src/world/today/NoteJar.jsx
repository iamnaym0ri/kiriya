import { useEffect, useId, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInView } from "motion/react";
import { api } from "../../lib/api.js";
import { usePlayful } from "../../shared/play/PlayfulContext.js";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import { Icon, Modal } from "../../shared/WorldPrimitives.jsx";
import BirthdayTakeover from "./BirthdayTakeover.jsx";
import "./NoteJar.css";

const queryKey = ["me", "note-jar"];
const dateLabel = day => new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" }).format(new Date(`${day}T12:00:00+08:00`));

function JarArtwork({ drawing, revision }) {
  const id = useId();
  return <svg className="note-jar__art" viewBox="0 0 360 390" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" x2="1" y2="1"><stop stopColor="#fffaff" stopOpacity=".9"/><stop offset=".5" stopColor="#dcc7eb" stopOpacity=".35"/><stop offset="1" stopColor="#e7bfda" stopOpacity=".75"/></linearGradient>
      <linearGradient id={`${id}-lid`} x2="0" y2="1"><stop stopColor="#e9c8da"/><stop offset="1" stopColor="#be8fae"/></linearGradient>
      <clipPath id={`${id}-inside`}><path d="M106 120h148v20c0 25 30 26 30 63v115q0 31-31 31H107q-31 0-31-31V203c0-37 30-38 30-63Z"/></clipPath>
    </defs>
    <ellipse cx="180" cy="359" rx="119" ry="13" fill="#b697cc" opacity=".17"/>
    <g key={revision} className="jar-pull-cycle" data-drawing={drawing}>
      <g className="jar-vessel">
        <path d="M106 120h148v20c0 25 30 26 30 63v115q0 31-31 31H107q-31 0-31-31V203c0-37 30-38 30-63Z" fill={`url(#${id}-glass)`} stroke="#ae8abb" strokeWidth="2.5"/>
        <g clipPath={`url(#${id}-inside)`}>
          {[[106,278,-19,"#d6bee8"],[213,294,14,"#efc5d9"],[159,318,-8,"#fff5df"],[127,235,16,"#efcbdc"],[209,230,-17,"#ded0ec"],[154,275,9,"#fff8eb"],[96,323,17,"#e2d2ef"],[241,329,-15,"#fff4e7"]].map(([x,y,angle,color],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}><g className="jar-folded-note" style={{"--paper":i}}><rect x="-25" y="-16" width="58" height="34" rx="3" fill={color} stroke="#b597bb" strokeWidth="1.3"/><path d="m-23-13 28 16 26-16" fill="none" stroke="#c3a4c4"/><path d="M1 5q-7-8-10-3-3 5 10 11Q14 4 10 0 6-3 1 5" fill="#bb85aa"/></g></g>)}
        </g>
        <path d="M103 181q-14 10-14 30v67m1 15v13" fill="none" stroke="#fffaff" strokeWidth="7" strokeLinecap="round" opacity=".8"/>
        <path d="M265 217v95q0 20-18 20" fill="none" stroke="#b693bf" strokeWidth="3" opacity=".35"/>
        <path d="M107 142h145" stroke="#fff8fd" strokeWidth="6"/>
        <path d="M83 193q93 16 194-1" fill="none" stroke="#cda0c3" strokeWidth="10"/>
        <g className="jar-bow" transform="translate(183 191)">
          <path d="M-4-2C-44-36-63-8-42 3c11 7 24 5 38-5ZM4-2C44-35 63-9 42 4c-11 7-26 3-38-6Z" fill="#dda9c5" stroke="#b580a5" strokeWidth="2"/>
          <path d="m-7 3-22 37 17-5 11-24 17 32 11-10L7 3" fill="#d7a0be" stroke="#b580a5" strokeWidth="1.5"/>
          <ellipse rx="10" ry="8" fill="#c28aad"/>
        </g>
        <g transform="rotate(-4 180 266)"><rect x="113" y="244" width="134" height="54" rx="7" fill="#fffaf5" stroke="#ccb3cf"/><rect x="118" y="249" width="124" height="44" rx="5" fill="none" stroke="#ddc9db" strokeDasharray="3 3"/><text x="180" y="279" textAnchor="middle" className="jar-label">little bits of love</text></g>
      </g>
      <g className="jar-lid"><ellipse cx="180" cy="111" rx="87" ry="17" fill="#e4bdd4" stroke="#b787a9" strokeWidth="2"/><path d="M93 109v17q1 16 87 16t87-16v-17q-5 15-87 15t-87-15Z" fill={`url(#${id}-lid)`} stroke="#b787a9" strokeWidth="2"/><path d="M105 110q65-19 140 0" stroke="#fff6fc" strokeWidth="3" opacity=".8" fill="none"/><path d="m133 127 4 9m11-7 3 9m12-8 2 9m13-8v9m14-9-1 8m14-10-2 9m15-11-3 9m15-13-4 9" stroke="#a57a9f" opacity=".4"/></g>
      {drawing && <g className="jar-flying-note"><rect x="153" y="135" width="58" height="43" rx="4" fill="#fffaf3" stroke="#ba94c4" strokeWidth="2"/><path d="m156 140 26 17 26-17" fill="none" stroke="#c9a3c5" strokeWidth="1.5"/><path d="M182 151q-7-8-10-2-3 5 10 13 13-8 10-13-3-6-10 2" fill="#bb80ad"/></g>}
    </g>
    {["♡","✧","✿","✦"].map((charm,i)=><text key={i} className="jar-charm" x={[57,298,278,81][i]} y={[180,153,79,79][i]} style={{"--charm":i}}>{charm}</text>)}
  </svg>;
}

function NoteHistory({ onClose, onChoose }) {
  const [savedOnly,setSavedOnly] = useState(false);
  const query = useInfiniteQuery({ queryKey:[...queryKey,"history",savedOnly], initialPageParam:null,
    queryFn:({pageParam,signal})=>api(`/me/note-jar/history?saved=${savedOnly}${pageParam?`&before=${pageParam}`:""}`,{signal}),
    getNextPageParam:page=>page.next??undefined });
  const items = query.data?.pages.flatMap(page=>page.items)??[];
  const groups = Map.groupBy ? Map.groupBy(items,item=>item.day) : items.reduce((map,item)=>map.set(item.day,[...(map.get(item.day)??[]),item]),new Map());
  return <Modal title="little notes, kept close ♡" onClose={onClose} className="note-jar-history">
    <div className="note-jar-history__filters"><button className="quiet-button" aria-pressed={!savedOnly} onClick={()=>setSavedOnly(false)}>all your pulls</button><button className="quiet-button" aria-pressed={savedOnly} onClick={()=>setSavedOnly(true)}>favourites ♡</button></div>
    {query.isPending?<p role="status">opening your little collection…</p>:query.isError?<div role="alert"><p>Your notes couldn’t load.</p><button className="text-link" onClick={()=>query.refetch()}>Try again</button></div>:!items.length?<p className="handwritten">{savedOnly?"a little heart on a note keeps it here.":"your first little pull will be waiting here."}</p>:null}
    {[...groups].map(([day,notes])=><section key={day}><h3>{dateLabel(day)}</h3><div className="note-jar-history__pages">{notes.map(item=><button key={item.id} className="note-jar-history__note" onClick={()=>{onChoose(item);onClose();}}><span>{item.saved?"♥ ":""}{item.note.label}</span><p>{item.note.text}</p><small>{item.note.byline}</small></button>)}</div></section>)}
    {query.hasNextPage&&<button className="text-link" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>{query.isFetchingNextPage?"opening…":"older little notes ↓"}</button>}
  </Modal>;
}

export default function NoteJar({ birthday = {}, signature, day }) {
  const queryClient=useQueryClient(),ref=useRef(null),paperRef=useRef(null),reveal=useRef(false),pendingId=useRef(null),busy=useRef(false),alive=useRef(true);
  const {moving}=usePlayful(),inView=useInView(ref,{margin:"30px"});
  const {current:feeling,open:openFeeling}=useDailyStyle();
  const query=useQuery({queryKey:[...queryKey,day??"today"],queryFn:({signal})=>api("/me/note-jar",{signal}),staleTime:60_000});
  const [chosen,setChosen]=useState(null),[drawing,setDrawing]=useState(false),[revision,setRevision]=useState(0),[history,setHistory]=useState(false),[error,setError]=useState("");
  const [announcement,setAnnouncement]=useState("");
  const record=chosen??query.data?.current;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{setChosen(null);},[day]);
  useEffect(()=>{
    if(!record?.id||!reveal.current)return;
    reveal.current=false;
    if(matchMedia("(max-width: 650px)").matches)paperRef.current?.scrollIntoView({block:"center",behavior:moving?"smooth":"instant"});
  },[record?.id,moving]);
  const keep=useMutation({mutationFn:item=>api("/me/note-jar/keep",{method:"PUT",body:{id:item.id,saved:!item.saved}}),onSuccess:item=>{
    setChosen(current=>current?.id===item.id?item:current);
    queryClient.invalidateQueries({queryKey});
  }});
  async function pull(){
    if(busy.current)return;
    busy.current=true;setError("");setDrawing(true);setRevision(n=>n+1);setAnnouncement("finding a little note for u…");
    pendingId.current??=crypto.randomUUID();
    const wait=moving&&inView?750:0;
    try{
      const [item]=await Promise.all([api("/me/note-jar/pull",{method:"POST",body:{requestId:pendingId.current}}),new Promise(resolve=>setTimeout(resolve,wait))]);
      pendingId.current=null;
      if(!alive.current)return;
      reveal.current=true;
      setChosen(item);setAnnouncement(item.note.text);keep.reset();
      queryClient.invalidateQueries({queryKey});
    }catch{
      if(alive.current){setError("the ribbon got a little tangled. try that pull again?");setAnnouncement("");}
    }finally{
      busy.current=false;if(alive.current)setDrawing(false);
    }
  }
  const todayWaiting=!query.data?.daily;
  return <section ref={ref} id="note-jar" className={`note-jar${birthday.isBirthday?" note-jar--birthday":""}`} data-motion-region data-jar-motion={moving&&inView?"on":"off"} aria-labelledby="note-jar-title">
    {birthday.isBirthday&&<BirthdayTakeover birthday={birthday} signature={signature}/>}
    <header className="note-jar__heading"><span className="micro-label">{birthday.isBirthday?"A BIRTHDAY JAR FULL OF LOVE":"LITTLE LOVE NOTES, ALL YEAR ROUND"}</span><h2 id="note-jar-title">{birthday.isBirthday?"a birthday wish,":"a little jar,"} <em>just for u <span aria-hidden="true">♡</span></em></h2><p>for the bright days, the “ugh” days, & everything in between.</p></header>
    <div className="note-jar__layout">
      <div className="note-jar__shelf">
        <div className="note-jar__day"><span aria-hidden="true">✧</span> {query.isPending?"a little love is waiting…":todayWaiting?"today’s little note is waiting":"a little love, picked up today"}</div>
        <JarArtwork drawing={drawing} revision={revision}/>
        <button className="note-jar__pull button-plum" onClick={pull} disabled={drawing} aria-controls="note-jar-paper"><Icon name="mail" size={18}/>{drawing?"a little note, coming right up…":error?"try that little pull again":record?"pull another little note":"pull a little note"}<span aria-hidden="true">♡</span></button>
        <p className="note-jar__unlimited">take another. there’s no daily limit.</p>
      </div>
      <div className="note-jar__reading">
        <div className="note-jar__tape" aria-hidden="true"/>
        <article ref={paperRef} id="note-jar-paper" key={record?.id??"waiting"} className={`note-jar__paper${record?" note-jar__paper--open":""}`} aria-busy={drawing}>
          <span className="micro-label">{record?.note.label??"FOLDED WITH A LITTLE EXTRA CARE"}</span>
          <p className="note-jar__salutation">{record?"hey, u.":"there’s something nice in here."}</p>
          <p className="note-jar__message">{record?.note.text??"a little encouragement. a caring reminder. a tiny reason to smile. all picked for ur lovely, interesting, very-much-u self."}</p>
          <p className="note-jar__byline">{record?.note.byline??"one small note at a time ♡"}</p>
          {record&&<div className="note-jar__paper-footer"><small>{dateLabel(record.day)}{record.revisited?" · a little favourite, revisited":""}</small><button className="note-jar__keep" disabled={drawing||keep.isPending||record.preview} aria-pressed={record.saved} onClick={()=>{setChosen(record);keep.mutate(record);}}><Icon name="heart" size={18}/>{record.saved?"kept close":"keep this"}</button></div>}
        </article>
        <div className="note-jar__feedback">{error&&<p role="alert">{error}</p>}{keep.isError&&<p role="alert">That note couldn’t be kept. Tap the heart to try again.</p>}{query.isError&&!record&&<p role="alert">Your collection couldn’t load. You can still try pulling a note.</p>}{record?.preview&&<p>Admin preview · your pulls won’t change Kiriya’s history.</p>}</div>
        <div className="note-jar__underpaper"><span aria-hidden="true">(˘ ᵕ ˘) ♡</span><p>no perfect-day requirement.</p></div>
      </div>
    </div>
    <footer className="note-jar__footer"><button className="text-link" onClick={()=>setHistory(true)}><Icon name="heart" size={16}/> your little collection</button>{query.data?.daily&&query.data.daily.id!==record?.id&&<button className="text-link" onClick={()=>setChosen(query.data.daily)}>today’s first little note</button>}<button className="text-link" onClick={openFeeling}>{feeling?.feeling?`${feeling.feeling.emoji} ${feeling.feeling.label.toLowerCase()} today` :"a note for your mood"}<Icon name="settings" size={16}/></button></footer>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    {history&&<NoteHistory onClose={()=>setHistory(false)} onChoose={item=>{reveal.current=true;setChosen(item);keep.reset();}}/>}
  </section>;
}
