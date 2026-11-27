import { EventsStrip, HomeMerch } from "../feeds/FeedPieces.jsx";

// Events & merch on home: one full-width block. For now it is the website's events strip and merch
// shelf; the events-ui agent's src/world/events/HomeEvents.jsx takes this slot at merge time.
export default function EventsBlock() {
  return (
    <section className="home-events" aria-label="Events and merch">
      <EventsStrip standalone />
      <HomeMerch />
    </section>
  );
}
