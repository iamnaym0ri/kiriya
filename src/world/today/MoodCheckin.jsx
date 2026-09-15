import { useId, useState } from "react";
import { useSetMood } from "../../lib/world.js";
import "./MoodCheckin.css";

export default function MoodCheckin({ data, onDone }) {
  const save = useSetMood();
  const addressId = useId();
  const [key, setKey] = useState(data.current?.key ?? "");
  const [feeling, setFeeling] = useState(data.current?.feeling?.key ?? null);
  const [energy, setEnergy] = useState(data.current?.energy ?? 2);
  const [address, setAddress] = useState(data.current?.address.label ?? "");
  const choice = data.choices.find(item => item.key === key);
  const emotion = data.feelings.find(item => item.key === feeling);
  const level = data.energyLevels[energy];
  const select = item => { setKey(item.key); setAddress(item.address.label); save.reset(); };
  const changeEnergy = value => { setEnergy(value); save.reset(); };
  return <form className="mood-checkin" onSubmit={event => { event.preventDefault(); if (choice) save.mutate({ mood: key, feeling, energy, address }, { onSuccess: onDone }); }}>
    <p className="mood-checkin__hint">{data.labels.hint}</p>
    <fieldset disabled={save.isPending} className="mood-fields">
      <legend className="sr-only">Today’s little check-in</legend>
      <section className="mood-section">
        <h3><span aria-hidden="true">01</span> {data.labels.presentation}</h3>
        <div className="mood-options" role="group" aria-label={data.labels.presentation}>
          {data.choices.map(item => <button key={item.key} type="button" className="mood-option" data-mood-key={item.key} aria-label={`${item.label}: ${item.hint}`} aria-pressed={key === item.key} onClick={() => select(item)}>
            <span className="mood-option__face" aria-hidden="true">{item.face}</span><strong>{item.label}</strong><small>{item.hint}</small>
          </button>)}
        </div>
        {choice && <div className="mood-address">
          <label htmlFor={addressId}>{data.labels.address}</label>
          <select id={addressId} value={address} onChange={event => { setAddress(event.target.value); save.reset(); }}>{data.addressOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>
          <p>{data.labels.addressHint}</p>
        </div>}
      </section>
      <section className="mood-section mood-feelings">
        <h3><span aria-hidden="true">02</span> And your mood?</h3>
        <div className="feeling-options" role="group" aria-label="Your mood">
          {data.feelings.map(item => <button key={item.key} type="button" className="feeling-option" aria-label={`${item.label}: ${item.hint}`} aria-pressed={feeling === item.key} onClick={() => { setFeeling(item.key); save.reset(); }}>
            <span className="feeling-emoji" aria-hidden="true">{item.emoji}</span><strong>{item.label}</strong>
          </button>)}
        </div>
        <div className="feeling-aside"><p aria-live="polite">{emotion?.hint ?? "a bit of everything is allowed, too."}</p>{emotion && <button type="button" onClick={() => { setFeeling(null); save.reset(); }}>clear</button>}</div>
      </section>
      <section className="mood-section mood-energy" data-energy={energy}>
        <h3><span aria-hidden="true">03</span> The social battery</h3>
        <div className="energy-readout"><span key={energy} className="energy-face" aria-hidden="true">{level.face}</span><div><strong>{level.label}</strong><span className="energy-battery" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} data-lit={i <= energy} />)}</span></div></div>
        <input type="range" min="0" max="4" step="1" value={energy} aria-label="Your energy" aria-valuetext={`${level.label}. ${level.comment}`} style={{ "--charge": `${energy * 25}%` }} onChange={event => changeEnergy(Number(event.target.value))} />
        <div className="energy-endpoints"><button type="button" onClick={() => changeEnergy(0)}>low battery</button><span>drag to charge ↔</span><button type="button" onClick={() => changeEnergy(4)}>full yap</button></div>
        <p className="energy-comment" aria-live="polite">“{level.comment}”</p>
      </section>
    </fieldset>
    <footer className="mood-save">
      <p>{emotion?.response ?? "a little colour shift. still your lilac world. ♡"}</p>
      {save.error && <p className="mood-error" role="alert">{save.error.message} Your previous choice is still kept.</p>}
      <button type="submit" className="button-plum" disabled={!choice || save.isPending}>{save.isPending ? "Keeping today’s feeling…" : "Keep today’s feeling ♡"}</button>
    </footer>
  </form>;
}
