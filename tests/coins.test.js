const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterCoins,
  formatCoinPrice,
  getBaseAsset,
  normalizeCoinCatalog,
  normalizeStoredCoinCatalog,
} = require("../src/lib/coins");

test("normalizes active USDT spot markets", () => {
  const coins = normalizeCoinCatalog({
    symbols: [
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        filters: [{ filterType: "PRICE_FILTER", tickSize: "0.01000000" }],
      },
      {
        symbol: "ETHBTC",
        baseAsset: "ETH",
        quoteAsset: "BTC",
        status: "TRADING",
      },
      {
        symbol: "DOGEUSDT",
        baseAsset: "DOGE",
        quoteAsset: "USDT",
        status: "BREAK",
      },
      {
        symbol: "SOLUSDT",
        baseAsset: "SOL",
        quoteAsset: "USDT",
        status: "TRADING",
        filters: [{ filterType: "PRICE_FILTER", tickSize: "0.01000000" }],
      },
    ],
  });

  assert.deepEqual(coins, [
    {
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
    {
      symbol: "SOLUSDT",
      baseAsset: "SOL",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
  ]);
});

test("searches by base asset and symbol with prefix matches first", () => {
  const coins = [
    {
      symbol: "WBTCUSDT",
      baseAsset: "WBTC",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
    {
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
    {
      symbol: "BNSOLUSDT",
      baseAsset: "BNSOL",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
    {
      symbol: "SOLUSDT",
      baseAsset: "SOL",
      quoteAsset: "USDT",
      pricePrecision: 2,
    },
  ];

  assert.deepEqual(
    filterCoins(coins, "btc").map((coin) => coin.symbol),
    ["BTCUSDT", "WBTCUSDT"],
  );
  assert.deepEqual(
    filterCoins(coins, "wbtcusdt").map((coin) => coin.symbol),
    ["WBTCUSDT"],
  );
  assert.deepEqual(
    filterCoins(coins, "solusdt").map((coin) => coin.symbol),
    ["SOLUSDT", "BNSOLUSDT"],
  );
  assert.equal(filterCoins(coins, "none").length, 0);
});

test("formats coin prices using market precision", () => {
  assert.equal(formatCoinPrice(63254.1, 2), "$63,254.10");
  assert.equal(formatCoinPrice(0.12345, 5), "$0.12345");
  assert.equal(formatCoinPrice(Number.NaN, 2), "$--");
  assert.equal(getBaseAsset("ETHUSDT"), "ETH");
});

test("normalizes the locally stored coin catalog", () => {
  assert.deepEqual(
    normalizeStoredCoinCatalog({
      coins: [
        {
          symbol: "ethusdt",
          baseAsset: "eth",
          quoteAsset: "usdt",
          pricePrecision: 2,
        },
        {
          symbol: "bad pair",
          baseAsset: "BAD",
          quoteAsset: "USDT",
        },
      ],
    }),
    [
      {
        symbol: "ETHUSDT",
        baseAsset: "ETH",
        quoteAsset: "USDT",
        pricePrecision: 2,
      },
    ],
  );
});
