// format.js - pure formatting helpers. No DOM, no network: unit-tested in tests/format.test.js.

/** @param {number} value @param {"celsius"|"fahrenheit"} unit */
export function formatTemperature(value, unit) {
    if (!Number.isFinite(value)) return "--";
    return `${Math.round(value)}°${unit === "fahrenheit" ? "F" : "C"}`;
}

/** @param {number} value @param {"celsius"|"fahrenheit"} unit wind unit follows the temperature system */
export function formatWind(value, unit) {
    if (!Number.isFinite(value)) return "--";
    return unit === "fahrenheit" ? `${Math.round(value)} mph` : `${Math.round(value)} km/h`;
}

/** @param {number|null|undefined} value */
export function formatPercent(value) {
    return Number.isFinite(value) ? `${Math.round(value)}%` : "--";
}

/**
 * Weekday label for a forecast date. Open-Meteo returns local dates ("2026-09-30")
 * already in the location's timezone, so they are parsed as calendar dates, not instants.
 * @param {string} isoDate  yyyy-mm-dd
 * @param {string} todayIso yyyy-mm-dd in the same timezone
 */
export function dayLabel(isoDate, todayIso, locale = "en-US") {
    if (isoDate === todayIso) return "Today";
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
}

/** "2026-09-30T14:00" -> "2 PM" (local wall-clock time from the API, no timezone maths). */
export function hourLabel(isoDateTime) {
    const hour = Number(isoDateTime.slice(11, 13));
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** "2026-09-30T06:12" -> "6:12 AM" */
export function clockLabel(isoDateTime) {
    const [hour, minute] = isoDateTime.slice(11, 16).split(":").map(Number);
    const suffix = hour < 12 ? "AM" : "PM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * The next `count` hourly entries starting at the current hour.
 * @param {{time: string[], temperature_2m: number[], precipitation_probability: number[], weather_code: number[], is_day: number[]}} hourly
 * @param {string} currentTime ISO local time of the "current" block, e.g. "2026-09-30T14:15"
 */
export function nextHours(hourly, currentTime, count = 24) {
    const currentHour = currentTime.slice(0, 13); // "2026-09-30T14"
    let start = hourly.time.findIndex((time) => time.slice(0, 13) >= currentHour);
    if (start === -1) start = 0;
    return hourly.time.slice(start, start + count).map((time, offset) => ({
        time,
        temperature: hourly.temperature_2m[start + offset],
        precipitation: hourly.precipitation_probability[start + offset],
        code: hourly.weather_code[start + offset],
        isDay: hourly.is_day[start + offset] === 1,
    }));
}

/** "Manila, Metro Manila, Philippines" without empty or repeated parts. */
export function placeLabel(place) {
    const parts = [place.name, place.admin1, place.country].filter(Boolean);
    return [...new Set(parts)].join(", ");
}
