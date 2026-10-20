// Tests for the API client (with a fake fetch) and the storage helpers (with a fake storage).
// Run: npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { forecastUrl, searchPlaces, WeatherApiError } from "../src/js/api.js";
import { loadRecentPlaces, loadUnit, rememberPlace, saveUnit } from "../src/js/storage.js";

// Stands in for fetch: records every URL and answers with `body` and `status`.
function fakeFetch(body, { status = 200 } = {}) {
    const calls = [];
    const impl = async (url) => {
        calls.push(url);
        return { ok: status >= 200 && status < 300, status, json: async () => body };
    };
    return { impl, calls };
}

describe("forecastUrl", () => {
    it("asks for local-time data in metric by default", () => {
        const url = new URL(forecastUrl({ latitude: 14.6, longitude: 120.98 }));
        assert.equal(url.searchParams.get("timezone"), "auto");
        assert.equal(url.searchParams.get("latitude"), "14.6");
        assert.equal(url.searchParams.get("temperature_unit"), null);
    });
    it("switches temperature and wind units for fahrenheit", () => {
        const url = new URL(forecastUrl({ latitude: 40.7, longitude: -74 }, "fahrenheit"));
        assert.equal(url.searchParams.get("temperature_unit"), "fahrenheit");
        assert.equal(url.searchParams.get("wind_speed_unit"), "mph");
    });
});

describe("searchPlaces", () => {
    it("skips the network for queries shorter than 2 characters", async () => {
        const { impl, calls } = fakeFetch({});
        assert.deepEqual(await searchPlaces(" a ", { fetchImpl: impl }), []);
        assert.equal(calls.length, 0);
    });
    it("maps results to the fields the app uses and encodes the query", async () => {
        const { impl, calls } = fakeFetch({
            results: [{ id: 1, name: "São Paulo", admin1: "SP", country: "Brazil", latitude: -23.5, longitude: -46.6, population: 1 }],
        });
        const places = await searchPlaces("São Paulo", { fetchImpl: impl });
        assert.deepEqual(places, [{ id: 1, name: "São Paulo", admin1: "SP", country: "Brazil", latitude: -23.5, longitude: -46.6 }]);
        assert.equal(new URL(calls[0]).searchParams.get("name"), "São Paulo");
    });
    it("returns [] when the API has no results key", async () => {
        const { impl } = fakeFetch({ generationtime_ms: 0.1 });
        assert.deepEqual(await searchPlaces("zzzzqqq", { fetchImpl: impl }), []);
    });
    it("turns HTTP and network failures into WeatherApiError", async () => {
        await assert.rejects(searchPlaces("Paris", { fetchImpl: fakeFetch({}, { status: 500 }).impl }), WeatherApiError);
        const offline = async () => {
            throw new TypeError("Failed to fetch");
        };
        await assert.rejects(searchPlaces("Paris", { fetchImpl: offline }), /Can't reach/);
    });
});

// Minimal localStorage: just getItem/setItem over a plain object.
function memoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
        data,
    };
}

describe("storage", () => {
    const place = (id, name = `City ${id}`) => ({ id, name, latitude: 1, longitude: 2 });

    it("remembers the unit and defaults to celsius", () => {
        const storage = memoryStorage();
        assert.equal(loadUnit(storage), "celsius");
        saveUnit("fahrenheit", storage);
        assert.equal(loadUnit(storage), "fahrenheit");
    });
    it("keeps the 5 newest places, newest first, without duplicates", () => {
        const storage = memoryStorage();
        for (const id of [1, 2, 3, 4, 5, 6]) rememberPlace(place(id), storage);
        rememberPlace(place(4), storage);
        assert.deepEqual(loadRecentPlaces(storage).map((p) => p.id), [4, 6, 5, 3, 2]);
    });
    it("ignores corrupt or tampered data", () => {
        assert.deepEqual(loadRecentPlaces(memoryStorage({ "weather.recentPlaces": "{not json" })), []);
        const tampered = JSON.stringify([{ name: "ok", latitude: 1, longitude: 2 }, { name: 5 }, null]);
        assert.equal(loadRecentPlaces(memoryStorage({ "weather.recentPlaces": tampered })).length, 1);
    });
    it("survives storage that throws (private mode)", () => {
        const broken = {
            getItem() {
                throw new Error("SecurityError");
            },
            setItem() {
                throw new Error("QuotaExceededError");
            },
        };
        assert.equal(loadUnit(broken), "celsius");
        assert.doesNotThrow(() => saveUnit("fahrenheit", broken));
    });
});
