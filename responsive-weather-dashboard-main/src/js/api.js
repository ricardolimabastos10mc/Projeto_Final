// api.js - Open-Meteo client (free, no API key). Every request has a timeout, and
// errors are normalised into WeatherApiError with a message fit for the UI.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 10_000;
const SUGGESTION_COUNT = 5;
const FORECAST_DAYS = 7;

export class WeatherApiError extends Error {}

/** fetch + JSON with a timeout; a caller's AbortSignal (e.g. a newer search) also cancels it. */
async function getJson(url, { signal, fetchImpl = fetch } = {}) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
        response = await fetchImpl(url, { signal: combined });
    } catch (error) {
        if (error.name === "AbortError" && signal?.aborted) throw error; // superseded: not a user-facing error
        if (error.name === "TimeoutError" || timeout.aborted) {
            throw new WeatherApiError("The weather service took too long to respond. Try again.");
        }
        throw new WeatherApiError("Can't reach the weather service. Check your connection.");
    }
    if (!response.ok) {
        throw new WeatherApiError(`The weather service returned an error (${response.status}).`);
    }
    return response.json();
}

/** Builds the forecast URL. Exported so tests can check the exact parameters. */
export function forecastUrl({ latitude, longitude }, unit = "celsius") {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
        hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
        timezone: "auto", // times come back in the location's own timezone
        forecast_days: String(FORECAST_DAYS),
    });
    if (unit === "fahrenheit") {
        params.set("temperature_unit", "fahrenheit");
        params.set("wind_speed_unit", "mph");
    }
    return `${FORECAST_URL}?${params}`;
}

/** City search for the autocomplete. Returns [] for queries under 2 characters. */
export async function searchPlaces(query, options) {
    const name = query.trim();
    if (name.length < 2) return [];
    const params = new URLSearchParams({ name, count: String(SUGGESTION_COUNT), language: "en", format: "json" });
    const data = await getJson(`${GEOCODING_URL}?${params}`, options);
    // Keep only the fields the app uses; these objects end up in localStorage.
    return (data.results ?? []).map(({ id, name, admin1, country, latitude, longitude }) => ({
        id,
        name,
        admin1,
        country,
        latitude,
        longitude,
    }));
}

/** Current, hourly and daily forecast for a place, in the unit system the user picked. */
export async function getForecast(place, unit, options) {
    return getJson(forecastUrl(place, unit), options);
}
