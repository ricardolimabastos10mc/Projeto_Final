// Unit tests for the pure helpers. Run: npm test  (Node's built-in test runner, no dependencies)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    clockLabel,
    dayLabel,
    formatPercent,
    formatTemperature,
    formatWind,
    hourLabel,
    nextHours,
    placeLabel,
} from "../src/js/format.js";
import { describeWeather } from "../src/js/weather-codes.js";

describe("formatTemperature", () => {
    it("rounds and adds the unit", () => {
        assert.equal(formatTemperature(21.6, "celsius"), "22°C");
        assert.equal(formatTemperature(-0.4, "celsius"), "0°C"); // never "-0"
        assert.equal(formatTemperature(70.2, "fahrenheit"), "70°F");
    });
    it("shows a placeholder for missing data", () => {
        assert.equal(formatTemperature(undefined, "celsius"), "--");
        assert.equal(formatTemperature(Number.NaN, "celsius"), "--");
    });
});

describe("formatWind / formatPercent", () => {
    it("uses km/h for metric and mph for imperial", () => {
        assert.equal(formatWind(12.4, "celsius"), "12 km/h");
        assert.equal(formatWind(7.6, "fahrenheit"), "8 mph");
    });
    it("formats percentages and placeholders", () => {
        assert.equal(formatPercent(64.5), "65%");
        assert.equal(formatPercent(null), "--");
    });
});

describe("dates and times", () => {
    it("labels today and weekdays from calendar dates", () => {
        assert.equal(dayLabel("2026-09-30", "2026-09-30"), "Today");
        assert.equal(dayLabel("2026-10-01", "2026-09-30"), "Thu");
        assert.equal(dayLabel("2026-10-04", "2026-09-30"), "Sun");
    });
    it("formats hours on a 12-hour clock", () => {
        assert.equal(hourLabel("2026-09-30T00:00"), "12 AM");
        assert.equal(hourLabel("2026-09-30T09:00"), "9 AM");
        assert.equal(hourLabel("2026-09-30T12:00"), "12 PM");
        assert.equal(hourLabel("2026-09-30T23:00"), "11 PM");
        assert.equal(clockLabel("2026-09-30T06:05"), "6:05 AM");
        assert.equal(clockLabel("2026-09-30T18:42"), "6:42 PM");
        assert.equal(clockLabel("2026-09-30T00:15"), "12:15 AM");
    });
});

describe("nextHours", () => {
    const hourly = {
        time: ["2026-09-30T12:00", "2026-09-30T13:00", "2026-09-30T14:00", "2026-09-30T15:00"],
        temperature_2m: [20, 21, 22, 23],
        precipitation_probability: [0, 10, 20, 30],
        weather_code: [0, 1, 2, 3],
        is_day: [1, 1, 1, 0],
    };

    it("starts at the current hour, even mid-hour", () => {
        const hours = nextHours(hourly, "2026-09-30T13:45", 2);
        assert.deepEqual(hours.map((h) => h.temperature), [21, 22]);
        assert.equal(hours[0].isDay, true);
    });
    it("stops at the end of the data", () => {
        assert.equal(nextHours(hourly, "2026-09-30T15:00", 24).length, 1);
    });
});

describe("placeLabel", () => {
    it("joins non-empty parts and drops repeats", () => {
        assert.equal(placeLabel({ name: "Manila", admin1: "Metro Manila", country: "Philippines" }), "Manila, Metro Manila, Philippines");
        assert.equal(placeLabel({ name: "Singapore", admin1: undefined, country: "Singapore" }), "Singapore");
    });
});

describe("describeWeather", () => {
    it("maps WMO codes, with night icons where they differ", () => {
        assert.deepEqual(describeWeather(0, true), { label: "Clear sky", icon: "☀️" });
        assert.equal(describeWeather(0, false).icon, "🌙");
        assert.equal(describeWeather(95).label, "Thunderstorm");
    });
    it("falls back for unknown codes", () => {
        assert.equal(describeWeather(1234).label, "Unknown");
    });
});
