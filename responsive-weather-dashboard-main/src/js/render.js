// render.js - turns API data into DOM. All text goes in with textContent (no innerHTML).

import { describeWeather } from "./weather-codes.js";
import {
    clockLabel,
    dayLabel,
    formatPercent,
    formatTemperature,
    formatWind,
    hourLabel,
    nextHours,
    placeLabel,
} from "./format.js";

// Small createElement helper. Text always goes in through textContent.
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function renderCurrent(section, place, forecast, unit) {
    const { current, daily } = forecast;
    const weather = describeWeather(current.weather_code, current.is_day === 1);

    section.querySelector(".place").textContent = placeLabel(place);
    section.querySelector(".current-icon").textContent = weather.icon;
    section.querySelector(".current-temp").textContent = formatTemperature(current.temperature_2m, unit);
    section.querySelector(".current-label").textContent =
        `${weather.label} · H ${formatTemperature(daily.temperature_2m_max[0], unit)} · L ${formatTemperature(daily.temperature_2m_min[0], unit)}`;

    const fields = {
        feels: formatTemperature(current.apparent_temperature, unit),
        humidity: formatPercent(current.relative_humidity_2m),
        wind: formatWind(current.wind_speed_10m, unit),
        sunrise: clockLabel(daily.sunrise[0]),
        sunset: clockLabel(daily.sunset[0]),
    };
    for (const [field, value] of Object.entries(fields)) {
        section.querySelector(`[data-field="${field}"]`).textContent = value;
    }
    section.hidden = false;
}

export function renderHourly(section, forecast, unit) {
    const items = nextHours(forecast.hourly, forecast.current.time).map((hour, index) => {
        const weather = describeWeather(hour.code, hour.isDay);
        const item = el("li", "hour");
        item.append(
            el("span", "hour-time", index === 0 ? "Now" : hourLabel(hour.time)),
            el("span", "hour-icon", weather.icon),
            el("span", "hour-temp", formatTemperature(hour.temperature, unit)),
            el("span", "hour-rain", `💧 ${formatPercent(hour.precipitation)}`),
        );
        // Screen readers get "Light rain" instead of an emoji name.
        item.querySelector(".hour-icon").setAttribute("aria-label", weather.label);
        return item;
    });
    section.querySelector(".hour-strip").replaceChildren(...items);
    section.hidden = false;
}

export function renderDaily(section, forecast, unit) {
    const { daily } = forecast;
    const today = daily.time[0];
    // Shared scale so each day's bar shows its range relative to the whole week.
    const weekMin = Math.min(...daily.temperature_2m_min);
    const weekMax = Math.max(...daily.temperature_2m_max);
    const span = Math.max(weekMax - weekMin, 1);

    const items = daily.time.map((date, i) => {
        const weather = describeWeather(daily.weather_code[i]);
        const low = daily.temperature_2m_min[i];
        const high = daily.temperature_2m_max[i];

        const bar = el("span", "range-bar");
        const fill = el("span", "range-fill");
        // --start/--end are the empty space on each side, as a % of the week's range;
        // the CSS uses them as the fill's left and right insets.
        fill.style.setProperty("--start", `${((low - weekMin) / span) * 100}%`);
        fill.style.setProperty("--end", `${((weekMax - high) / span) * 100}%`);
        bar.append(fill);
        bar.setAttribute("aria-hidden", "true");

        const item = el("li", "day");
        const icon = el("span", "day-icon", weather.icon);
        icon.setAttribute("aria-label", weather.label);
        item.append(
            el("span", "day-name", dayLabel(date, today)),
            icon,
            el("span", "day-rain", `💧 ${formatPercent(daily.precipitation_probability_max[i])}`),
            el("span", "day-low", formatTemperature(low, unit)),
            bar,
            el("span", "day-high", formatTemperature(high, unit)),
        );
        return item;
    });
    section.querySelector(".day-list").replaceChildren(...items);
    section.hidden = false;
}

export function renderRecent(list, places, onSelect) {
    const items = places.map((place) => {
        const button = el("button", "chip", place.name);
        button.type = "button";
        button.title = placeLabel(place);
        button.addEventListener("click", () => onSelect(place));
        const item = el("li");
        item.append(button);
        return item;
    });
    list.replaceChildren(...items);
}
