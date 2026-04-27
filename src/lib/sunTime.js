import { fromZonedTime } from "date-fns-tz";
import { TORONTO_TZ } from "./constants.js";

// Convert a wall-clock instant in Toronto local time to a real UTC Date.
// monthIndex is 0-based to match the Date constructor.
export function torontoLocalToUtc(year, monthIndex, day, hour, minute) {
  const isoLocal = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}:00`;
  return fromZonedTime(isoLocal, TORONTO_TZ);
}

// Convenience: take a yyyy-mm-dd date string + minutes-since-midnight + return a UTC Date.
export function dateAndMinutesToUtc(yyyyMmDd, minutesSinceMidnight) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  return torontoLocalToUtc(y, m - 1, d, hour, minute);
}

export function formatClock(minutesSinceMidnight) {
  const h24 = Math.floor(minutesSinceMidnight / 60);
  const m = minutesSinceMidnight % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function todayInTorontoYmd() {
  // Get today's date as it currently is in Toronto wall-clock terms.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA produces YYYY-MM-DD
}
