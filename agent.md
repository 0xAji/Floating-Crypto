# Agent Knowledge: Floating Crypto

## Mandatory language policy

- All repository content and agent-produced work must be written in English.
- This includes code, comments, identifiers, tests, documentation, UI text, commit
  messages, change summaries, and responses.
- Use English regardless of the language used by the user or previously referenced
  material.
- Keep source files comment-free unless explicitly requested.

## Local settings policy

- During development, store runtime and user-local files under the repository-local
  `.local/` directory.
- Packaged builds must use `app.getPath("userData")` because the application archive is
  read-only.
- Keep `.local/` in `.gitignore`.
- Generate missing settings files with validated defaults at startup. Users must not
  need to create them manually.
- Never commit local settings, market catalogs, caches, secrets, or machine-specific
  data.

Read this file before changing market selection, the native context menu, Binance data,
persistence, or window appearance.

## Project summary

- Product: a small always-on-top cryptocurrency spot-price widget.
- App and package name: `Floating Crypto` / `floating-crypto`.
- Runtime: Electron 43 with a vanilla HTML/CSS/JavaScript renderer.
- Packaging: Electron Builder 26, Windows x64 NSIS and portable targets.
- Markets: active Binance Spot markets quoted in USDT.
- Default market: `BTCUSDT`.
- Window: frameless, transparent, starts at `378 x 292`, resizable when unlocked,
  single-instance. Minimum size is `320 x 240`.
- UI language: English.
- API key: not required.

## Commands

```powershell
npm install
npm start
npm test
npm audit
npm run build:win
```

Visual smoke test while the app is running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\capture-window.ps1
```

Output: `.artifacts/app-screenshot.png`.

Windows packaging uses `electron-builder`. The build command creates an NSIS installer
and portable x64 executable in `dist/`. The `dist/` directory is generated and ignored.

## File map

- `main.js`
  - Creates the BrowserWindow and native context menu.
  - Owns pin, master/position/size locks, mode, window bounds, appearance, market, and
    quick-pick state.
  - Writes validated settings and the fetched market catalog.
  - Sends coin, appearance, and dialog requests to the renderer.
- `preload.js`
  - Exposes the only renderer-facing desktop API through `contextBridge`.
  - Keep `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- `src/index.html`
  - Contains the ticker, chart, titlebar actions, coin picker, and color picker.
- `src/styles.css`
  - Contains the responsive full/mini visual system, opaque controls, dialogs,
    transparency, and text stroke.
- `src/renderer.js`
  - Fetches Binance market data and owns WebSocket reconnection.
  - Renders coin identity, prices, charts, search, quick picks, colors, and modes.
  - Handles custom resize and mini drag IPC.
- `src/lib/market.js`
  - Binance ticker normalization, formatting, and SVG chart path creation.
- `src/lib/coins.js`
  - Catalog normalization, coin search, symbol helpers, and price formatting.
- `src/lib/color.js`
  - HEX/RGB/HSL conversion.
- `src/lib/settings.js`
  - Persisted settings defaults and validation.
- `tests/*.test.js`
  - Node built-in tests. Helpers must remain loadable from browser and CommonJS.
- `scripts/capture-window.ps1`
  - Windows visual verification utility. It matches window title `Floating Crypto`.
- `DISCLAIMER.md`
  - States that all source code was generated entirely by an LLM and includes the
    no-warranty and financial-monitoring limitations.
- `package.json`
  - Defines scripts, dependencies, Electron Builder targets, and GitHub publish metadata.
- `.gitattributes`
  - Keeps text files LF and PowerShell scripts CRLF.

## Build and release

Windows build command:

```powershell
npm run build:win
```

Expected artifacts in `dist/`:

- `Floating-Crypto-Setup-<version>-x64.exe`
- `Floating-Crypto-Portable-<version>-x64.exe`

Release `v1.0.0` is published at:

```text
https://github.com/0xAji/Floating-Crypto/releases/tag/v1.0.0
```

The executables are unsigned. Do not describe them as signed and keep the SmartScreen
warning documented in release notes. Packaged smoke tests must clear
`ELECTRON_RUN_AS_NODE` before launching the executable.

## Persistence

### Settings

Path: `.local/settings.json`

Packaged builds use `app.getPath("userData")` instead because files inside the application
archive are read-only. Keep the repository-local `.local/` path for development runs and
tests.

Defaults:

```js
{
  pinned: true,
  miniMode: false,
  lockWindow: false,
  lockPosition: false,
  lockSize: true,
  windowPosition: null,
  windowSize: { width: 378, height: 292 },
  miniWindowSize: null,
  selectedCoin: "BTCUSDT",
  favoriteCoins: [],
  appearance: {
    backgroundColor: "#131316",
    backgroundOpacity: 1,
    priceChangeColor: "green-red",
    textColor: "#f5f3ee",
    outlineColor: "#000000",
    textOutlineWidth: 1
  }
}
```

Coin symbols are normalized to uppercase and must end in `USDT`. Favorites are unique.
Invalid or missing settings fall back to defaults. Writes are debounced and flushed
during `before-quit`.

The saved window size is validated between `320 x 240` and `4096 x 2160`. The saved
window position is reused only when at least `64 x 32` pixels intersect a connected
display work area. When no valid position is saved, the window is centered in the
primary display's work area.

### Coin catalog

Path: `.local/coins.json`

Packaged builds use `app.getPath("userData")` for this file as well.

The renderer calls `/api/v3/exchangeInfo` at every startup, filters active spot markets
quoted in USDT, derives price display precision from each `PRICE_FILTER.tickSize`, and
sends the normalized list to the main process. The main process validates and writes:

```js
{
  version: 1,
  updatedAt: "ISO-8601 timestamp",
  coins: [{ symbol, baseAsset, quoteAsset, pricePrecision }]
}
```

The cached catalog is read before the network request so the coin search remains usable
while refreshing. An empty or failed fetch must not erase a non-empty cached catalog.

## Architecture and data flow

1. `main.js` restores settings, validates the selected symbol, and creates the window.
2. The renderer loads the cached coin catalog, then requests current window state.
3. Applying a different selected symbol resets the ticker and chart, closes the old
   WebSocket, and immediately refreshes ticker, chart, and stream data for the new pair.
4. `refreshTicker()` and `refreshChart()` capture the active symbol before requesting
   data and discard responses if the user switched markets in the meantime.
5. REST sources are tried in this order:
   1. `https://api.binance.com`
   2. `https://data-api.binance.vision`
6. WebSocket URL bases:
   - `wss://stream.binance.com:9443/ws`
   - `wss://data-stream.binance.vision/ws`
7. The active symbol is lowercased and appended as
   `/<symbol>@miniTicker`.
8. Rendered connection states are `connecting`, `live`, `polling` (`REST`), and
   `offline`.

Polling intervals:

- Ticker: 12 seconds.
- Chart: 60 seconds.
- WebSocket reconnect: exponential backoff up to 30 seconds.

Do not start duplicate timers. Switching coins must reuse the existing polling timers.

## Coin selection and quick picks

The native right-click menu begins with **Coin**:

```text
Coin
  Showing <BASE> / USDT
  Quick picks
    <favorite coins>
  Search coins...
```

`Search coins...` sends `window:request-coin-picker` to the renderer. The renderer shows
an in-window searchable list because native Electron menus cannot contain a search field.

The titlebar heart button calls `coin:toggle-favorite` for the active symbol. Favorites
appear both as chips inside the coin picker and as entries in the native **Quick picks**
submenu. The active market itself does not need to be favorited.

The titlebar padlock calls `window:toggle-window-lock`. While `lockWindow` is true, both
effective locks are forced on. The underlying `lockPosition` and `lockSize` values remain
unchanged, so opening the padlock restores their previous configuration. **Lock position**
and **Lock size** in the native menu are disabled while the master padlock is active.

## Mini mode

The full titlebar minimize button calls `window:set-mini-mode` with `true`. Mini mode uses
its saved width and height, falling back to the current full width and compact default
height, with a single row containing the coin badge, current price, live state, master
lock, maximize button, pin button, and close button. The maximize button sets mini mode
back to `false`. Pin and minimize/maximize use shared action sizes, gaps, and right-side
slots in both modes.

The `.mini-asset` wrapper contains the coin badge and price. It is `no-drag` so right-click
can reach the native settings menu. Left pointer movement is translated into validated
`window:move` IPC calls, preserving titlebar-style dragging when position locking is off.

Mini typography uses fixed responsive breakpoints tied to mini width and height. The price,
coin badge, live indicator, gaps, and padding grow at larger mini dimensions without
changing the right-aligned action slots.

`miniMode` is persisted. `windowSize` stores full-mode dimensions and `miniWindowSize`
stores mini-mode dimensions. When **Lock size** is off, the mini window uses the same
custom resize path as full mode. Returning to full mode restores and, when necessary,
clamps the saved full bounds into the display work area. Never overwrite one mode's saved
size with the other mode's bounds.

## Appearance state

CSS variables applied by `applyAppearanceSettings()`:

- `--background-rgba`
- `--background-opacity`
- `--line` and `--line-soft`
- `--window-border`
- `--positive-bg` and `--negative-bg`
- `--change-positive-border` and `--change-negative-border`
- `--chart-positive` and `--chart-negative`
- `--ui-text-color`
- `--outline-color`
- `--text-outline-width`

`priceChangeColor` accepts `green-red` or `red-blue`. These values control the
percentage badge background, its matching border, and the chart line/fill colors. The
user text color and connection indicator colors stay intact.

Opacity presets are `1`, `0.85`, `0.7`, `0.5`, `0.3`, `0.15`, and `0`.
Background opacity applies to:

- the main and mini background
- the window border and shadow
- separators and generic UI borders
- chart grid lines

Text outline color deliberately remains fully opaque. The live status pill and the lock,
minimize/maximize, pin, and close controls use fixed opaque `#17171b` backgrounds so they
remain legible even at zero layout opacity.

Text hierarchy:

- `--text` equals the selected text color.
- `--muted` uses the selected text color at 56% alpha.
- `--muted-bright` uses the selected text color at 76% alpha.

The text-stroke selector targets text elements only. Add new text selectors to that group
near the top of `src/styles.css`.

## Native context menu

The menu is created in `main.js` by `createContextMenu()` and shown on the renderer's
`context-menu` event.

```text
Coin
Layout
  Opacity
    100 / 85 / 70 / 50 / 30 / 15 / 0 percent
  Background color
  Price change color
    Green / Red
    Red / Blue
  Lock position
  Lock size
Text
  Text color
  Outline color
  Outline size
Always on top
Close
```

The titlebar is a drag region. Ticker content and dialogs receive the renderer
context-menu event. The mini coin badge and price are a custom no-drag surface: right
click sends `window:show-context-menu`, while left drag sends validated `window:move`
updates.

When **Lock position** is enabled, `setMovable(false)` is applied and the titlebar loses
its drag region. North and west resize handles are also hidden so resizing cannot change
the saved top-left position. East, south, and southeast resizing remain available.

Do not put `-webkit-app-region: no-drag` on the full-window `.resize-handles` overlay.
Only individual `.resize-handle` elements may disable dragging; otherwise the overlay
cancels the titlebar drag region while **Lock size** is off.

## IPC contract

Renderer to main:

- `window:close`
- `window:set-color` with `{ target, color }`
- `window:get-state` (invoke)
- `window:toggle-pin` (invoke)
- `window:toggle-window-lock` (invoke)
- `window:set-mini-mode` (invoke, boolean)
- `window:get-bounds` (invoke)
- `window:resize` with `{ x, y, width, height }`
- `window:move` with `{ x, y }`
- `window:show-context-menu`
- `coin:select` (invoke, symbol)
- `coin:toggle-favorite` (invoke, symbol)
- `coins:get-cached` (invoke)
- `coins:save` (invoke, normalized coin list)

Main to renderer:

- `window:appearance-changed`
- `window:request-color-picker`
- `window:coin-changed`
- `window:request-coin-picker`
- `window:position-lock-changed`
- `window:size-lock-changed`
- `window:window-lock-changed`
- `window:mini-mode-changed`

Validate all renderer-provided symbols, colors, and catalog records in the main process.
Preserve this boundary when adding features.

## Color picker

The custom picker is an in-window modal with a preview, editable HEX value, and Hue,
Saturation, and Lightness sliders. Do not replace it with a programmatic click on a
native `<input type="color">`; that approach failed in this Electron environment because
the native menu click does not provide a usable renderer user gesture.

`Esc` closes the coin picker first, then the color picker, then the app.

## Market rendering

- Ticker requests use `lastPrice`, `openPrice`, `priceChangePercent`, `highPrice`,
  `lowPrice`, `volume`, `quoteVolume`, and `closeTime`.
- WebSocket messages use `c`, `o`, `h`, `l`, `v`, `q`, and `E`.
- Charts use the last 60 one-minute close prices.
- Price decimals come from the selected market's `tickSize`, falling back to 2.
- Chart color follows the 24-hour direction through `--data-color`. It reads the
  palette-specific `--chart-positive` and `--chart-negative` variables and is
  independent of the selected text color.
- Price refresh animation changes opacity only and must not override the text color.

## Safe change recipes

### Add a preset color

1. Add `{ label, value: "#rrggbb" }` to the relevant array in `main.js`.
2. Keep lowercase hex values.
3. Run tests and inspect the context menu.

### Add a persisted preference

1. Add the default and validation rule in `src/lib/settings.js`.
2. Add state in `main.js` and include it in the relevant state payload.
3. Save it in `saveSettings()` and restore it in `loadSettings()`.
4. Add the renderer-facing bridge method or event in `preload.js`.
5. Validate renderer input again in `main.js`.
6. Add tests for invalid, partially valid, and valid values.

### Change polling or reconnection behavior

Edit constants at the top of `src/renderer.js`:

- `POLL_INTERVAL_MS`
- `CHART_INTERVAL_MS`
- `MAX_RECONNECT_DELAY_MS`

Check symbol identity after asynchronous requests so stale responses cannot replace the
active market.

## Verification checklist

1. `npm test` must pass.
2. Launch with `npm start` and confirm BTC/USDT loads by default.
3. Confirm startup creates or refreshes `.local/coins.json`.
4. Right-click, open **Coin**, and verify quick picks and search.
5. Search by base symbol and full pair, then switch markets.
6. Confirm the titlebar, price, chart, statistics, aria labels, REST requests, and
   WebSocket all switch to the selected symbol.
7. Use the heart button and verify the chip and native quick-pick entry update.
8. Restart and confirm the selected coin and favorites are restored.
9. Verify background, text, outline, opacity, pin, window position, and single-instance
   behavior still work.
10. Confirm **Lock size** is enabled by default and that the window cannot be resized.
11. Disable **Lock size**, resize to both the minimum and a larger size, and confirm the
    text, statistics, and chart adapt without clipping.
12. Enable **Lock position**, confirm the titlebar no longer moves the window, and confirm
    only position-preserving resize directions remain available.
13. Restart and confirm the size, position, and lock states are restored.
14. Toggle the titlebar padlock and confirm both position and size lock, then open it and
    confirm the individual lock menu settings are restored.
15. Enter mini mode and confirm the requested compact control order and live price.
16. Disable **Lock size**, resize mini mode, and confirm its dimensions persist separately.
17. Verify pin and minimize/maximize occupy the same right-side positions in both modes.
18. Right-click the mini badge and price, confirm the settings menu opens, and confirm
    left-drag still moves the window when unlocked.
19. Enlarge mini mode and confirm the coin badge, price, and live indicator scale up.
20. Return to full mode and confirm the previous full size is restored.
21. Set opacity to `0%` and confirm layout outlines fade while text outline, live status,
    and control backgrounds remain opaque.
22. Run `npm audit` and confirm it reports no vulnerabilities.
23. Run `npm run build:win` and confirm both x64 `.exe` artifacts are created.
24. Clear `ELECTRON_RUN_AS_NODE`, launch the portable executable, and confirm a working
    `Floating Crypto` window appears.
25. Confirm the packaged build creates `settings.json` and `coins.json` under
    `app.getPath("userData")`.
26. Capture the window with `scripts/capture-window.ps1`.

## Cautions

- The minimum full-window size is `320 x 240`; mini mode has a minimum height of `58`.
  Responsive CSS must keep controls usable at both minimums and let the chart fill
  additional full-mode height.
- Binance availability varies by network and region; retain both REST and WebSocket
  alternatives.
- Windows release artifacts are unsigned. Do not claim code signing is configured.
- `ELECTRON_RUN_AS_NODE=1` can make Electron start as Node. Clear it before launching if
  `ipcMain` is unavailable.
