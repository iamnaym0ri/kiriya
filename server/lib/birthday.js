import { BIRTHDAY, BIRTHDAY_WEEK_DAYS } from "../content/publicProfile.js";
import { daysBetween, localDay, nextOccurrence } from "./time.js";

export function birthdayInfo(today = localDay()) {
  const year = Number(today.slice(0, 4));
  const pad = (n) => String(n).padStart(2, "0");
  const thisYears = `${year}-${pad(BIRTHDAY.month)}-${pad(BIRTHDAY.day)}`;
  const intoWeek = daysBetween(thisYears, today);
  const inWeek = intoWeek >= 0 && intoWeek < BIRTHDAY_WEEK_DAYS;
  const next = nextOccurrence(BIRTHDAY.month, BIRTHDAY.day, today);
  return {
    isBirthday: intoWeek === 0,
    isBirthdayWeek: inWeek,
    dayOfWeek: inWeek ? intoWeek + 1 : null,
    daysUntil: daysBetween(today, next),
  };
}
