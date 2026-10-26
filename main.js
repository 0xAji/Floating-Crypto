const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, Menu, screen } = require("electron");
const {
  DEFAULT_SETTINGS,
  MINI_WINDOW_HEIGHT,
  SETTINGS_VERSION,
  WINDOW_SIZE_LIMITS,
  getCenteredWindowPosition,
  getEffectiveWindowLocks,
  isWindowPositionVisible,
  normalizePersistedSettings,
} = require("./src/lib/settings");
const {
  getBaseAsset,
  normalizeCoinSymbol,
  normalizeStoredCoinCatalog,
} = require("./src/lib/coins");

const MIN_WINDOW_WIDTH = WINDOW_SIZE_LIMITS.minWidth;
const MIN_WINDOW_HEIGHT = WINDOW_SIZE_LIMITS.minHeight;
const SETTINGS_SAVE_DELAY_MS = 150;
const COIN_CATALOG_VERSION = 1;
const BACKGROUND_OPACITY_OPTIONS = [
  { label: "100%", value: 1 },
  { label: "85%", value: 0.85 },
  { label: "70%", value: 0.7 },
  { label: "50%", value: 0.5 },
  { label: "30%", value: 0.3 },
  { label: "15%", value: 0.15 },
  { label: "0%", value: 0 },
];
const BACKGROUND_COLOR_OPTIONS = [
  { label: "Graphite (#131316)", value: "#131316" },
  { label: "Black (#000000)", value: "#000000" },
  { label: "Charcoal (#202027)", value: "#202027" },
  { label: "Navy (#101A2E)", value: "#101a2e" },
  { label: "Dark green (#10201A)", value: "#10201a" },
  { label: "Burgundy (#2A1217)", value: "#2a1217" },
  { label: "Cream (#EDE8DC)", value: "#ede8dc" },
  { label: "White (#FFFFFF)", value: "#ffffff" },
];
const PRICE_CHANGE_COLOR_OPTIONS = [
  { label: "Green / Red", value: "green-red" },
  { label: "Red / Blue", value: "red-blue" },
];
const TEXT_COLOR_OPTIONS = [
  { label: "Warm white (#F5F3EE)", value: "#f5f3ee" },
  { label: "White (#FFFFFF)", value: "#ffffff" },
  { label: "Black (#000000)", value: "#000000" },
  { label: "Green (#93D874)", value: "#93d874" },
  { label: "Amber (#F2C14E)", value: "#f2c14e" },
  { label: "Cyan (#62D4D0)", value: "#62d4d0" },
  { label: "Pink (#FF8FB8)", value: "#ff8fb8" },
  { label: "Violet (#A79BFA)", value: "#a79bfa" },
];
const OUTLINE_COLOR_OPTIONS = [
  { label: "Black (#000000)", value: "#000000" },
  { label: "White (#FFFFFF)", value: "#ffffff" },
  { label: "Graphite (#131316)", value: "#131316" },
  { label: "Navy (#101A2E)", value: "#101a2e" },
  { label: "Green (#2D6A3D)", value: "#2d6a3d" },
  { label: "Red (#8E2635)", value: "#8e2635" },
  { label: "Violet (#4B3F95)", value: "#4b3f95" },
  { label: "Cyan (#137A80)", value: "#137a80" },
];
const TEXT_OUTLINE_SIZES = Array.from({ length: 10 }, (_, index) => 10 - index);

let mainWindow = null;
let settingsSaveTimer = null;
let contextMenuOpen = false;
let isPinned = DEFAULT_SETTINGS.pinned;
let miniMode = DEFAULT_SETTINGS.miniMode;
let lockWindow = DEFAULT_SETTINGS.lockWindow;
let lockPosition = DEFAULT_SETTINGS.lockPosition;
let lockSize = DEFAULT_SETTINGS.lockSize;
let windowPosition = DEFAULT_SETTINGS.windowPosition;
let windowSize = DEFAULT_SETTINGS.windowSize;
let miniWindowSize = DEFAULT_SETTINGS.miniWindowSize;
let selectedCoin = DEFAULT_SETTINGS.selectedCoin;
let favoriteCoins = [...DEFAULT_SETTINGS.favoriteCoins];
let backgroundOpacity = DEFAULT_SETTINGS.appearance.backgroundOpacity;
let backgroundColor = DEFAULT_SETTINGS.appearance.backgroundColor;
let priceChangeColor = DEFAULT_SETTINGS.appearance.priceChangeColor;
let textColor = DEFAULT_SETTINGS.appearance.textColor;
let outlineColor = DEFAULT_SETTINGS.appearance.outlineColor;
let textOutlineWidth = DEFAULT_SETTINGS.appearance.textOutlineWidth;

function getInitialBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = miniMode ? getMiniWindowSize() : windowSize;
  const fallbackPosition = getCenteredWindowPosition(
    workArea,
    width,
    height,
  );
  const position =
    isWindowPositionVisible(
      windowPosition,
      screen.getAllDisplays(),
      width,
      height,
    ) && windowPosition
      ? windowPosition
      : fallbackPosition;

  return {
    width,
    height,
    x: position.x,
    y: position.y,
  };
}

function getMiniWindowSize() {
  return (
    miniWindowSize ?? {
      width: windowSize.width,
      height: MINI_WINDOW_HEIGHT,
    }
  );
}

function createWindow() {
  const effectiveLocks = getEffectiveWindowLocks(
    lockWindow,
    lockPosition,
    lockSize,
  );
  mainWindow = new BrowserWindow({
    ...getInitialBounds(),
    title: "Floating Crypto",
    frame: false,
    transparent: true,
    movable: !effectiveLocks.positionLocked,
    resizable: !effectiveLocks.sizeLocked,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: miniMode ? MINI_WINDOW_HEIGHT : MIN_WINDOW_HEIGHT,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#00000000",
    hasShadow: true,
    roundedCorners: true,
    alwaysOnTop: isPinned,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMovable(!effectiveLocks.positionLocked);
  mainWindow.setResizable(!effectiveLocks.sizeLocked);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAlwaysOnTop(isPinned, "floating");
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.on("context-menu", showWindowContextMenu);

  mainWindow.on("move", () => {
    if (!mainWindow) {
      return;
    }

    const { x, y } = mainWindow.getBounds();
    windowPosition = { x: Math.round(x), y: Math.round(y) };
    scheduleSettingsSave();
  });

  mainWindow.on("resize", () => {
    if (!mainWindow) {
      return;
    }

    const { width, height } = mainWindow.getBounds();

    if (miniMode) {
      miniWindowSize = {
        width: Math.round(width),
        height: Math.round(height),
      };
    } else {
      windowSize = {
        width: Math.round(width),
        height: Math.round(height),
      };
    }
    scheduleSettingsSave();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getAppearanceSettings() {
  return {
    backgroundColor,
    backgroundOpacity,
    priceChangeColor,
    textColor,
    outlineColor,
    textOutlineWidth,
  };
}

function getSettingsPath() {
  return path.join(__dirname, ".local", "settings.json");
}

function getCoinCatalogPath() {
  return path.join(__dirname, ".local", "coins.json");
}

function getCoinState() {
  return {
    selectedCoin,
    favoriteCoins: [...favoriteCoins],
  };
}

function saveSettings() {
  if (mainWindow) {
    const { x, y, width, height } = mainWindow.getBounds();
    windowPosition = { x: Math.round(x), y: Math.round(y) };

    if (miniMode) {
      miniWindowSize = {
        width: Math.round(width),
        height: Math.round(height),
      };
    } else {
      windowSize = {
        width: Math.round(width),
        height: Math.round(height),
      };
    }
  }

  const settings = {
    version: SETTINGS_VERSION,
    pinned: isPinned,
    miniMode,
    lockWindow,
    lockPosition,
    lockSize,
    windowPosition,
    windowSize,
    miniWindowSize,
    ...getCoinState(),
    appearance: getAppearanceSettings(),
  };

  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(
      getSettingsPath(),
      `${JSON.stringify(settings, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("Unable to save settings:", error);
  }
}

function scheduleSettingsSave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    settingsSaveTimer = null;
    saveSettings();
  }, SETTINGS_SAVE_DELAY_MS);
}

function flushSettingsSave() {
  if (settingsSaveTimer !== null) {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = null;
  }

  saveSettings();
}

function loadSettings() {
  try {
    const stored = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    const settings = normalizePersistedSettings(stored);

    isPinned = settings.pinned;
    miniMode = settings.miniMode;
    lockWindow = settings.lockWindow;
    lockPosition = settings.lockPosition;
    lockSize = settings.lockSize;
    windowPosition = settings.windowPosition;
    windowSize = settings.windowSize;
    miniWindowSize = settings.miniWindowSize;
    selectedCoin = settings.selectedCoin;
    favoriteCoins = settings.favoriteCoins;
    backgroundColor = settings.appearance.backgroundColor;
    backgroundOpacity = settings.appearance.backgroundOpacity;
    priceChangeColor = settings.appearance.priceChangeColor;
    textColor = settings.appearance.textColor;
    outlineColor = settings.appearance.outlineColor;
    textOutlineWidth = settings.appearance.textOutlineWidth;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to load settings:", error);
      return;
    }

    saveSettings();
  }
}

function pushAppearanceSettings() {
  mainWindow?.webContents.send("window:appearance-changed", getAppearanceSettings());
  scheduleSettingsSave();
}

function pushCoinState() {
  mainWindow?.webContents.send("window:coin-changed", getCoinState());
}

function normalizeUsdtSymbol(value) {
  const symbol = normalizeCoinSymbol(value);
  return symbol?.endsWith("USDT") ? symbol : null;
}

function setSelectedCoin(value) {
  const symbol = normalizeUsdtSymbol(value);

  if (!symbol) {
    return false;
  }

  selectedCoin = symbol;
  pushCoinState();
  scheduleSettingsSave();
  return true;
}

function toggleFavoriteCoin(value = selectedCoin) {
  const symbol = normalizeUsdtSymbol(value);

  if (!symbol) {
    return getCoinState();
  }

  favoriteCoins = favoriteCoins.includes(symbol)
    ? favoriteCoins.filter((coin) => coin !== symbol)
    : [...favoriteCoins, symbol];
  pushCoinState();
  scheduleSettingsSave();
  return getCoinState();
}

function loadCoinCatalog() {
  try {
    const stored = JSON.parse(fs.readFileSync(getCoinCatalogPath(), "utf8"));
    return normalizeStoredCoinCatalog(stored);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to load coin catalog:", error);
    }

    return [];
  }
}

function saveCoinCatalog(value) {
  const coins = normalizeStoredCoinCatalog(value);

  if (coins.length === 0) {
    return loadCoinCatalog();
  }

  try {
    fs.mkdirSync(path.dirname(getCoinCatalogPath()), { recursive: true });
    fs.writeFileSync(
      getCoinCatalogPath(),
      `${JSON.stringify(
        {
          version: COIN_CATALOG_VERSION,
          updatedAt: new Date().toISOString(),
          coins,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("Unable to save coin catalog:", error);
    return loadCoinCatalog();
  }

  return coins;
}

function setBackgroundOpacity(opacity) {
  backgroundOpacity = opacity;
  pushAppearanceSettings();
}

function setPriceChangeColor(value) {
  if (
    !PRICE_CHANGE_COLOR_OPTIONS.some((option) => option.value === value)
  ) {
    return;
  }

  priceChangeColor = value;
  pushAppearanceSettings();
}

function setTextOutlineWidth(width) {
  textOutlineWidth = width;
  pushAppearanceSettings();
}

function setColor(target, color) {
  const normalizedColor = String(color).toLowerCase();

  if (!/^#[0-9a-f]{6}$/.test(normalizedColor)) {
    return;
  }

  if (target === "background") {
    backgroundColor = normalizedColor;
  } else if (target === "text") {
    textColor = normalizedColor;
  } else if (target === "outline") {
    outlineColor = normalizedColor;
  } else {
    return;
  }

  pushAppearanceSettings();
}

function requestColorPicker(target, currentColor) {
  mainWindow?.webContents.send("window:request-color-picker", {
    target,
    currentColor,
  });
}

function requestCoinPicker() {
  mainWindow?.webContents.send("window:request-coin-picker");
}

function createColorSubmenu(options, currentColor, target) {
  return [
    ...options.map((option) => ({
      label: option.label,
      type: "radio",
      checked: currentColor === option.value,
      click: () => setColor(target, option.value),
    })),
    { type: "separator" },
    {
      label: "Choose custom color...",
      click: () => requestColorPicker(target, currentColor),
    },
  ];
}

function toggleAlwaysOnTop() {
  if (!mainWindow) {
    return;
  }

  isPinned = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(isPinned, "floating");
  scheduleSettingsSave();
}

function toggleLockSize() {
  lockSize = !lockSize;
  applyWindowLocks();
  scheduleSettingsSave();
}

function toggleLockPosition() {
  lockPosition = !lockPosition;
  applyWindowLocks();
  scheduleSettingsSave();
}

function getWindowLocks() {
  return getEffectiveWindowLocks(lockWindow, lockPosition, lockSize);
}

function getWindowLockState() {
  const locks = getWindowLocks();

  return {
    lockWindow,
    lockPosition: locks.positionLocked,
    lockSize: locks.sizeLocked,
  };
}

function applyWindowLocks() {
  const locks = getWindowLocks();

  mainWindow?.setMovable(!locks.positionLocked);
  mainWindow?.setResizable(!locks.sizeLocked);
  mainWindow?.webContents.send("window:position-lock-changed", {
    locked: locks.positionLocked,
  });
  mainWindow?.webContents.send("window:size-lock-changed", {
    locked: locks.sizeLocked,
  });
}

function toggleWindowLock() {
  lockWindow = !lockWindow;
  applyWindowLocks();
  mainWindow?.webContents.send("window:window-lock-changed", {
    locked: lockWindow,
  });
  scheduleSettingsSave();
}

function clampToWorkArea(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  const maxX = Math.max(
    workArea.x,
    workArea.x + workArea.width - bounds.width,
  );
  const maxY = Math.max(
    workArea.y,
    workArea.y + workArea.height - bounds.height,
  );

  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

function setMiniWindowMode(value) {
  if (!mainWindow) {
    return { miniMode };
  }

  const nextMiniMode = value === true;

  if (nextMiniMode === miniMode) {
    return { miniMode };
  }

  const current = mainWindow.getBounds();

  if (nextMiniMode) {
    windowSize = {
      width: Math.round(current.width),
      height: Math.round(current.height),
    };
    miniMode = true;
    const miniBounds = clampToWorkArea({
      x: current.x,
      y: current.y,
      width: getMiniWindowSize().width,
      height: getMiniWindowSize().height,
    });
    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, MINI_WINDOW_HEIGHT);
    mainWindow.setBounds(miniBounds, false);
  } else {
    miniMode = false;
    const fullBounds = clampToWorkArea({
      x: current.x,
      y: current.y,
      width: windowSize.width,
      height: windowSize.height,
    });
    mainWindow.setBounds(fullBounds, false);
    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);
  }

  applyWindowLocks();
  mainWindow.webContents.send("window:mini-mode-changed", { miniMode });
  scheduleSettingsSave();
  return { miniMode };
}

function setWindowBounds(bounds) {
  if (
    getWindowLocks().sizeLocked ||
    !mainWindow ||
    !bounds ||
    typeof bounds !== "object"
  ) {
    return;
  }

  const current = mainWindow.getBounds();
  const width = Math.min(
    Math.max(Math.round(bounds.width), WINDOW_SIZE_LIMITS.minWidth),
    WINDOW_SIZE_LIMITS.maxWidth,
  );
  const minimumHeight = miniMode ? MINI_WINDOW_HEIGHT : MIN_WINDOW_HEIGHT;
  const height = Math.min(
    Math.max(Math.round(bounds.height), minimumHeight),
    WINDOW_SIZE_LIMITS.maxHeight,
  );
  const x = Number.isFinite(bounds.x) ? Math.round(bounds.x) : current.x;
  const y = Number.isFinite(bounds.y) ? Math.round(bounds.y) : current.y;

  mainWindow.setBounds({ x, y, width, height }, false);
}

function setWindowPosition(position) {
  if (
    getWindowLocks().positionLocked ||
    !mainWindow ||
    !position ||
    typeof position !== "object" ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    return;
  }

  mainWindow.setPosition(
    Math.round(position.x),
    Math.round(position.y),
    false,
  );
}

function createCoinSubmenu() {
  const quickPicks =
    favoriteCoins.length > 0
      ? favoriteCoins.map((symbol) => ({
          label: `${getBaseAsset(symbol)} / USDT`,
          type: "radio",
          checked: symbol === selectedCoin,
          click: () => setSelectedCoin(symbol),
        }))
      : [{ label: "No quick picks yet", enabled: false }];

  return [
    {
      label: `Showing ${getBaseAsset(selectedCoin)} / USDT`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quick picks",
      submenu: quickPicks,
    },
    {
      label: "Search coins...",
      click: () => requestCoinPicker(),
    },
  ];
}

function createContextMenu() {
  const locks = getWindowLocks();

  return Menu.buildFromTemplate([
    {
      label: "Coin",
      submenu: createCoinSubmenu(),
    },
    { type: "separator" },
    {
      label: "Layout",
      submenu: [
        {
          label: "Opacity",
          submenu: BACKGROUND_OPACITY_OPTIONS.map((option) => ({
            label: option.label,
            type: "radio",
            checked: backgroundOpacity === option.value,
            click: () => setBackgroundOpacity(option.value),
          })),
        },
        {
          label: "Background color",
          submenu: createColorSubmenu(
            BACKGROUND_COLOR_OPTIONS,
            backgroundColor,
            "background",
          ),
        },
        {
          label: "Price change color",
          submenu: PRICE_CHANGE_COLOR_OPTIONS.map((option) => ({
            label: option.label,
            type: "radio",
            checked: priceChangeColor === option.value,
            click: () => setPriceChangeColor(option.value),
          })),
        },
        {
          label: "Lock position",
          type: "checkbox",
          checked: locks.positionLocked,
          enabled: !lockWindow,
          click: toggleLockPosition,
        },
        {
          label: "Lock size",
          type: "checkbox",
          checked: locks.sizeLocked,
          enabled: !lockWindow,
          click: toggleLockSize,
        },
      ],
    },
    {
      label: "Text",
      submenu: [
        {
          label: "Text color",
          submenu: createColorSubmenu(TEXT_COLOR_OPTIONS, textColor, "text"),
        },
        {
          label: "Outline color",
          submenu: createColorSubmenu(
            OUTLINE_COLOR_OPTIONS,
            outlineColor,
            "outline",
          ),
        },
        {
          label: "Outline size",
          submenu: TEXT_OUTLINE_SIZES.map((width) => ({
            label: `${width} px`,
            type: "radio",
            checked: textOutlineWidth === width,
            click: () => setTextOutlineWidth(width),
          })),
        },
      ],
    },
    { type: "separator" },
    {
      label: "Always on top",
      type: "checkbox",
      checked: mainWindow?.isAlwaysOnTop() ?? isPinned,
      click: toggleAlwaysOnTop,
    },
    { type: "separator" },
    {
      label: "Close",
      click: () => mainWindow?.close(),
    },
  ]);
}

function showWindowContextMenu() {
  if (!mainWindow || contextMenuOpen) {
    return;
  }

  contextMenuOpen = true;
  createContextMenu().popup({
    window: mainWindow,
    callback: () => {
      contextMenuOpen = false;
    },
  });
}

ipcMain.on("window:close", () => {
  mainWindow?.close();
});

ipcMain.on("window:set-color", (_event, { target, color }) => {
  setColor(target, color);
});

ipcMain.on("window:show-context-menu", showWindowContextMenu);

ipcMain.handle("window:get-state", () => ({
  ...getWindowLockState(),
  pinned: mainWindow?.isAlwaysOnTop() ?? isPinned,
  miniMode,
  ...getCoinState(),
  ...getAppearanceSettings(),
}));

ipcMain.handle("window:toggle-pin", () => {
  toggleAlwaysOnTop();
  return { pinned: isPinned };
});

ipcMain.handle("window:toggle-window-lock", () => {
  toggleWindowLock();
  return { locked: lockWindow };
});

ipcMain.handle("window:set-mini-mode", (_event, value) =>
  setMiniWindowMode(value),
);

ipcMain.handle("window:get-bounds", () => mainWindow?.getBounds() ?? null);

ipcMain.on("window:resize", (_event, bounds) => {
  setWindowBounds(bounds);
});

ipcMain.on("window:move", (_event, position) => {
  setWindowPosition(position);
});

ipcMain.handle("coin:select", (_event, symbol) => {
  setSelectedCoin(symbol);
  return getCoinState();
});

ipcMain.handle("coin:toggle-favorite", (_event, symbol) =>
  toggleFavoriteCoin(symbol),
);

ipcMain.handle("coins:get-cached", () => loadCoinCatalog());

ipcMain.handle("coins:save", (_event, coins) => saveCoinCatalog(coins));

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("before-quit", flushSettingsSave);

  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    loadSettings();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
