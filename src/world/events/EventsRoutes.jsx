// /world/events (the list), /world/events/<id> (one event's page), /world/events/merch (merch &
// exclusives on their own) and /world/events/merch/<event~piece> (one piece): pushed screens of the
// app's home tab. On the website the events strip on home stays as it is, so these send it there.
import { Navigate, Route, Routes } from "react-router";
import { isAppShell } from "../../lib/native.js";
import EventsList from "./EventsList.jsx";
import EventPage from "./EventPage.jsx";
import MerchList from "../merch/MerchList.jsx";
import MerchDetail from "../merch/MerchDetail.jsx";

export default function EventsRoutes() {
  if (!isAppShell()) return <Navigate replace to="/world#events" />;
  return (
    <Routes>
      <Route index element={<EventsList />} />
      <Route path="merch" element={<MerchList />} />
      <Route path="merch/:merchId" element={<MerchDetail />} />
      <Route path=":id" element={<EventPage />} />
      <Route path="*" element={<Navigate replace to="/world/events" />} />
    </Routes>
  );
}
