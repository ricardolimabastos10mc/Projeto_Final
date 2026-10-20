# Responsive weather dashboard

[![CI](https://github.com/Nexude-ZainaV/responsive-weather-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Nexude-ZainaV/responsive-weather-dashboard/actions/workflows/ci.yml)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Live demo: https://nexude-zainav.github.io/responsive-weather-dashboard/?city=Manila

Current conditions, the next 24 hours and a 7-day forecast for any city. It's plain
HTML, CSS and JavaScript (ES modules), with no framework and no build step. The data
comes from the free [Open-Meteo](https://open-meteo.com/) API, so there's no API key
to manage.

| Phone (360px) | Desktop (1280px) |
|---|---|
| <img src="docs/screenshot-mobile.png" width="220" alt="Dashboard on a phone: stacked cards"> | <img src="docs/screenshot-desktop.png" width="560" alt="Dashboard on a desktop: three columns"> |

## Features

- City search with autocomplete, built as an ARIA combobox (arrow keys, Enter, Escape)
- "Use my location" through the Geolocation API
- °C / °F toggle; wind switches between km/h and mph with it
- A 24-hour strip with scroll snapping, and a 7-day list whose temperature bars share
  one weekly scale
- Recent places and the unit choice are remembered in `localStorage`
- Shareable links such as `?city=Tokyo`
- Light and dark themes from `prefers-color-scheme`, and no motion under
  `prefers-reduced-motion`

## Responsive approach

The base CSS targets phones, and `min-width` queries add layout as the screen grows.

| Breakpoint | Devices | Layout |
|---|---|---|
| < 600px | phones | header on two rows, cards stacked |
| 600px | large phones, small tablets (portrait) | header on one row |
| 900px | tablets (landscape), small laptops | current + hourly side by side, 7-day full width |
| 1200px | desktops | three columns |

Between breakpoints, fluid sizing does the work. I use `clamp()` for type and spacing,
`repeat(auto-fit, minmax())` grids, `100dvh` so mobile browser bars don't cause
overflow, and `minmax(0, 1fr)` columns so long content can't push the page sideways.
Touch targets are at least 44px.

## How it's laid out

```
index.html               semantic markup, landmarks, live region for status messages
src/js/main.js           state and events: search, geolocation, units, deep link
src/js/api.js            Open-Meteo client: timeouts, cancellation, friendly errors
src/js/render.js         DOM building with textContent only (no innerHTML, no XSS)
src/js/format.js         pure formatting functions (tested)
src/js/storage.js        guarded localStorage with validation of stored data (tested)
src/js/weather-codes.js  WMO weather code -> label and icon
src/css/styles.css       design tokens, mobile-first layout
```

A few things in the network code are deliberate:

- Every request has a timeout (`AbortSignal.timeout`) plus the caller's own signal,
  combined with `AbortSignal.any`.
- Stale requests get cancelled. Typing "Lon" and then "London" aborts the "Lon"
  lookup, so a slower, older response can never overwrite a newer one.
- Search is debounced by 300ms, so the geocoding API is called once per pause in
  typing instead of on every keystroke.

## Run it

Any static file server works. ES modules won't load from `file://`, so opening
`index.html` directly isn't enough.

```bash
npm start                      # npx http-server on http://localhost:5173
# or
python -m http.server 5173
```

The tests use Node's built-in test runner (Node 22+) with a fake `fetch` and a fake
storage object:

```bash
npm test
```

Pushes to `main` run the tests and deploy the site to GitHub Pages.

## License

[MIT](LICENSE). Weather data by Open-Meteo, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
