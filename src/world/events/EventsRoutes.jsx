// /world/events (the list) and /world/events/<id> (one event's page): pushed screens of the app's
// home tab. On the website the events strip on home stays as it is, so these send it there.
import { Navigate, Route, Routes } from "react-router";
import { isAppShell } from "../../lib/native.js";
import EventsList from "./EventsList.jsx";
import EventPage from "./EventPage.jsx";

export default function EventsRoutes() {
  if (!isAppShell()) return <Navigate replace to="/world#events" />;
  return (
    <Routes>
      <Route index element={<EventsList />} />
      <Route path=":id" element={<EventPage />} />
      <Route path="*" element={<Navigate replace to="/world/events" />} />
    </Routes>
  );
}
