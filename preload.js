const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWindow", {
  close: () => ipcRenderer.send("window:close"),
  getState: () => ipcRenderer.invoke("window:get-state"),
  togglePin: () => ipcRenderer.invoke("window:toggle-pin"),
  toggleWindowLock: () => ipcRenderer.invoke("window:toggle-window-lock"),
  setMiniMode: (miniMode) =>
    ipcRenderer.invoke("window:set-mini-mode", miniMode),
  getWindowBounds: () => ipcRenderer.invoke("window:get-bounds"),
  resizeWindow: (bounds) => ipcRenderer.send("window:resize", bounds),
  moveWindow: (position) => ipcRenderer.send("window:move", position),
  showContextMenu: () => ipcRenderer.send("window:show-context-menu"),
  selectCoin: (symbol) => ipcRenderer.invoke("coin:select", symbol),
  toggleFavorite: (symbol) =>
    ipcRenderer.invoke("coin:toggle-favorite", symbol),
  getCachedCoinCatalog: () => ipcRenderer.invoke("coins:get-cached"),
  saveCoinCatalog: (coins) => ipcRenderer.invoke("coins:save", coins),
  setColor: (target, color) =>
    ipcRenderer.send("window:set-color", { target, color }),
  onAppearanceChange: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("window:appearance-changed", listener);
    return () =>
      ipcRenderer.removeListener("window:appearance-changed", listener);
  },
  onColorPickerRequest: (callback) => {
    const listener = (_event, request) => callback(request);
    ipcRenderer.on("window:request-color-picker", listener);
    return () =>
      ipcRenderer.removeListener("window:request-color-picker", listener);
  },
  onCoinChange: (callback) => {
    const listener = (_event, coinState) => callback(coinState);
    ipcRenderer.on("window:coin-changed", listener);
    return () => ipcRenderer.removeListener("window:coin-changed", listener);
  },
  onCoinPickerRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("window:request-coin-picker", listener);
    return () =>
      ipcRenderer.removeListener("window:request-coin-picker", listener);
  },
  onSizeLockChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:size-lock-changed", listener);
    return () =>
      ipcRenderer.removeListener("window:size-lock-changed", listener);
  },
  onPositionLockChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:position-lock-changed", listener);
    return () =>
      ipcRenderer.removeListener("window:position-lock-changed", listener);
  },
  onWindowLockChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:window-lock-changed", listener);
    return () =>
      ipcRenderer.removeListener("window:window-lock-changed", listener);
  },
  onMiniModeChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:mini-mode-changed", listener);
    return () =>
      ipcRenderer.removeListener("window:mini-mode-changed", listener);
  },
});
