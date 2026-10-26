(function exposeCoinHelpers(root, factory) {
  const helpers = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = helpers;
  }

  root.CoinTools = helpers;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCoinHelpers() {
  const COIN_SYMBOL_PATTERN = /^[A-Z0-9]{2,24}$/;
  const QUOTE_ASSET = "USDT";

  function normalizeCoinSymbol(value) {
    if (typeof value !== "string") {
      return null;
    }

    const symbol = value.trim().toUpperCase();
    return COIN_SYMBOL_PATTERN.test(symbol) ? symbol : null;
  }

  function countTickDecimals(tickSize) {
    const normalized = String(tickSize ?? "").trim();

    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      return 2;
    }

    const decimalPart = normalized.split(".")[1] ?? "";
    return Math.min(decimalPart.replace(/0+$/, "").length, 8);
  }

  function normalizeCoin(coin) {
    if (!coin || typeof coin !== "object" || Array.isArray(coin)) {
      return null;
    }

    const symbol = normalizeCoinSymbol(coin.symbol);
    const baseAsset = normalizeCoinSymbol(coin.baseAsset);
    const quoteAsset = normalizeCoinSymbol(coin.quoteAsset);

    if (!symbol || !baseAsset || quoteAsset !== QUOTE_ASSET) {
      return null;
    }

    const pricePrecision =
      Number.isInteger(coin.pricePrecision) &&
      coin.pricePrecision >= 0 &&
      coin.pricePrecision <= 8
        ? coin.pricePrecision
        : 2;

    return {
      symbol,
      baseAsset,
      quoteAsset,
      pricePrecision,
    };
  }

  function normalizeCoinCatalog(payload) {
    const symbols = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.symbols)
        ? payload.symbols
        : [];
    const uniqueCoins = new Map();

    for (const market of symbols) {
      if (
        !market ||
        typeof market !== "object" ||
        market.status !== "TRADING" ||
        market.quoteAsset !== QUOTE_ASSET ||
        market.isSpotTradingAllowed === false
      ) {
        continue;
      }

      const priceFilter = Array.isArray(market.filters)
        ? market.filters.find((filter) => filter?.filterType === "PRICE_FILTER")
        : null;
      const coin = normalizeCoin({
        symbol: market.symbol,
        baseAsset: market.baseAsset,
        quoteAsset: market.quoteAsset,
        pricePrecision: countTickDecimals(priceFilter?.tickSize),
      });

      if (coin) {
        uniqueCoins.set(coin.symbol, coin);
      }
    }

    return [...uniqueCoins.values()].sort((left, right) =>
      left.baseAsset.localeCompare(right.baseAsset, "en"),
    );
  }

  function normalizeStoredCoinCatalog(payload) {
    const source = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.coins)
        ? payload.coins
        : [];
    const uniqueCoins = new Map();

    for (const candidate of source) {
      const coin = normalizeCoin(candidate);

      if (coin) {
        uniqueCoins.set(coin.symbol, coin);
      }
    }

    return [...uniqueCoins.values()].sort((left, right) =>
      left.baseAsset.localeCompare(right.baseAsset, "en"),
    );
  }

  function filterCoins(coins, query) {
    const normalizedQuery = String(query ?? "").trim().toUpperCase();
    const safeCoins = Array.isArray(coins)
      ? coins.filter((coin) => normalizeCoin(coin))
      : [];

    if (!normalizedQuery) {
      return safeCoins;
    }

    function rank(coin) {
      if (coin.symbol === normalizedQuery) {
        return 0;
      }

      if (coin.baseAsset === normalizedQuery) {
        return 1;
      }

      if (coin.baseAsset.startsWith(normalizedQuery)) {
        return 2;
      }

      if (coin.symbol.startsWith(normalizedQuery)) {
        return 3;
      }

      return 4;
    }

    return safeCoins
      .filter(
        (coin) =>
          coin.baseAsset.includes(normalizedQuery) ||
          coin.symbol.includes(normalizedQuery),
      )
      .sort((left, right) => rank(left) - rank(right));
  }

  function getBaseAsset(symbol) {
    const normalized = normalizeCoinSymbol(symbol);

    if (!normalized) {
      return "";
    }

    return normalized.endsWith(QUOTE_ASSET)
      ? normalized.slice(0, -QUOTE_ASSET.length)
      : normalized;
  }

  function formatCoinPrice(value, pricePrecision = 2) {
    if (!Number.isFinite(value)) {
      return "$--";
    }

    const precision =
      Number.isInteger(pricePrecision) && pricePrecision >= 0
        ? Math.min(pricePrecision, 8)
        : 2;

    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })}`;
  }

  return {
    filterCoins,
    formatCoinPrice,
    getBaseAsset,
    normalizeCoinCatalog,
    normalizeCoinSymbol,
    normalizeStoredCoinCatalog,
  };
});
