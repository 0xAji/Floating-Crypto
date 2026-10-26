(function exposeMarketHelpers(root, factory) {
  const helpers = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = helpers;
  }

  root.EthMarket = helpers;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMarketHelpers() {
  const numberFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const compactFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  function asNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeTicker(payload) {
    return {
      symbol: payload.symbol || "BTCUSDT",
      price: asNumber(payload.lastPrice),
      open: asNumber(payload.openPrice),
      changePercent: asNumber(payload.priceChangePercent),
      high: asNumber(payload.highPrice),
      low: asNumber(payload.lowPrice),
      volume: asNumber(payload.volume),
      quoteVolume: asNumber(payload.quoteVolume),
      time: asNumber(payload.closeTime, Date.now()),
    };
  }

  function normalizeMiniTicker(payload, previous = {}) {
    const price = asNumber(payload.c);
    const open = asNumber(payload.o, previous.open);
    const changePercent =
      open > 0 ? ((price - open) / open) * 100 : previous.changePercent || 0;

    return {
      ...previous,
      symbol: payload.s || previous.symbol || "BTCUSDT",
      price,
      open,
      changePercent,
      high: asNumber(payload.h, previous.high),
      low: asNumber(payload.l, previous.low),
      volume: asNumber(payload.v, previous.volume),
      quoteVolume: asNumber(payload.q, previous.quoteVolume),
      time: asNumber(payload.E, Date.now()),
    };
  }

  function formatUsd(value) {
    return Number.isFinite(value) ? numberFormatter.format(value) : "$--";
  }

  function formatCompact(value) {
    return Number.isFinite(value) ? compactFormatter.format(value) : "--";
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
  }

  function formatTime(value) {
    return timeFormatter.format(new Date(value));
  }

  function getTone(value) {
    if (value > 0) {
      return "positive";
    }

    if (value < 0) {
      return "negative";
    }

    return "neutral";
  }

  function normalizeKlines(payload) {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((candle) =>
        asNumber(Array.isArray(candle) ? candle[4] : undefined, NaN),
      )
      .filter(Number.isFinite);
  }

  function buildChartPath(values, width = 320, height = 62, padding = 3) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }

    const safeWidth = Math.max(width, padding * 2 + 1);
    const safeHeight = Math.max(height, padding * 2 + 1);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const usableWidth = safeWidth - padding * 2;
    const usableHeight = safeHeight - padding * 2;
    const points = values.map((value, index) => {
      const x =
        values.length === 1
          ? padding + usableWidth / 2
          : padding + (index / (values.length - 1)) * usableWidth;
      const y = padding + ((max - value) / range) * usableHeight;
      return { x, y };
    });

    let line = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const midX = (previous.x + point.x) / 2;
      const midY = (previous.y + point.y) / 2;

      if (index === 1) {
        line += ` Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
      }

      line += ` Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const lastPoint = points.at(-1);
    const area = `${line} L ${lastPoint.x.toFixed(2)} ${safeHeight} L ${points[0].x.toFixed(2)} ${safeHeight} Z`;

    return {
      line,
      area,
      min,
      max,
    };
  }

  return {
    buildChartPath,
    formatCompact,
    formatPercent,
    formatTime,
    formatUsd,
    getTone,
    normalizeKlines,
    normalizeMiniTicker,
    normalizeTicker,
  };
});
