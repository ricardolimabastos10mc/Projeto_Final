// main.js - app state and event wiring. Data access lives in api.js, DOM building in render.js.

import { getForecast, searchPlaces, WeatherApiError } from "./api.js";
import { placeLabel } from "./format.js";
import { renderCurrent, renderDaily, renderHourly, renderRecent } from "./render.js";
import { loadRecentPlaces, loadUnit, rememberPlace, saveUnit } from "./storage.js";

const SEARCH_DEBOUNCE_MS = 300;
const GEOLOCATION_TIMEOUT_MS = 10_000;

const $ = (selector) => document.querySelector(selector);
const ui = {
    dashboard: $("#main"),
    message: $("#message"),
    current: $("#current"),
    hourly: $("#hourly"),
    daily: $("#daily"),
    form: $("#search-form"),
    input: $("#search-input"),
    suggestions: $("#suggestions"),
    recent: $("#recent-list"),
    locate: $("#locate-button"),
    unitButtons: document.querySelectorAll(".unit-toggle [data-unit]"),
};

const state = {
    unit: loadUnit(),
    place: null,
    suggestions: [],
    activeSuggestion: -1,
    searchController: null, // aborts the previous autocomplete request when the user keeps typing
    forecastController: null,
};

function showMessage(text, isError = false) {
    ui.message.textContent = text;
    ui.message.classList.toggle("is-error", isError);
    ui.message.hidden = !text;
}

// ---- forecast -------------------------------------------------------------------

// Cancels any forecast still loading, so switching place or unit quickly can't
// end with the older response on screen.
async function loadForecast(place) {
    state.place = place;
    state.forecastController?.abort();
    state.forecastController = new AbortController();

    ui.dashboard.setAttribute("aria-busy", "true");
    ui.dashboard.classList.add("is-loading");
    showMessage(`Loading the forecast for ${placeLabel(place)}…`);
    try {
        const forecast = await getForecast(place, state.unit, { signal: state.forecastController.signal });
        renderCurrent(ui.current, place, forecast, state.unit);
        renderHourly(ui.hourly, forecast, state.unit);
        renderDaily(ui.daily, forecast, state.unit);
        showMessage("");
        document.title = `${place.name} weather`;
    } catch (error) {
        if (error.name === "AbortError") return; // a newer request replaced this one
        showMessage(error instanceof WeatherApiError ? error.message : "Something went wrong loading the forecast.", true);
    } finally {
        ui.dashboard.setAttribute("aria-busy", "false");
        ui.dashboard.classList.remove("is-loading");
    }
}

// Only search results have a numeric id; "Your location" isn't added to recents.
function selectPlace(place) {
    closeSuggestions();
    ui.input.value = "";
    if (Number.isFinite(place.id)) {
        renderRecent(ui.recent, rememberPlace(place), selectPlace);
    }
    loadForecast(place);
}

// ---- autocomplete (ARIA combobox pattern) --------------------------------------

function closeSuggestions() {
    state.suggestions = [];
    state.activeSuggestion = -1;
    ui.suggestions.hidden = true;
    ui.suggestions.replaceChildren();
    ui.input.setAttribute("aria-expanded", "false");
    ui.input.removeAttribute("aria-activedescendant");
}

function renderSuggestions() {
    const options = state.suggestions.map((place, index) => {
        const option = document.createElement("li");
        option.id = `suggestion-${index}`;
        option.role = "option";
        option.textContent = placeLabel(place);
        option.setAttribute("aria-selected", String(index === state.activeSuggestion));
        // mousedown (not click) fires before the input's blur closes the list
        option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectPlace(place);
        });
        return option;
    });
    ui.suggestions.replaceChildren(...options);
    ui.suggestions.hidden = options.length === 0;
    ui.input.setAttribute("aria-expanded", String(options.length > 0));
    if (state.activeSuggestion >= 0) {
        ui.input.setAttribute("aria-activedescendant", `suggestion-${state.activeSuggestion}`);
    }
}

// Autocomplete: wait for a pause in typing, then abort the previous lookup before
// starting a new one.
let debounceTimer;
ui.input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        state.searchController?.abort();
        state.searchController = new AbortController();
        try {
            state.suggestions = await searchPlaces(ui.input.value, { signal: state.searchController.signal });
            state.activeSuggestion = -1;
            renderSuggestions();
            if (ui.input.value.trim().length >= 2 && state.suggestions.length === 0) {
                showMessage(`No places found for "${ui.input.value.trim()}".`);
            }
        } catch (error) {
            if (error.name !== "AbortError") showMessage(error.message, true);
        }
    }, SEARCH_DEBOUNCE_MS);
});

ui.input.addEventListener("keydown", (event) => {
    const count = state.suggestions.length;
    if (event.key === "ArrowDown" && count) {
        event.preventDefault();
        state.activeSuggestion = (state.activeSuggestion + 1) % count;
        renderSuggestions();
    } else if (event.key === "ArrowUp" && count) {
        event.preventDefault();
        state.activeSuggestion = (state.activeSuggestion - 1 + count) % count;
        renderSuggestions();
    } else if (event.key === "Escape") {
        closeSuggestions();
    }
});

ui.input.addEventListener("blur", closeSuggestions);

// Enter picks the highlighted suggestion, or the first one if none is highlighted.
ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = state.suggestions[Math.max(state.activeSuggestion, 0)];
    if (choice) selectPlace(choice);
});

// ---- geolocation ------------------------------------------------------------------

ui.locate.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
        showMessage("Your browser does not support location. Search for a city instead.", true);
        return;
    }
    showMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => selectPlace({ name: "Your location", latitude: coords.latitude, longitude: coords.longitude }),
        () => showMessage("Location permission was denied. Search for a city instead.", true),
        { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 }, // a 10-minute-old fix is fine for weather
    );
});

// ---- units ------------------------------------------------------------------------

function applyUnit(unit) {
    state.unit = unit;
    saveUnit(unit);
    for (const button of ui.unitButtons) {
        button.setAttribute("aria-checked", String(button.dataset.unit === unit));
    }
}

for (const button of ui.unitButtons) {
    button.addEventListener("click", () => {
        if (button.dataset.unit === state.unit) return;
        applyUnit(button.dataset.unit);
        if (state.place) loadForecast(state.place);
    });
}

// ---- start ------------------------------------------------------------------------

/** Deep link: ?city=Manila opens that city's forecast, so a URL can be shared. */
async function openCityFromUrl(city) {
    try {
        const [place] = await searchPlaces(city);
        if (place) selectPlace(place);
        else showMessage(`No places found for "${city}".`, true);
    } catch (error) {
        showMessage(error.message, true);
    }
}

// A ?city= link wins; otherwise reopen the most recent place.
applyUnit(state.unit);
const recent = loadRecentPlaces();
renderRecent(ui.recent, recent, selectPlace);
const cityParam = new URLSearchParams(location.search).get("city");
if (cityParam) openCityFromUrl(cityParam);
else if (recent.length > 0) loadForecast(recent[0]);
