(function exposeSettingsHelpers(root, factory) {
  const helpers = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = helpers;
  }

  root.SettingsHelpers = helpers;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSettingsHelpers() {
  const SETTINGS_VERSION = 10;
  const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
  const COIN_SYMBOL_PATTERN = /^[A-Z0-9]{2,24}USDT$/;
  const WINDOW_SIZE_LIMITS = Object.freeze({
    minWidth: 320,
    minHeight: 240,
    maxWidth: 4096,
    maxHeight: 2160,
  });
  const MINI_WINDOW_HEIGHT = 58;
  const DEFAULT_SETTINGS = Object.freeze({
    pinned: true,
    miniMode: false,
    lockWindow: false,
    lockPosition: false,
    lockSize: true,
    windowPosition: null,
    windowSize: Object.freeze({ width: 378, height: 292 }),
    miniWindowSize: null,
    selectedCoin: "BTCUSDT",
    favoriteCoins: Object.freeze([]),
    appearance: Object.freeze({
      backgroundColor: "#131316",
      backgroundOpacity: 1,
      priceChangeColor: "green-red",
      textColor: "#f5f3ee",
      outlineColor: "#000000",
      textOutlineWidth: 1,
    }),
  });

  function normalizeColor(value, fallback) {
    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    return COLOR_PATTERN.test(normalized) ? normalized : fallback;
  }

  function normalizeNumber(value, fallback, minimum, maximum, integer = false) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    const bounded = Math.min(Math.max(value, minimum), maximum);
    return integer ? Math.round(bounded) : bounded;
  }

  function normalizeWindowPosition(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    if (
      typeof value.x !== "number" ||
      !Number.isFinite(value.x) ||
      typeof value.y !== "number" ||
      !Number.isFinite(value.y)
    ) {
      return null;
    }

    return {
      x: Math.round(value.x),
      y: Math.round(value.y),
    };
  }

  function normalizeWindowSize(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_SETTINGS.windowSize };
    }

    return {
      width:
        typeof value.width === "number" && Number.isFinite(value.width)
          ? Math.round(
              Math.min(
                Math.max(value.width, WINDOW_SIZE_LIMITS.minWidth),
                WINDOW_SIZE_LIMITS.maxWidth,
              ),
            )
          : DEFAULT_SETTINGS.windowSize.width,
      height:
        typeof value.height === "number" && Number.isFinite(value.height)
          ? Math.round(
              Math.min(
                Math.max(value.height, WINDOW_SIZE_LIMITS.minHeight),
                WINDOW_SIZE_LIMITS.maxHeight,
              ),
            )
          : DEFAULT_SETTINGS.windowSize.height,
    };
  }

  function normalizeMiniWindowSize(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return {
      width:
        typeof value.width === "number" && Number.isFinite(value.width)
          ? Math.round(
              Math.min(
                Math.max(value.width, WINDOW_SIZE_LIMITS.minWidth),
                WINDOW_SIZE_LIMITS.maxWidth,
              ),
            )
          : DEFAULT_SETTINGS.windowSize.width,
      height:
        typeof value.height === "number" && Number.isFinite(value.height)
          ? Math.round(
              Math.min(
                Math.max(value.height, MINI_WINDOW_HEIGHT),
                WINDOW_SIZE_LIMITS.maxHeight,
              ),
            )
          : MINI_WINDOW_HEIGHT,
    };
  }

  function getCenteredWindowPosition(workArea, width, height) {
    const safeWidth =
      typeof width === "number" && Number.isFinite(width)
        ? width
        : DEFAULT_SETTINGS.windowSize.width;
    const safeHeight =
      typeof height === "number" && Number.isFinite(height)
        ? height
        : DEFAULT_SETTINGS.windowSize.height;

    return {
      x: Math.round(workArea.x + (workArea.width - safeWidth) / 2),
      y: Math.round(workArea.y + (workArea.height - safeHeight) / 2),
    };
  }

  function getEffectiveWindowLocks(lockWindow, lockPosition, lockSize) {
    const masterLocked = lockWindow === true;

    return {
      positionLocked: masterLocked || lockPosition === true,
      sizeLocked: masterLocked || lockSize === true,
    };
  }

  function normalizeCoinSymbol(value, fallback) {
    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toUpperCase();
    return COIN_SYMBOL_PATTERN.test(normalized) ? normalized : fallback;
  }

  function normalizeFavoriteCoins(value) {
    if (!Array.isArray(value)) {
      return [...DEFAULT_SETTINGS.favoriteCoins];
    }

    const uniqueCoins = new Set();

    for (const candidate of value) {
      const symbol = normalizeCoinSymbol(candidate, null);

      if (symbol) {
        uniqueCoins.add(symbol);
      }
    }

    return [...uniqueCoins];
  }

  function normalizePriceChangeColor(value, fallback) {
    return value === "green-red" || value === "red-blue" ? value : fallback;
  }

  function isWindowPositionVisible(
    position,
    displays,
    windowWidth,
    windowHeight,
  ) {
    if (!position || !Array.isArray(displays)) {
      return false;
    }

    const minimumVisibleWidth = Math.min(64, windowWidth);
    const minimumVisibleHeight = Math.min(32, windowHeight);

    return displays.some((display) => {
      const workArea = display?.workArea;

      if (!workArea) {
        return false;
      }

      const visibleWidth =
        Math.min(position.x + windowWidth, workArea.x + workArea.width) -
        Math.max(position.x, workArea.x);
      const visibleHeight =
        Math.min(position.y + windowHeight, workArea.y + workArea.height) -
        Math.max(position.y, workArea.y);

      return (
        visibleWidth >= minimumVisibleWidth &&
        visibleHeight >= minimumVisibleHeight
      );
    });
  }

  function normalizePersistedSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const appearance =
      source.appearance &&
      typeof source.appearance === "object" &&
      !Array.isArray(source.appearance)
        ? source.appearance
        : {};
    const defaults = DEFAULT_SETTINGS.appearance;

    return {
      pinned:
        typeof source.pinned === "boolean"
          ? source.pinned
          : DEFAULT_SETTINGS.pinned,
      miniMode:
        typeof source.miniMode === "boolean"
          ? source.miniMode
          : DEFAULT_SETTINGS.miniMode,
      lockWindow:
        typeof source.lockWindow === "boolean"
          ? source.lockWindow
          : DEFAULT_SETTINGS.lockWindow,
      lockPosition:
        typeof source.lockPosition === "boolean"
          ? source.lockPosition
          : DEFAULT_SETTINGS.lockPosition,
      lockSize:
        typeof source.lockSize === "boolean"
          ? source.lockSize
          : DEFAULT_SETTINGS.lockSize,
      windowPosition: normalizeWindowPosition(source.windowPosition),
      windowSize: normalizeWindowSize(source.windowSize),
      miniWindowSize: normalizeMiniWindowSize(source.miniWindowSize),
      selectedCoin: normalizeCoinSymbol(
        source.selectedCoin,
        DEFAULT_SETTINGS.selectedCoin,
      ),
      favoriteCoins: normalizeFavoriteCoins(source.favoriteCoins),
      appearance: {
        backgroundColor: normalizeColor(
          appearance.backgroundColor,
          defaults.backgroundColor,
        ),
        backgroundOpacity: normalizeNumber(
          appearance.backgroundOpacity,
          defaults.backgroundOpacity,
          0,
          1,
        ),
        priceChangeColor: normalizePriceChangeColor(
          appearance.priceChangeColor ?? appearance.priceChangeBackground,
          defaults.priceChangeColor,
        ),
        textColor: normalizeColor(appearance.textColor, defaults.textColor),
        outlineColor: normalizeColor(
          appearance.outlineColor,
          defaults.outlineColor,
        ),
        textOutlineWidth: normalizeNumber(
          appearance.textOutlineWidth,
          defaults.textOutlineWidth,
          1,
          10,
          true,
        ),
      },
    };
  }

  return {
    DEFAULT_SETTINGS,
    MINI_WINDOW_HEIGHT,
    SETTINGS_VERSION,
    WINDOW_SIZE_LIMITS,
    getCenteredWindowPosition,
    getEffectiveWindowLocks,
    isWindowPositionVisible,
    normalizePersistedSettings,
  };
});
