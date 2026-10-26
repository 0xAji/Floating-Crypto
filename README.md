# Floating Crypto

Floating Crypto is a compact always-on-top Electron widget for monitoring Binance
Spot markets quoted in USDT. It starts with BTC/USDT and supports searchable market
selection, quick picks, full and mini layouts, persistent window geometry, and
customizable appearance.

## Disclaimer

All source code in this repository was generated entirely by a large language model
(LLM) under human direction. Review and test the code before relying on it. See
[`DISCLAIMER.md`](DISCLAIMER.md) for the full disclaimer.

## Features

- Live prices over Binance WebSocket with REST polling fallback.
- 24-hour price statistics and a one-hour chart from one-minute candles.
- Searchable catalog of active Binance USDT spot markets.
- BTC/USDT selected by default on a fresh installation.
- Coin catalog fetched at startup and cached in `.local/coins.json`.
- Quick picks managed with the titlebar heart button.
- Full mode with price, chart, statistics, and appearance controls.
- Mini mode with coin badge, live price, live status, lock, maximize, pin, and close.
- Mini layout scaling for the coin badge, price, live status, and spacing.
- Shared pin and minimize/maximize placement across full and mini modes.
- Full and mini window dimensions saved independently.
- Lock position and lock size settings, plus a temporary master padlock.
- Window position restored when valid, or centered on first launch.
- Opacity presets from `100%` to `0%`.
- Layout borders, separators, chart grid lines, and window shadow follow opacity.
- Text outline remains fully opaque.
- Live status and window control backgrounds remain opaque.
- Price change color palettes for the percentage badge and chart.
- Custom HEX/HSL background, text, and text-outline colors.

## Requirements

- Node.js and npm.
- Windows 10/11 for the current window configuration.
- Network access to Binance market data endpoints.

No API key is required because the app only reads public market data.

## Windows Release

The current release is **v1.0.0**:

- [Windows installer](https://github.com/0xAji/Floating-Crypto/releases/download/v1.0.0/Floating-Crypto-Setup-1.0.0-x64.exe)
- [Windows portable](https://github.com/0xAji/Floating-Crypto/releases/download/v1.0.0/Floating-Crypto-Portable-1.0.0-x64.exe)
- [Release notes](https://github.com/0xAji/Floating-Crypto/releases/tag/v1.0.0)

The release targets Windows 10/11 x64. The executables are currently unsigned, so
Windows SmartScreen may display a warning.

## Running From Source

```powershell
npm install
npm start
```

If Electron cannot start because `ipcMain` is unavailable, remove the
`ELECTRON_RUN_AS_NODE` environment variable before starting the app.

## Windows Build

```powershell
npm run build:win
```

This uses Electron 43 and `electron-builder` to create a 64-bit NSIS installer and
portable executable in `dist/`.

## Usage

- Drag full mode by the titlebar.
- Drag mini mode by the coin badge or price when position locking is off.
- Right-click the data area, or the mini coin badge and price, to open settings.
- Select **Coin** to choose a quick pick or search all available markets.
- Click the heart to add or remove the current market from quick picks.
- Use the padlock to temporarily lock both position and size.
- Use the minimize or maximize control to switch between full and mini modes.
- Use the pin control to toggle always-on-top behavior.
- Use **Layout** and **Text** for opacity, colors, outlines, and window locks.
- Use the close control to exit the app.

## Appearance

Background opacity presets are `100%`, `85%`, `70%`, `50%`, `30%`, `15%`, and `0%`.
The selected opacity applies to the background, window border and shadow, separators,
chart grid lines, and other layout outlines. Text outline color stays at full opacity.
The live status pill and lock, minimize/maximize, pin, and close controls use fixed
opaque backgrounds so they remain legible at any opacity.

Price change color options:

- **Green / Red** uses green for gains and red for losses.
- **Red / Blue** uses red for gains and blue for losses.

## Persistence

In development, `.local/settings.json` stores:

- pin state
- full or mini mode
- master, position, and size lock states
- window position
- full and mini window dimensions
- selected market and quick picks
- appearance settings

In development, `.local/coins.json` stores the latest validated Binance USDT market
catalog. Installed and portable builds store the same files in Electron's writable
user-data directory. These runtime files are generated automatically and excluded from
version control.

The app restores a saved position if enough of the window remains visible on a connected
display. Otherwise, the window opens centered in the primary display work area.

## Data Sources

REST requests are tried in this order:

1. `https://api.binance.com`
2. `https://data-api.binance.vision`

Endpoints:

- `/api/v3/exchangeInfo`
- `/api/v3/ticker/24hr?symbol=<symbol>`
- `/api/v3/klines?symbol=<symbol>&interval=1m&limit=60`

WebSocket sources:

```text
wss://stream.binance.com:9443/ws/<symbol>@miniTicker
wss://data-stream.binance.vision/ws/<symbol>@miniTicker
```

The active symbol is lowercased in WebSocket URLs. Reconnection uses exponential backoff
up to 30 seconds. If REST succeeds while WebSocket is unavailable, the status shows
`REST`.

## Testing

```powershell
npm test
```

The Node.js suite covers market normalization, coin catalog filtering, price precision,
chart paths, color conversion, settings validation, lock-state behavior, and centered
window positioning.

Visual smoke test while the app is running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\capture-window.ps1
```

The screenshot is written to `.artifacts/app-screenshot.png`.

## Project Structure

```text
main.js                 Electron window, menu, geometry, persistence, and IPC
preload.js              Restricted renderer bridge
.local/                 Generated user settings and coin cache, ignored by Git
.artifacts/             Generated screenshots and test artifacts, ignored by Git
dist/                   Generated Windows packages, ignored by Git
.gitattributes          Git line-ending policy
DISCLAIMER.md           LLM-generated-code and no-warranty disclaimer
package.json            Scripts, dependencies, and Windows build configuration
src/index.html          Full and mini layouts, coin picker, and color picker
src/styles.css          Responsive layout, modes, transparency, and controls
src/renderer.js         Market data, UI rendering, search, dragging, and resizing
src/lib/market.js       Binance ticker normalization and chart helpers
src/lib/coins.js        Market catalog normalization, search, and price formatting
src/lib/color.js        HEX/RGB/HSL conversion
src/lib/settings.js     Settings defaults and validation
tests/                  Node.js unit tests
scripts/                Windows visual verification
```

## Limitations

- Full mode has a minimum size of `320 x 240`.
- Mini mode has a minimum height of `58` pixels.
- Only Binance Spot markets quoted in USDT are supported.
- Market availability depends on network access and regional restrictions.
- Prices are for monitoring only and are not investment advice.

Technical contributor guidance is available in [`agent.md`](agent.md).
