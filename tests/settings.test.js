const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_SETTINGS,
  MINI_WINDOW_HEIGHT,
  WINDOW_SIZE_LIMITS,
  getCenteredWindowPosition,
  getEffectiveWindowLocks,
  isWindowPositionVisible,
  normalizePersistedSettings,
} = require("../src/lib/settings");

test("uses defaults for missing or invalid settings", () => {
  assert.deepEqual(normalizePersistedSettings(null), {
    pinned: DEFAULT_SETTINGS.pinned,
    miniMode: DEFAULT_SETTINGS.miniMode,
    lockWindow: DEFAULT_SETTINGS.lockWindow,
    lockPosition: DEFAULT_SETTINGS.lockPosition,
    lockSize: DEFAULT_SETTINGS.lockSize,
    windowPosition: DEFAULT_SETTINGS.windowPosition,
    windowSize: DEFAULT_SETTINGS.windowSize,
    miniWindowSize: DEFAULT_SETTINGS.miniWindowSize,
    selectedCoin: DEFAULT_SETTINGS.selectedCoin,
    favoriteCoins: DEFAULT_SETTINGS.favoriteCoins,
    appearance: DEFAULT_SETTINGS.appearance,
  });

  const settings = normalizePersistedSettings({
    pinned: "yes",
    miniMode: "no",
    lockWindow: "no",
    lockPosition: "no",
    lockSize: "no",
    windowSize: { width: 100, height: 99999 },
    miniWindowSize: { width: 100, height: 10 },
    appearance: {
      backgroundColor: "not-a-color",
      backgroundOpacity: "opaque",
      priceChangeColor: "purple-yellow",
      textColor: null,
      outlineColor: "#12345",
      textOutlineWidth: Infinity,
    },
  });

  assert.equal(settings.pinned, DEFAULT_SETTINGS.pinned);
  assert.equal(settings.miniMode, DEFAULT_SETTINGS.miniMode);
  assert.equal(settings.lockWindow, DEFAULT_SETTINGS.lockWindow);
  assert.equal(settings.lockPosition, DEFAULT_SETTINGS.lockPosition);
  assert.equal(settings.lockSize, DEFAULT_SETTINGS.lockSize);
  assert.equal(settings.windowPosition, null);
  assert.deepEqual(settings.windowSize, {
    width: WINDOW_SIZE_LIMITS.minWidth,
    height: WINDOW_SIZE_LIMITS.maxHeight,
  });
  assert.deepEqual(settings.miniWindowSize, {
    width: WINDOW_SIZE_LIMITS.minWidth,
    height: MINI_WINDOW_HEIGHT,
  });
  assert.deepEqual(settings.appearance, DEFAULT_SETTINGS.appearance);
});

test("loads and normalizes valid persisted settings", () => {
  const settings = normalizePersistedSettings({
    pinned: false,
    miniMode: true,
    lockWindow: true,
    lockPosition: true,
    lockSize: false,
    windowPosition: { x: -1200.4, y: 32.6 },
    windowSize: { width: 642.4, height: 388.8 },
    miniWindowSize: { width: 500.4, height: 96.6 },
    selectedCoin: " ethusdt ",
    favoriteCoins: ["BTCUSDT", "btcusdt", "invalid symbol", "SOLUSDT"],
    appearance: {
      backgroundColor: " #AABBCC ",
      backgroundOpacity: 0.7,
      priceChangeColor: "red-blue",
      textColor: "#F5F3EE",
      outlineColor: "#000000",
      textOutlineWidth: 4,
    },
  });

  assert.deepEqual(settings, {
    pinned: false,
    miniMode: true,
    lockWindow: true,
    lockPosition: true,
    lockSize: false,
    windowPosition: { x: -1200, y: 33 },
    windowSize: { width: 642, height: 389 },
    miniWindowSize: { width: 500, height: 97 },
    selectedCoin: "ETHUSDT",
    favoriteCoins: ["BTCUSDT", "SOLUSDT"],
    appearance: {
      backgroundColor: "#aabbcc",
      backgroundOpacity: 0.7,
      priceChangeColor: "red-blue",
      textColor: "#f5f3ee",
      outlineColor: "#000000",
      textOutlineWidth: 4,
    },
  });
});

test("bounds persisted numeric settings", () => {
  const settings = normalizePersistedSettings({
    appearance: {
      backgroundOpacity: 2,
      textOutlineWidth: 12.4,
    },
  });

  assert.equal(settings.appearance.backgroundOpacity, 1);
  assert.equal(settings.appearance.textOutlineWidth, 10);
});

test("migrates the previous price change background setting", () => {
  const settings = normalizePersistedSettings({
    appearance: {
      priceChangeBackground: "red-blue",
    },
  });

  assert.equal(settings.appearance.priceChangeColor, "red-blue");
  assert.equal("priceChangeBackground" in settings.appearance, false);
});

test("accepts only window positions with enough visible area", () => {
  const displays = [
    { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  ];

  assert.equal(
    isWindowPositionVisible({ x: 100, y: 80 }, displays, 378, 292),
    true,
  );
  assert.equal(
    isWindowPositionVisible({ x: 1880, y: 80 }, displays, 378, 292),
    false,
  );
  assert.equal(
    isWindowPositionVisible({ x: -1200, y: 80 }, displays, 378, 292),
    false,
  );
  assert.equal(isWindowPositionVisible(null, displays, 378, 292), false);
});

test("centers the default window position within the display work area", () => {
  assert.deepEqual(
    getCenteredWindowPosition(
      { x: 0, y: 0, width: 1920, height: 1080 },
      378,
      292,
    ),
    { x: 771, y: 394 },
  );

  assert.deepEqual(
    getCenteredWindowPosition(
      { x: 100, y: 50, width: 1000, height: 800 },
      378,
      292,
    ),
    { x: 411, y: 304 },
  );
});

test("master lock preserves individual lock preferences when opened", () => {
  assert.deepEqual(getEffectiveWindowLocks(true, false, false), {
    positionLocked: true,
    sizeLocked: true,
  });

  assert.deepEqual(getEffectiveWindowLocks(false, false, true), {
    positionLocked: false,
    sizeLocked: true,
  });

  assert.deepEqual(getEffectiveWindowLocks(false, true, false), {
    positionLocked: true,
    sizeLocked: false,
  });
});
