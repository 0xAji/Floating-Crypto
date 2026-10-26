const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildChartPath,
  formatPercent,
  formatTime,
  formatUsd,
  getTone,
  normalizeKlines,
  normalizeMiniTicker,
  normalizeTicker,
} = require("../src/lib/market");

test("normalizes Binance 24hr ticker strings", () => {
  const ticker = normalizeTicker({
    symbol: "ETHUSDT",
    lastPrice: "3245.67",
    openPrice: "3180.10",
    priceChangePercent: "2.060",
    highPrice: "3260.00",
    lowPrice: "3141.25",
    volume: "12345.5",
    quoteVolume: "39876543.21",
    closeTime: 1760000000000,
  });

  assert.equal(ticker.price, 3245.67);
  assert.equal(ticker.high, 3260);
  assert.equal(ticker.quoteVolume, 39876543.21);
  assert.equal(ticker.time, 1760000000000);
});

test("derives 24 hour change from a mini ticker", () => {
  const ticker = normalizeMiniTicker(
    {
      s: "ETHUSDT",
      c: "3030",
      o: "3000",
      h: "3060",
      l: "2975",
      v: "200",
      q: "600000",
      E: 1760000000000,
    },
    {},
  );

  assert.equal(ticker.price, 3030);
  assert.equal(ticker.changePercent, 1);
  assert.equal(ticker.high, 3060);
});

test("formats prices, percentages, and tones", () => {
  assert.equal(formatUsd(3245.6), "$3,245.60");
  assert.equal(formatPercent(1.234), "+1.23%");
  assert.equal(formatPercent(-0.5), "-0.50%");
  assert.equal(getTone(0.1), "positive");
  assert.equal(getTone(-0.1), "negative");
  assert.equal(getTone(0), "neutral");
});

test("formats timestamps in English", () => {
  assert.match(formatTime(1760000000000), /\b(?:AM|PM)\b/);
});

test("normalizes candle closing prices", () => {
  assert.deepEqual(
    normalizeKlines([
      [0, "3000", "3010", "2990", "3005", "10"],
      [0, "3005", "3020", "3000", "3015", "12"],
      [0, "3015", "3025", "3010", "invalid", "12"],
    ]),
    [3005, 3015],
  );
});

test("builds a bounded chart line and fill", () => {
  const path = buildChartPath([100, 105, 102, 110], 320, 62, 3);

  assert.match(path.line, /^M /);
  assert.match(path.area, / Z$/);
  assert.equal(path.min, 100);
  assert.equal(path.max, 110);

  const coordinates = [...path.line.matchAll(/([\d.]+) ([\d.]+)/g)];
  for (const coordinate of coordinates) {
    assert.ok(Number(coordinate[1]) >= 3 && Number(coordinate[1]) <= 317);
    assert.ok(Number(coordinate[2]) >= 3 && Number(coordinate[2]) <= 59);
  }
});
