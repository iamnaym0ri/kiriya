// "Add to calendar". On the website the browser saves a generated .ics and iOS offers to add it.
// Inside the app a generated file can't reach Calendar (the web view drops blob links), so the app
// opens the server's .ics link in Safari instead, which shows the Add to Calendar sheet.
import { apiUrl } from "../../lib/api.js";
import { isNativeApp } from "../../lib/native.js";
import { icsFileName, toIcs } from "../../../shared/eventCalendar.js";
import { calendarUrl } from "./eventsData.js";

export const canAddToCalendar = (item) => Boolean(item && !item.datesTbc && (item.startsAt || item.days?.length || item.drop?.dropAt || item.drop?.until));

/** Returns "opened" | "downloaded" | "unavailable". */
export function addToCalendar(item) {
  if (!canAddToCalendar(item)) return "unavailable";
  if (isNativeApp()) {
    const path = calendarUrl(item.id);
    if (!path) return "unavailable";
    window.open(apiUrl(path), "_blank");
    return "opened";
  }
  const ics = toIcs(item);
  if (!ics) return "unavailable";
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFileName(item);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
