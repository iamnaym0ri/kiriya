// "Add to calendar": the events API serves each event as an .ics file (no session needed). Inside
// the app the link opens in Safari, which shows iOS's Add to Calendar sheet; in a browser it opens
// or downloads the same file.
import { isNativeApp } from "../../lib/native.js";
import { calendarLink } from "./eventsData.js";

export const canAddToCalendar = (item) => Boolean(item && !item.datesTbc && (item.startsOn || item.startsAt || item.days?.length));

export function addToCalendar(item) {
  if (!canAddToCalendar(item)) return false;
  const url = calendarLink(item.id);
  if (isNativeApp()) window.open(url, "_blank");
  else window.location.assign(url);
  return true;
}
