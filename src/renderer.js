const {
  buildChartPath,
  formatCompact,
  formatPercent,
  formatTime,
  getTone,
  normalizeKlines,
  normalizeMiniTicker,
  normalizeTicker,
} = window.EthMarket;
const {
  filterCoins,
  formatCoinPrice,
  getBaseAsset,
  normalizeCoinCatalog,
  normalizeCoinSymbol,
} = window.CoinTools;
const { hexToHsl, hslToHex } = window.ColorTools;

const REST_BASES = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
];
const STREAM_BASES = [
  "wss://stream.binance.com:9443/ws",
  "wss://data-stream.binance.vision/ws",
];
const POLL_INTERVAL_MS = 12_000;
const CHART_INTERVAL_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MIN_WINDOW_WIDTH = 320;
const MIN_WINDOW_HEIGHT = 240;
const MINI_WINDOW_HEIGHT = 58;
const MAX_WINDOW_WIDTH = 4096;
const MAX_WINDOW_HEIGHT = 2160;

const elements = {
  assetName: document.querySelector("#assetName"),
  change: document.querySelector("#change"),
  chart: document.querySelector("#chart"),
  chartArea: document.querySelector("#chartArea"),
  chartLine: document.querySelector("#chartLine"),
  closeButton: document.querySelector("#closeButton"),
  coinDialog: document.querySelector("#coinDialog"),
  coinDialogBackdrop: document.querySelector("#coinDialogBackdrop"),
  coinDialogClose: document.querySelector("#coinDialogClose"),
  coinList: document.querySelector("#coinList"),
  coinListStatus: document.querySelector("#coinListStatus"),
  coinMark: document.querySelector("#coinMark"),
  coinSearchInput: document.querySelector("#coinSearchInput"),
  colorDialog: document.querySelector("#colorDialog"),
  colorDialogBackdrop: document.querySelector("#colorDialogBackdrop"),
  colorDialogClose: document.querySelector("#colorDialogClose"),
  colorDialogTitle: document.querySelector("#colorDialogTitle"),
  colorHexInput: document.querySelector("#colorHexInput"),
  colorPreview: document.querySelector("#colorPreview"),
  favoriteButton: document.querySelector("#favoriteButton"),
  feedLabel: document.querySelector("#feedLabel"),
  feedState: document.querySelector("#feedState"),
  high: document.querySelector("#high"),
  hueSlider: document.querySelector("#hueSlider"),
  hueValue: document.querySelector("#hueValue"),
  lightnessSlider: document.querySelector("#lightnessSlider"),
  lightnessValue: document.querySelector("#lightnessValue"),
  low: document.querySelector("#low"),
  miniCloseButton: document.querySelector("#miniCloseButton"),
  miniAsset: document.querySelector("#miniAsset"),
  miniCoinMark: document.querySelector("#miniCoinMark"),
  miniFeedLabel: document.querySelector("#miniFeedLabel"),
  miniFeedState: document.querySelector("#miniFeedState"),
  miniMaximizeButton: document.querySelector("#miniMaximizeButton"),
  miniModeButton: document.querySelector("#miniModeButton"),
  miniPinButton: document.querySelector("#miniPinButton"),
  miniPrice: document.querySelector("#miniPrice"),
  miniWindowLockButton: document.querySelector("#miniWindowLockButton"),
  offlineBanner: document.querySelector("#offlineBanner"),
  pairLabel: document.querySelector("#pairLabel"),
  pinButton: document.querySelector("#pinButton"),
  price: document.querySelector("#price"),
  quickCoinList: document.querySelector("#quickCoinList"),
  resizeHandles: [...document.querySelectorAll(".resize-handle")],
  saturationSlider: document.querySelector("#saturationSlider"),
  saturationValue: document.querySelector("#saturationValue"),
  tickerWindow: document.querySelector(".ticker-window"),
  updated: document.querySelector("#updated"),
  volume: document.querySelector("#volume"),
  windowLockButton: document.querySelector("#windowLockButton"),
};

const state = {
  ticker: null,
  chartValues: [],
  selectedCoin: null,
  favoriteCoins: [],
  coinCatalog: [],
  coinCatalogStatus: "loading",
  stream: null,
  streamAttempt: 0,
  reconnectTimer: null,
  pollTimer: null,
  chartTimer: null,
  priceAnimationTimer: null,
  lastPrice: null,
  miniMode: false,
  positionLocked: false,
  sizeLocked: true,
  windowLocked: false,
  colorPickerTarget: null,
  pickerColor: "#131316",
  pickerHsl: { h: 0, s: 0, l: 0 },
  appearance: {
    backgroundColor: "#131316",
    backgroundOpacity: 1,
    priceChangeColor: "green-red",
    textColor: "#f5f3ee",
    outlineColor: "#000000",
    textOutlineWidth: 1,
  },
};

function setConnectionState(connectionState, label) {
  elements.feedState.dataset.state = connectionState;
  elements.feedLabel.textContent = label;
  elements.miniFeedState.dataset.state = connectionState;
  elements.miniFeedLabel.textContent = label;
  elements.offlineBanner.hidden = connectionState !== "offline";
}

function getSelectedCoin() {
  return (
    state.coinCatalog.find((coin) => coin.symbol === state.selectedCoin) ?? {
      symbol: state.selectedCoin,
      baseAsset: getBaseAsset(state.selectedCoin),
      quoteAsset: "USDT",
      pricePrecision: 2,
    }
  );
}

function isFavorite(symbol = state.selectedCoin) {
  return state.favoriteCoins.includes(symbol);
}

function renderCoinIdentity() {
  const coin = getSelectedCoin();
  const shortMark =
    coin.baseAsset.length <= 4 ? coin.baseAsset : coin.baseAsset.slice(0, 4);

  elements.assetName.textContent = coin.baseAsset;
  elements.pairLabel.textContent = `${coin.baseAsset} / ${coin.quoteAsset} \u00b7 Binance`;
  elements.coinMark.textContent = shortMark;
  elements.miniCoinMark.textContent = shortMark;
  elements.favoriteButton.setAttribute("aria-pressed", String(isFavorite()));
  const favoriteAction = isFavorite() ? "Remove" : "Add";
  const favoriteLabel = `${favoriteAction} ${coin.baseAsset} ${
    isFavorite() ? "from" : "to"
  } quick picks`;
  elements.favoriteButton.title = favoriteLabel;
  elements.favoriteButton.setAttribute("aria-label", favoriteLabel);
}

function resetMarketView() {
  const coin = getSelectedCoin();
  const label = coin.baseAsset || "coin";

  state.ticker = null;
  state.chartValues = [];
  state.lastPrice = null;
  elements.price.textContent = "$--";
  elements.miniPrice.textContent = "$--";
  elements.change.textContent = "--";
  elements.change.removeAttribute("data-tone");
  elements.high.textContent = "$--";
  elements.low.textContent = "$--";
  elements.volume.textContent = "--";
  elements.updated.textContent = `Loading ${label} / USDT`;
  elements.chartLine.removeAttribute("d");
  elements.chartArea.removeAttribute("d");
  elements.chart.setAttribute(
    "aria-label",
    `${label} price movement over the last hour`,
  );
  setConnectionState("connecting", "Connecting");
}

function updatePriceAnimation(price) {
  if (state.lastPrice === null || state.lastPrice === price) {
    state.lastPrice = price;
    return;
  }

  const direction = price > state.lastPrice ? "positive" : "negative";
  for (const priceElement of [elements.price, elements.miniPrice]) {
    priceElement.style.setProperty("--data-color", `var(--${direction})`);
    priceElement.classList.remove("is-updating");
    void priceElement.offsetWidth;
    priceElement.classList.add("is-updating");
  }
  window.clearTimeout(state.priceAnimationTimer);
  state.priceAnimationTimer = window.setTimeout(() => {
    for (const priceElement of [elements.price, elements.miniPrice]) {
      priceElement.classList.remove("is-updating");
      priceElement.style.removeProperty("--data-color");
    }
  }, 420);
  state.lastPrice = price;
}

function renderTicker(ticker) {
  state.ticker = ticker;
  const coin = getSelectedCoin();
  const tone = getTone(ticker.changePercent);

  const dataColor =
    tone === "neutral" ? "var(--muted-bright)" : `var(--chart-${tone})`;
  document.documentElement.style.setProperty("--data-color", dataColor);

  const formattedPrice = formatCoinPrice(
    ticker.price,
    coin.pricePrecision,
  );
  elements.price.textContent = formattedPrice;
  elements.miniPrice.textContent = formattedPrice;
  elements.change.textContent = formatPercent(ticker.changePercent);
  elements.change.dataset.tone = tone;
  elements.high.textContent = formatCoinPrice(
    ticker.high,
    coin.pricePrecision,
  );
  elements.low.textContent = formatCoinPrice(ticker.low, coin.pricePrecision);
  elements.volume.textContent = `$${formatCompact(ticker.quoteVolume)}`;
  elements.updated.textContent = `Updated ${formatTime(ticker.time)}`;
  elements.chart.setAttribute(
    "aria-label",
    `${coin.baseAsset} price ${formatCoinPrice(
      ticker.price,
      coin.pricePrecision,
    )}, 24-hour change ${formatPercent(ticker.changePercent)}`,
  );
  updatePriceAnimation(ticker.price);
}

function renderChart(values) {
  state.chartValues = values;
  const path = buildChartPath(values, 320, 62, 3);

  if (!path) {
    elements.chartLine.removeAttribute("d");
    elements.chartArea.removeAttribute("d");
    return;
  }

  elements.chartLine.setAttribute("d", path.line);
  elements.chartArea.setAttribute("d", path.area);
}

async function requestFromBinance(path) {
  let lastError = null;

  for (const base of REST_BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new Error(`Binance responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Binance is unavailable");
}

async function refreshTicker() {
  const symbol = state.selectedCoin;

  if (!symbol) {
    return;
  }

  try {
    const payload = await requestFromBinance(
      `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    );

    if (state.selectedCoin !== symbol) {
      return;
    }

    renderTicker(normalizeTicker(payload));

    if (state.stream?.readyState !== WebSocket.OPEN) {
      setConnectionState("polling", "REST");
    }
  } catch (error) {
    console.error(`Unable to refresh ${symbol} ticker:`, error);

    if (
      state.selectedCoin === symbol &&
      (!state.ticker || state.stream?.readyState !== WebSocket.OPEN)
    ) {
      setConnectionState("offline", "Offline");
      elements.updated.textContent = "Binance is unreachable";
    }
  }
}

async function refreshChart() {
  const symbol = state.selectedCoin;

  if (!symbol) {
    return;
  }

  try {
    const payload = await requestFromBinance(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=60`,
    );

    if (state.selectedCoin === symbol) {
      renderChart(normalizeKlines(payload));
    }
  } catch (error) {
    console.error(`Unable to refresh ${symbol} chart:`, error);
  }
}

function renderQuickCoins() {
  const fragment = document.createDocumentFragment();

  for (const symbol of state.favoriteCoins) {
    const button = document.createElement("button");
    button.className = "quick-coin";
    button.type = "button";
    button.textContent = getBaseAsset(symbol);
    button.title = `${getBaseAsset(symbol)} / USDT`;
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-selected",
      String(symbol === state.selectedCoin),
    );
    button.addEventListener("click", () => chooseCoin(symbol));
    fragment.append(button);
  }

  elements.quickCoinList.replaceChildren(fragment);
}

function renderCoinList() {
  const query = elements.coinSearchInput.value;
  const matches = filterCoins(state.coinCatalog, query);
  const fragment = document.createDocumentFragment();

  for (const coin of matches) {
    const button = document.createElement("button");
    const symbol = document.createElement("span");
    const pair = document.createElement("span");

    button.className = "coin-option";
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-selected",
      String(coin.symbol === state.selectedCoin),
    );
    button.dataset.symbol = coin.symbol;
    symbol.className = "coin-option-symbol";
    symbol.textContent = coin.baseAsset;
    pair.className = "coin-option-pair";
    pair.textContent = `${coin.baseAsset} / ${coin.quoteAsset}`;
    button.append(symbol, pair);
    button.addEventListener("click", () => chooseCoin(coin.symbol));
    fragment.append(button);
  }

  elements.coinList.replaceChildren(fragment);

  if (matches.length > 0) {
    elements.coinListStatus.hidden = true;
    return;
  }

  let status = "No coins found";

  if (state.coinCatalog.length === 0 && state.coinCatalogStatus === "loading") {
    status = "Loading markets...";
  } else if (
    state.coinCatalog.length === 0 &&
    state.coinCatalogStatus === "error"
  ) {
    status = "Coin list unavailable";
  } else if (query.trim()) {
    status = `No coins match "${query.trim()}"`;
  }

  elements.coinListStatus.textContent = status;
  elements.coinListStatus.hidden = false;
}

function renderCoinPicker() {
  renderQuickCoins();
  renderCoinList();
}

function openCoinPicker() {
  elements.coinSearchInput.value = "";
  renderCoinPicker();
  elements.coinDialog.hidden = false;
  requestAnimationFrame(() => elements.coinSearchInput.focus());
}

function closeCoinPicker() {
  elements.coinDialog.hidden = true;
}

async function chooseCoin(symbol) {
  closeCoinPicker();

  try {
    const coinState = await window.desktopWindow.selectCoin(symbol);
    applyCoinState(coinState);
  } catch (error) {
    console.error("Unable to select coin:", error);
  }
}

async function toggleFavorite() {
  if (!state.selectedCoin) {
    return;
  }

  try {
    const coinState = await window.desktopWindow.toggleFavorite(
      state.selectedCoin,
    );
    applyCoinState(coinState);
    renderCoinPicker();
  } catch (error) {
    console.error("Unable to update quick picks:", error);
  }
}

function normalizeCoinState(coinState) {
  const selected = normalizeCoinSymbol(coinState?.selectedCoin);
  const favorites = Array.isArray(coinState?.favoriteCoins)
    ? coinState.favoriteCoins
        .map((symbol) => normalizeCoinSymbol(symbol))
        .filter((symbol) => symbol?.endsWith("USDT"))
    : [];

  return {
    selectedCoin:
      selected?.endsWith("USDT") && selected.length > 4 ? selected : null,
    favoriteCoins: [...new Set(favorites)],
  };
}

function applyCoinState(coinState) {
  const next = normalizeCoinState(coinState);

  if (!next.selectedCoin) {
    return;
  }

  const coinChanged = next.selectedCoin !== state.selectedCoin;
  state.selectedCoin = next.selectedCoin;
  state.favoriteCoins = next.favoriteCoins;
  renderCoinIdentity();
  renderCoinPicker();

  if (!coinChanged) {
    return;
  }

  window.clearTimeout(state.reconnectTimer);
  const previousStream = state.stream;
  state.stream = null;
  previousStream?.close();
  state.streamAttempt = 0;
  resetMarketView();
  refreshTicker();
  refreshChart();
  connectStream();
}

async function loadCachedCoinCatalog() {
  try {
    const cached = await window.desktopWindow.getCachedCoinCatalog();

    if (Array.isArray(cached) && cached.length > 0) {
      state.coinCatalog = cached;
      state.coinCatalogStatus = "cached";
      renderCoinPicker();
    }
  } catch (error) {
    console.error("Unable to read cached coin catalog:", error);
  }
}

async function refreshCoinCatalog() {
  state.coinCatalogStatus = "loading";

  try {
    const payload = await requestFromBinance("/api/v3/exchangeInfo");
    const coins = normalizeCoinCatalog(payload);

    if (coins.length === 0) {
      throw new Error("Binance returned an empty coin catalog");
    }

    state.coinCatalog = coins;
    state.coinCatalogStatus = "ready";
    renderCoinPicker();
    await window.desktopWindow.saveCoinCatalog(coins);
  } catch (error) {
    console.error("Unable to refresh coin catalog:", error);
    state.coinCatalogStatus =
      state.coinCatalog.length > 0 ? "cached" : "error";
    renderCoinPicker();
  }
}

function scheduleReconnect() {
  window.clearTimeout(state.reconnectTimer);
  const delay = Math.min(
    1_500 * 2 ** state.streamAttempt,
    MAX_RECONNECT_DELAY_MS,
  );
  state.streamAttempt += 1;

  state.reconnectTimer = window.setTimeout(connectStream, delay);
}

function connectStream() {
  const symbol = state.selectedCoin;

  if (!symbol) {
    return;
  }

  window.clearTimeout(state.reconnectTimer);
  state.stream?.close();
  setConnectionState("connecting", "Connecting");

  const streamBase =
    STREAM_BASES[state.streamAttempt % STREAM_BASES.length];
  const stream = new WebSocket(
    `${streamBase}/${symbol.toLowerCase()}@miniTicker`,
  );
  state.stream = stream;

  stream.addEventListener("open", () => {
    if (state.stream === stream) {
      setConnectionState("live", "Live");
    }
  });

  stream.addEventListener("message", (event) => {
    if (state.stream !== stream || state.selectedCoin !== symbol) {
      return;
    }

    try {
      const payload = JSON.parse(event.data);
      const ticker = normalizeMiniTicker(payload, state.ticker ?? {});

      if (!ticker.price) {
        return;
      }

      state.streamAttempt = 0;
      renderTicker(ticker);
      setConnectionState("live", "Live");
    } catch (error) {
      console.error("Invalid Binance stream message:", error);
    }
  });

  stream.addEventListener("error", () => {
    stream.close();
  });

  stream.addEventListener("close", () => {
    if (state.stream !== stream) {
      return;
    }

    setConnectionState(
      state.ticker ? "polling" : "connecting",
      state.ticker ? "REST" : "Connecting",
    );
    scheduleReconnect();
  });
}

function applyPinnedState(pinned) {
  for (const button of [elements.pinButton, elements.miniPinButton]) {
    button.setAttribute("aria-pressed", String(pinned));
    button.title = pinned ? "Unpin from top" : "Always on top";
    button.setAttribute("aria-label", button.title);
  }
}

function applyWindowLock(value) {
  const locked =
    typeof value === "object" && value !== null ? value.locked : value;

  if (typeof locked !== "boolean") {
    return;
  }

  state.windowLocked = locked;
  const label = locked
    ? "Unlock position and size"
    : "Lock position and size";
  for (const button of [
    elements.windowLockButton,
    elements.miniWindowLockButton,
  ]) {
    button.setAttribute("aria-pressed", String(locked));
    button.title = label;
    button.setAttribute("aria-label", label);
  }
}

async function setPinnedState() {
  try {
    const { pinned } = await window.desktopWindow.getState();
    applyPinnedState(pinned);
  } catch (error) {
    console.error("Unable to read window state:", error);
  }
}

async function togglePin() {
  try {
    const { pinned } = await window.desktopWindow.togglePin();
    applyPinnedState(pinned);
  } catch (error) {
    console.error("Unable to toggle pin:", error);
  }
}

async function toggleWindowLock() {
  try {
    const { locked } = await window.desktopWindow.toggleWindowLock();
    applyWindowLock(locked);
  } catch (error) {
    console.error("Unable to toggle window lock:", error);
  }
}

async function setMiniMode(miniMode) {
  try {
    const result = await window.desktopWindow.setMiniMode(miniMode);
    applyMiniMode(result.miniMode);
  } catch (error) {
    console.error("Unable to change window mode:", error);
  }
}

function applyMiniMode(value) {
  const miniMode =
    typeof value === "object" && value !== null ? value.miniMode : value;

  if (typeof miniMode !== "boolean") {
    return;
  }

  state.miniMode = miniMode;
  elements.tickerWindow.dataset.mode = miniMode ? "mini" : "full";
}

function renderPickerControls(color, hsl) {
  const hue = Math.round(hsl.h);
  const saturation = Math.round(hsl.s);
  const lightness = Math.round(hsl.l);

  state.pickerColor = color;
  state.pickerHsl = { h: hue, s: saturation, l: lightness };
  elements.colorPreview.style.backgroundColor = color;
  elements.hueSlider.value = String(hue);
  elements.saturationSlider.value = String(saturation);
  elements.lightnessSlider.value = String(lightness);
  elements.hueValue.textContent = `${hue}\u00b0`;
  elements.saturationValue.textContent = `${saturation}%`;
  elements.lightnessValue.textContent = `${lightness}%`;
  elements.saturationSlider.style.background = `linear-gradient(to right, hsl(${hue} 0% ${lightness}%), hsl(${hue} 100% ${lightness}%))`;
  elements.lightnessSlider.style.background = `linear-gradient(to right, #000000, hsl(${hue} ${saturation}% 50%), #ffffff)`;
}

function emitPickerColor() {
  if (state.colorPickerTarget) {
    window.desktopWindow.setColor(state.colorPickerTarget, state.pickerColor);
  }
}

function handlePickerSliderInput() {
  const hsl = {
    h: Number(elements.hueSlider.value),
    s: Number(elements.saturationSlider.value),
    l: Number(elements.lightnessSlider.value),
  };
  const color = hslToHex(hsl.h, hsl.s, hsl.l);

  renderPickerControls(color, hsl);
  elements.colorHexInput.value = color;
  emitPickerColor();
}

function handleHexInput(event) {
  const normalized = `#${event.target.value.trim().replace(/^#/, "")}`;

  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    return;
  }

  const color = normalized.toLowerCase();
  renderPickerControls(color, hexToHsl(color));
  emitPickerColor();
}

function applySizeLock(value) {
  const locked =
    typeof value === "object" && value !== null ? value.locked : value;

  if (typeof locked !== "boolean") {
    return;
  }

  state.sizeLocked = locked;
  elements.tickerWindow.dataset.sizeLocked = String(locked);
}

function applyPositionLock(value) {
  const locked =
    typeof value === "object" && value !== null ? value.locked : value;

  if (typeof locked !== "boolean") {
    return;
  }

  state.positionLocked = locked;
  elements.tickerWindow.dataset.positionLocked = String(locked);
}

async function beginResize(event) {
  if (state.sizeLocked || event.button !== 0) {
    return;
  }

  const handle = event.currentTarget;
  const direction = handle.dataset.resizeDirection;

  if (!direction) {
    return;
  }

  if (
    state.positionLocked &&
    (direction.includes("n") || direction.includes("w"))
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  let startBounds = null;
  let active = true;
  const startX = event.screenX;
  const startY = event.screenY;

  function finishResize() {
    if (!active) {
      return;
    }

    active = false;
    handle.removeEventListener("pointermove", handleResizeMove);
    handle.removeEventListener("pointerup", finishResize);
    handle.removeEventListener("pointercancel", finishResize);

    if (handle.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  }

  function handleResizeMove(moveEvent) {
    if (!active || !startBounds) {
      return;
    }

    const minimumHeight = state.miniMode
      ? MINI_WINDOW_HEIGHT
      : MIN_WINDOW_HEIGHT;
    const deltaX = moveEvent.screenX - startX;
    const deltaY = moveEvent.screenY - startY;
    let x = startBounds.x;
    let y = startBounds.y;
    let width = startBounds.width;
    let height = startBounds.height;

    if (direction.includes("e")) {
      width = Math.min(
        Math.max(startBounds.width + deltaX, MIN_WINDOW_WIDTH),
        MAX_WINDOW_WIDTH,
      );
    } else if (direction.includes("w")) {
      width = Math.min(
        Math.max(startBounds.width - deltaX, MIN_WINDOW_WIDTH),
        MAX_WINDOW_WIDTH,
      );
      x = startBounds.x + startBounds.width - width;
    }

    if (direction.includes("s")) {
      height = Math.min(
        Math.max(startBounds.height + deltaY, minimumHeight),
        MAX_WINDOW_HEIGHT,
      );
    } else if (direction.includes("n")) {
      height = Math.min(
        Math.max(startBounds.height - deltaY, minimumHeight),
        MAX_WINDOW_HEIGHT,
      );
      y = startBounds.y + startBounds.height - height;
    }

    window.desktopWindow.resizeWindow({ x, y, width, height });
  }

  handle.setPointerCapture?.(event.pointerId);
  handle.addEventListener("pointermove", handleResizeMove);
  handle.addEventListener("pointerup", finishResize);
  handle.addEventListener("pointercancel", finishResize);

  try {
    startBounds = await window.desktopWindow.getWindowBounds();
  } catch (error) {
    console.error("Unable to read window bounds:", error);
    finishResize();
  }
}

async function beginWindowDrag(event) {
  if (state.positionLocked || event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const handle = event.currentTarget;
  const startX = event.screenX;
  const startY = event.screenY;
  let startBounds = null;
  let active = true;

  function finishDrag() {
    if (!active) {
      return;
    }

    active = false;
    handle.removeEventListener("pointermove", moveWindow);
    handle.removeEventListener("pointerup", finishDrag);
    handle.removeEventListener("pointercancel", finishDrag);

    if (handle.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  }

  function moveWindow(moveEvent) {
    if (!active || !startBounds) {
      return;
    }

    window.desktopWindow.moveWindow({
      x: startBounds.x + moveEvent.screenX - startX,
      y: startBounds.y + moveEvent.screenY - startY,
    });
  }

  handle.setPointerCapture?.(event.pointerId);
  handle.addEventListener("pointermove", moveWindow);
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);

  try {
    startBounds = await window.desktopWindow.getWindowBounds();
  } catch (error) {
    console.error("Unable to read window bounds:", error);
    finishDrag();
  }
}

function bindEvents() {
  elements.pinButton.addEventListener("click", togglePin);
  elements.miniPinButton.addEventListener("click", togglePin);
  elements.favoriteButton.addEventListener("click", toggleFavorite);
  elements.windowLockButton.addEventListener("click", toggleWindowLock);
  elements.miniWindowLockButton.addEventListener("click", toggleWindowLock);
  elements.miniModeButton.addEventListener("click", () => setMiniMode(true));
  elements.miniMaximizeButton.addEventListener("click", () =>
    setMiniMode(false),
  );
  elements.miniCloseButton.addEventListener("click", () =>
    window.desktopWindow.close(),
  );
  elements.miniAsset.addEventListener("pointerdown", beginWindowDrag);
  elements.miniAsset.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.desktopWindow.showContextMenu();
  });
  elements.closeButton.addEventListener("click", () =>
    window.desktopWindow.close(),
  );
  elements.coinDialogClose.addEventListener("click", closeCoinPicker);
  elements.coinDialogBackdrop.addEventListener("click", closeCoinPicker);
  elements.coinSearchInput.addEventListener("input", renderCoinList);
  elements.coinSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      const firstOption = elements.coinList.querySelector(".coin-option");
      if (firstOption) {
        event.preventDefault();
        firstOption.focus();
      }
    }
  });
  for (const handle of elements.resizeHandles) {
    handle.addEventListener("pointerdown", beginResize);
  }
  for (const slider of [
    elements.hueSlider,
    elements.saturationSlider,
    elements.lightnessSlider,
  ]) {
    slider.addEventListener("input", handlePickerSliderInput);
  }
  elements.colorHexInput.addEventListener("input", handleHexInput);
  elements.colorHexInput.addEventListener("blur", () => {
    elements.colorHexInput.value = state.pickerColor;
  });
  elements.colorDialogClose.addEventListener("click", closeColorPicker);
  elements.colorDialogBackdrop.addEventListener("click", closeColorPicker);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.coinDialog.hidden) {
        closeCoinPicker();
      } else if (elements.colorDialog.hidden) {
        window.desktopWindow.close();
      } else {
        closeColorPicker();
      }
    }
  });
}

function hexToRgba(hex, opacity) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match) {
    return "rgb(19 19 22 / 1)";
  }

  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const alpha = Math.min(Math.max(opacity, 0), 1);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function applyAppearanceSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }

  const nextAppearance = { ...state.appearance };

  for (const key of ["backgroundColor", "textColor", "outlineColor"]) {
    if (
      typeof settings[key] === "string" &&
      /^#[0-9a-f]{6}$/i.test(settings[key])
    ) {
      nextAppearance[key] = settings[key].toLowerCase();
    }
  }

  if (Number.isFinite(settings.backgroundOpacity)) {
    nextAppearance.backgroundOpacity = settings.backgroundOpacity;
  }

  const priceChangeColor =
    settings.priceChangeColor ?? settings.priceChangeBackground;

  if (priceChangeColor === "green-red" || priceChangeColor === "red-blue") {
    nextAppearance.priceChangeColor = priceChangeColor;
  }

  if (Number.isFinite(settings.textOutlineWidth)) {
    nextAppearance.textOutlineWidth = settings.textOutlineWidth;
  }

  state.appearance = nextAppearance;
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty(
    "--background-rgba",
    hexToRgba(nextAppearance.backgroundColor, nextAppearance.backgroundOpacity),
  );
  rootStyle.setProperty(
    "--background-opacity",
    String(nextAppearance.backgroundOpacity),
  );
  rootStyle.setProperty(
    "--line",
    hexToRgba("#2b2b31", nextAppearance.backgroundOpacity),
  );
  rootStyle.setProperty(
    "--line-soft",
    hexToRgba("#242429", nextAppearance.backgroundOpacity),
  );
  rootStyle.setProperty(
    "--window-border",
    hexToRgba("#34343b", nextAppearance.backgroundOpacity),
  );
  const priceChangePalette =
    nextAppearance.priceChangeColor === "red-blue"
      ? {
          positiveBackground: "#332022",
          positiveBorder: "rgb(255 124 124 / 22%)",
          positiveChart: "#ff7c7c",
          negativeBackground: "#172a38",
          negativeBorder: "rgb(98 212 208 / 22%)",
          negativeChart: "#62d4d0",
        }
      : {
          positiveBackground: "#1d2b1c",
          positiveBorder: "rgb(147 216 116 / 19%)",
          positiveChart: "#93d874",
          negativeBackground: "#312020",
          negativeBorder: "rgb(255 124 124 / 19%)",
          negativeChart: "#ff7c7c",
        };
  rootStyle.setProperty(
    "--positive-bg",
    priceChangePalette.positiveBackground,
  );
  rootStyle.setProperty(
    "--change-positive-border",
    priceChangePalette.positiveBorder,
  );
  rootStyle.setProperty(
    "--negative-bg",
    priceChangePalette.negativeBackground,
  );
  rootStyle.setProperty(
    "--change-negative-border",
    priceChangePalette.negativeBorder,
  );
  rootStyle.setProperty("--chart-positive", priceChangePalette.positiveChart);
  rootStyle.setProperty("--chart-negative", priceChangePalette.negativeChart);
  rootStyle.setProperty("--ui-text-color", nextAppearance.textColor);
  rootStyle.setProperty("--outline-color", nextAppearance.outlineColor);
  rootStyle.setProperty(
    "--text-outline-width",
    `${nextAppearance.textOutlineWidth}px`,
  );
}

function openColorPicker({ target, currentColor }) {
  const targetProperties = {
    background: "backgroundColor",
    text: "textColor",
    outline: "outlineColor",
  };
  const targetLabels = {
    background: "Background",
    text: "Text color",
    outline: "Outline color",
  };
  const property = targetProperties[target];

  if (!property) {
    return;
  }

  state.colorPickerTarget = target;
  const color = /^#[0-9a-f]{6}$/i.test(currentColor)
    ? currentColor
    : state.appearance[property];
  renderPickerControls(color, hexToHsl(color));
  elements.colorHexInput.value = color;
  elements.hueSlider.style.background =
    "linear-gradient(to right, #ff3b30, #ffcc00, #34c759, #32ade6, #5856d6, #af52de, #ff3b30)";
  elements.colorDialogTitle.textContent = targetLabels[target];
  elements.colorDialog.hidden = false;
  requestAnimationFrame(() => {
    elements.colorHexInput.focus();
    elements.colorHexInput.select();
  });
}

function closeColorPicker() {
  elements.colorDialog.hidden = true;
  state.colorPickerTarget = null;
}

async function initializeWindowState() {
  try {
    const windowState = await window.desktopWindow.getState();
    applyAppearanceSettings(windowState);
    applyPinnedState(windowState.pinned);
    applyWindowLock(windowState.lockWindow);
    applyMiniMode(windowState.miniMode);
    applyPositionLock(windowState.lockPosition);
    applySizeLock(windowState.lockSize);
    applyCoinState(windowState);
  } catch (error) {
    console.error("Unable to read window state:", error);
    applyWindowLock(false);
    applyMiniMode(false);
    applyPositionLock(false);
    applySizeLock(true);
    applyCoinState({ selectedCoin: "BTCUSDT", favoriteCoins: [] });
    setPinnedState();
  }
}

async function start() {
  bindEvents();
  window.desktopWindow.onAppearanceChange(applyAppearanceSettings);
  window.desktopWindow.onColorPickerRequest(openColorPicker);
  window.desktopWindow.onCoinChange(applyCoinState);
  window.desktopWindow.onCoinPickerRequest(openCoinPicker);
  window.desktopWindow.onPositionLockChange(applyPositionLock);
  window.desktopWindow.onSizeLockChange(applySizeLock);
  window.desktopWindow.onWindowLockChange(applyWindowLock);
  window.desktopWindow.onMiniModeChange(applyMiniMode);
  window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });

  await loadCachedCoinCatalog();
  await initializeWindowState();
  refreshCoinCatalog();

  state.pollTimer = window.setInterval(refreshTicker, POLL_INTERVAL_MS);
  state.chartTimer = window.setInterval(refreshChart, CHART_INTERVAL_MS);
}

start();
