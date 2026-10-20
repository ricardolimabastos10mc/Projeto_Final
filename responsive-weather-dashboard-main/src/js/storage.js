// storage.js - remembers the unit choice and recent places in localStorage.
// Storage can be unavailable (private mode, blocked cookies), so every access is
// guarded and the app still works, just without memory.

const RECENT_KEY = "weather.recentPlaces";
const UNIT_KEY = "weather.unit";
const MAX_RECENT = 5;

function read(key, fallback, storage = globalThis.localStorage) {
    try {
        const raw = storage?.getItem(key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function write(key, value, storage = globalThis.localStorage) {
    try {
        storage?.setItem(key, JSON.stringify(value));
    } catch {
        // quota exceeded or storage disabled: remembering is optional
    }
}

export function loadUnit(storage) {
    return read(UNIT_KEY, "celsius", storage) === "fahrenheit" ? "fahrenheit" : "celsius";
}

export function saveUnit(unit, storage) {
    write(UNIT_KEY, unit, storage);
}

export function loadRecentPlaces(storage) {
    const places = read(RECENT_KEY, [], storage);
    // Stored data is untrusted: keep only well-formed entries.
    return Array.isArray(places)
        ? places.filter((p) => p && typeof p.name === "string" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        : [];
}

/** Adds a place to the front, removes duplicates (same id), keeps the newest MAX_RECENT. */
export function rememberPlace(place, storage) {
    const others = loadRecentPlaces(storage).filter((p) => p.id !== place.id);
    const updated = [place, ...others].slice(0, MAX_RECENT);
    write(RECENT_KEY, updated, storage);
    return updated;
}
